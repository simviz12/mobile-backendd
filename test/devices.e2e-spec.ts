import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Devices Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenUserA: string;
  let tokenUserB: string;
  let deviceAId: string;
  let deviceTokenA: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Register User A
    const regA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'userA.devices@example.com',
        password: 'Password123!',
        displayName: 'User A',
      });
    tokenUserA = regA.body.accessToken;

    // Register User B
    const regB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'userB.devices@example.com',
        password: 'Password123!',
        displayName: 'User B',
      });
    tokenUserB = regB.body.accessToken;
  });

  afterAll(async () => {
    await prisma.device.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  it('POST /devices - 400 VALIDATION_ERROR on invalid name or mode', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        installId: 'inst-1',
        name: '', // Empty name (min 1)
        platform: 'android',
        mode: 'INVALID_MODE',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /devices - 201 Created for new device link', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        installId: 'install-a-1',
        name: 'Pixel 8 User A',
        platform: 'android',
        model: 'Pixel 8',
        osVersion: '14',
        appVersion: '1.0.0',
        mode: 'PROTECTED',
        fcmToken: 'fcm-token-1',
      })
      .expect(201);

    expect(res.body.device).toBeDefined();
    expect(res.body.device.name).toBe('Pixel 8 User A');
    expect(res.body.device.mode).toBe('PROTECTED');
    expect(res.body.device.isOnline).toBe(false);
    expect(res.body.device.batteryLevel).toBeNull();
    expect(res.body.device.deviceTokenHash).toBeUndefined(); // Never leaked!
    expect(res.body.deviceToken).toBeDefined();

    deviceAId = res.body.device.id;
    deviceTokenA = res.body.deviceToken;
  });

  it('POST /devices - 200 OK idempotent link for existing installId (rotates token)', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        installId: 'install-a-1',
        name: 'Pixel 8 Renamed On ReLink',
        platform: 'android',
        mode: 'PROTECTED',
      })
      .expect(200);

    expect(res.body.device.id).toBe(deviceAId);
    expect(res.body.device.name).toBe('Pixel 8 Renamed On ReLink');
    expect(res.body.deviceToken).toBeDefined();
    expect(res.body.deviceToken).not.toBe(deviceTokenA);

    deviceTokenA = res.body.deviceToken;
  });

  it('GET /devices - 200 OK lists caller devices only (newest first)', async () => {
    // User A has 1 device
    const resA = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(200);

    expect(resA.body.devices).toHaveLength(1);
    expect(resA.body.devices[0].id).toBe(deviceAId);

    // User B has 0 devices
    const resB = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .expect(200);

    expect(resB.body.devices).toHaveLength(0);
  });

  it('GET /devices/:id - 200 OK for owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(200);

    expect(res.body.id).toBe(deviceAId);
    expect(res.body.deviceTokenHash).toBeUndefined();
  });

  it('GET /devices/:id - 404 DEVICE_NOT_FOUND when accessed by another user (strict ownership, no leak)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .expect(404);

    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('PATCH /devices/:id - 404 DEVICE_NOT_FOUND when patched by another user', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ name: 'Hacked Name' })
      .expect(404);

    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('PATCH /devices/:id - 200 OK for owner', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ name: 'Pixel 8 Final Name' })
      .expect(200);

    expect(res.body.name).toBe('Pixel 8 Final Name');
  });

  it('DELETE /devices/:id - 404 DEVICE_NOT_FOUND when deleted by another user', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .expect(404);

    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('DELETE /devices/:id - 204 No Content for owner', async () => {
    await request(app.getHttpServer())
      .delete(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(204);

    // After unlinking, fetching returns 404
    await request(app.getHttpServer())
      .get(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(404);
  });
});
