import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { PUSH_NOTIFICATION_PORT, PushNotificationPort } from '../src/modules/commands/domain/push-notification.port.js';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Theft Mode Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let deviceAId: string;
  let deviceAToken: string;
  let deviceNonAdminId: string;

  const mockPushNotificationPort: PushNotificationPort = {
    sendDataMessage: async (_payload) => {
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
      .send({ email: 'theft.owner@example.com', password: 'Password123!', displayName: 'Theft Owner' });
    userAToken = regA.body.accessToken;

    // Register User B
    const regB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'theft.other@example.com', password: 'Password123!', displayName: 'Other User' });
    userBToken = regB.body.accessToken;

    // Link Device A for User A
    const linkA = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        installId: 'install-theft-a',
        name: 'Theft Test Phone',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'fcm-token-theft-a',
      });
    deviceAId = linkA.body.device.id;
    deviceAToken = linkA.body.deviceToken;

    // Enable admin capabilities on Device A
    await request(app.getHttpServer())
      .patch(`/devices/${deviceAId}/capabilities`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({ adminEnabled: true });

    // Link Device Non-Admin for User A
    const linkNonAdmin = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        installId: 'install-theft-nonadmin',
        name: 'Non Admin Phone',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'fcm-token-theft-nonadmin',
      });
    deviceNonAdminId = linkNonAdmin.body.device.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /devices/:id/theft-mode', () => {
    it('should reject activation from another user (ownership check)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          message: 'Phone stolen',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('should reject when lock=true and device has adminEnabled=false', async () => {
      const res = await request(app.getHttpServer())
        .post(`/devices/${deviceNonAdminId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          message: 'Phone stolen',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CAPABILITY_NOT_AVAILABLE');
    });

    it('should activate theft mode with valid configuration', async () => {
      const res = await request(app.getHttpServer())
        .post(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          message: 'Please return this phone to the owner!',
          contactPhone: '+573001234567',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.theftMode).toBeDefined();
      expect(res.body.theftMode.message).toBe('Please return this phone to the owner!');
      expect(res.body.theftMode.contactPhone).toBe('+573001234567');
      expect(res.body.theftMode.deactivatedAt).toBeNull();
      expect(res.body.command).toBeDefined();
      expect(res.body.command.type).toBe('THEFT_MODE_ON');
    });

    it('should reject activation when theft mode is already active (409 THEFT_MODE_ALREADY_ACTIVE)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          message: 'Another theft report',
          locationIntervalSeconds: 120,
          alarm: false,
          lock: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('THEFT_MODE_ALREADY_ACTIVE');
    });
  });

  describe('GET /devices/:id/theft-mode & /history', () => {
    it('should return the active theft mode record', async () => {
      const res = await request(app.getHttpServer())
        .get(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Please return this phone to the owner!');
      expect(res.body.deactivatedAt).toBeNull();
    });

    it('should return theft mode history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/devices/${deviceAId}/theft-mode/history`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject unauthorized user querying theft mode', async () => {
      const res = await request(app.getHttpServer())
        .get(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /devices/:id/theft-mode', () => {
    it('should reject deactivation with wrong password (401 INVALID_CREDENTIALS)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should accept deactivation with correct password and wait for ack when force=false', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.forced).toBe(false);
      expect(res.body.command).toBeDefined();
      expect(res.body.command.type).toBe('THEFT_MODE_OFF');

      // The theft mode is still active pending device ack
      const getActive = await request(app.getHttpServer())
        .get(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(getActive.status).toBe(200);

      // Now simulate device acknowledging THEFT_MODE_OFF as EXECUTED
      const ackRes = await request(app.getHttpServer())
        .post(`/commands/${res.body.command.id}/ack`)
        .set('Authorization', `Device ${deviceAToken}`)
        .send({ status: 'EXECUTED' });
      expect(ackRes.status).toBe(200);

      // Now verify it is closed in database
      const checkClosed = await request(app.getHttpServer())
        .get(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(checkClosed.status).toBe(404);
      expect(checkClosed.body.error.code).toBe('THEFT_MODE_NOT_ACTIVE');
    });

    it('should immediately close in database when force=true', async () => {
      // Re-activate theft mode first
      await request(app.getHttpServer())
        .post(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          message: 'Second theft activation',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        });

      // Force deactivate
      const res = await request(app.getHttpServer())
        .delete(`/devices/${deviceAId}/theft-mode?force=true`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.forced).toBe(true);

      // Confirm closed immediately
      const checkClosed = await request(app.getHttpServer())
        .get(`/devices/${deviceAId}/theft-mode`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(checkClosed.status).toBe(404);
      expect(checkClosed.body.error.code).toBe('THEFT_MODE_NOT_ACTIVE');
    });
  });
});
