import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { PUSH_NOTIFICATION_PORT, PushNotificationPort } from '../src/modules/commands/domain/push-notification.port.js';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Commands Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let deviceAId: string;
  let deviceAToken: string;
  let commandId: string;

  const mockPushNotificationPort: PushNotificationPort = {
    sendDataMessage: async (payload) => {
      if (payload.fcmToken === 'fcm-invalid') {
        return { success: false, error: 'FCM_TOKEN_INVALID', details: 'Invalid registration token' };
      }
      return { success: true, messageId: `projects/guardia/messages/mock-${Date.now()}` };
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PUSH_NOTIFICATION_PORT)
      .useValue(mockPushNotificationPort)
      .compile();

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
      .send({ email: 'owner.cmd@example.com', password: 'Password123!', displayName: 'Command Owner' });
    userAToken = regA.body.accessToken;

    // Register User B
    const regB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'other.cmd@example.com', password: 'Password123!', displayName: 'Other User' });
    userBToken = regB.body.accessToken;

    // Link a PROTECTED device for User A
    const linkRes = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        installId: 'cmd-device-install-1',
        name: 'Protected Pixel',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'fcm-valid-token-123',
      });

    deviceAId = linkRes.body.device.id;
    deviceAToken = linkRes.body.deviceToken;
  });

  afterAll(async () => {
    await prisma.command.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  it('POST /devices/:id/commands - 404 DEVICE_NOT_FOUND when device belongs to another user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ type: 'RING', payload: { durationSeconds: 30 } })
      .expect(404);

    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('POST /devices/:id/commands - 201 Created issues RING command and sets status to SENT', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ type: 'RING', payload: { durationSeconds: 20 } })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe('RING');
    expect(res.body.status).toBe('SENT');
    expect(res.body.sentAt).toBeDefined();
    expect(res.body.payload).toEqual({ durationSeconds: 20 });

    commandId = res.body.id;
  });

  it('GET /devices/:id/commands - 200 OK lists commands of that device with cursor pagination', async () => {
    const res = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].id).toBe(commandId);
  });

  it('GET /commands/:id - 200 OK returns command for issuer', async () => {
    const res = await request(app.getHttpServer())
      .get(`/commands/${commandId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(res.body.id).toBe(commandId);
    expect(res.body.status).toBe('SENT');
  });

  it('GET /commands/:id - 404 COMMAND_NOT_FOUND when requested by unauthorized user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/commands/${commandId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(404);

    expect(res.body.error.code).toBe('COMMAND_NOT_FOUND');
  });

  it('POST /commands/:id/ack - 401 UNAUTHORIZED when no Device token header', async () => {
    const res = await request(app.getHttpServer())
      .post(`/commands/${commandId}/ack`)
      .send({ status: 'DELIVERED' })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /commands/:id/ack - 200 OK marks DELIVERED from target device', async () => {
    const res = await request(app.getHttpServer())
      .post(`/commands/${commandId}/ack`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({ status: 'DELIVERED' })
      .expect(200);

    expect(res.body.status).toBe('DELIVERED');
    expect(res.body.deliveredAt).toBeDefined();
  });

  it('POST /commands/:id/ack - 200 OK marks EXECUTED from target device (idempotent)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/commands/${commandId}/ack`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({ status: 'EXECUTED' })
      .expect(200);

    expect(res.body.status).toBe('EXECUTED');
    expect(res.body.executedAt).toBeDefined();

    // Re-ack EXECUTED idempotently
    const reAck = await request(app.getHttpServer())
      .post(`/commands/${commandId}/ack`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({ status: 'EXECUTED' })
      .expect(200);

    expect(reAck.body.status).toBe('EXECUTED');
  });

  it('POST /devices/:id/commands - 201 Created for VIBRATE command', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'VIBRATE',
        payload: { durationSeconds: 15 },
      })
      .expect(201);

    expect(res.body.type).toBe('VIBRATE');
    expect(res.body.status).toBe('SENT');
    expect(res.body.payload).toEqual({ durationSeconds: 15 });
  });

  it('POST /devices/:id/commands - 201 Created for MESSAGE command', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'MESSAGE',
        payload: {
          text: 'Found phone, contact me',
          contactPhone: '+573001234567',
        },
      })
      .expect(201);

    expect(res.body.type).toBe('MESSAGE');
    expect(res.body.status).toBe('SENT');
    expect(res.body.payload).toEqual({
      text: 'Found phone, contact me',
      contactPhone: '+573001234567',
    });
  });

  it('POST /devices/:id/commands - 400 VALIDATION_ERROR on invalid VIBRATE payload', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'VIBRATE',
        payload: { durationSeconds: 60 },
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('POST /devices/:id/commands - 400 VALIDATION_ERROR on invalid MESSAGE payload (>200 chars)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'MESSAGE',
        payload: { text: 'X'.repeat(201) },
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('GET /devices/:id/commands - pagination and filters', async () => {
    // Query with filter type=MESSAGE
    const resType = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}/commands?type=MESSAGE`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(resType.body.items.length).toBeGreaterThanOrEqual(1);
    expect(resType.body.items.every((c: any) => c.type === 'MESSAGE')).toBe(true);

    // Query with limit=1
    const resPage1 = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}/commands?limit=1`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(resPage1.body.items.length).toBe(1);
    expect(resPage1.body.nextCursor).toBeDefined();

    // Query second page using cursor
    const resPage2 = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}/commands?limit=1&cursor=${resPage1.body.nextCursor}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(resPage2.body.items.length).toBe(1);
    expect(resPage2.body.items[0].id).not.toBe(resPage1.body.items[0].id);
  });
});
