process.env.ALLOW_REMOTE_WIPE = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { PUSH_NOTIFICATION_PORT, PushNotificationPort } from '../src/modules/commands/domain/push-notification.port.js';
import { ExecuteWipeUseCase } from '../src/modules/commands/application/execute-wipe.usecase.js';
import { DEVICE_REPOSITORY } from '../src/modules/devices/domain/device.repository.js';
import { USER_REPOSITORY } from '../src/modules/users/domain/user.repository.js';
import { PASSWORD_HASHER } from '../src/modules/auth/domain/auth-ports.js';
import { COMMAND_REPOSITORY } from '../src/modules/commands/domain/command.repository.js';
import { AUDIT_EVENT_REPOSITORY } from '../src/modules/commands/domain/audit-event.repository.js';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Remote Wipe Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let deviceAId: string;
  let deviceAToken: string;
  let deviceNonAdminId: string;

  const mockPushNotificationPort: PushNotificationPort = {
    sendDataMessage: async (_payload) => {
      return { success: true, messageId: `projects/guardia/messages/mock-wipe-${Date.now()}` };
    },
  };

  beforeAll(async () => {

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .overrideProvider(PUSH_NOTIFICATION_PORT)
      .useValue(mockPushNotificationPort)
      .overrideProvider(ExecuteWipeUseCase)
      .useFactory({
        factory: (
          deviceRepo,
          userRepo,
          hasher,
          commandRepo,
          pushPort,
          auditRepo,
        ) =>
          new ExecuteWipeUseCase(
            deviceRepo,
            userRepo,
            hasher,
            commandRepo,
            pushPort,
            auditRepo,
            true, // allowRemoteWipe = true for testing
            600,
          ),
        inject: [
          DEVICE_REPOSITORY,
          USER_REPOSITORY,
          PASSWORD_HASHER,
          COMMAND_REPOSITORY,
          PUSH_NOTIFICATION_PORT,
          AUDIT_EVENT_REPOSITORY,
        ],
      })
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
      .send({ email: 'wipe.owner@example.com', password: 'Password123!', displayName: 'Wipe Owner' });
    userAToken = regA.body.accessToken;

    // Register User B
    const regB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'wipe.other@example.com', password: 'Password123!', displayName: 'Other User' });
    userBToken = regB.body.accessToken;

    // Link Device A for User A
    const linkA = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        installId: 'wipe-device-a-uuid',
        name: 'Wipe Protected Device',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'fcm-token-wipe-a',
      });
    deviceAId = linkA.body.device.id;
    deviceAToken = linkA.body.deviceToken;

    // Enable adminEnabled and wipeEnabled for Device A
    await request(app.getHttpServer())
      .patch(`/devices/${deviceAId}/capabilities`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({ adminEnabled: true, wipeEnabled: true });

    // Link Device Non-Admin for User A
    const linkNonAdmin = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        installId: 'wipe-device-non-admin-uuid',
        name: 'Non Admin Device',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'fcm-token-non-admin',
      });
    deviceNonAdminId = linkNonAdmin.body.device.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.command.deleteMany({
      where: { deviceId: { in: [deviceAId, deviceNonAdminId] } },
    });
    await prisma.auditEvent.deleteMany({
      where: { deviceId: { in: [deviceAId, deviceNonAdminId] } },
    });
    await prisma.device.deleteMany({
      where: { id: { in: [deviceAId, deviceNonAdminId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['wipe.owner@example.com', 'wipe.other@example.com'] } },
    });
    await app.close();
  });

  it('1. Rejects WIPE creation via generic POST /devices/:id/commands with 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/commands`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ type: 'WIPE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('WIPE command cannot be issued through generic');
  });

  it('2. Rejects wipe if confirmationText !== "BORRAR"', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/wipe`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('X-Forwarded-For', '192.168.1.101')
      .send({
        password: 'Password123!',
        confirmationText: 'borrar',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('3. Rejects wipe if password is incorrect with 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/wipe`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('X-Forwarded-For', '192.168.1.102')
      .send({
        password: 'WrongPassword!',
        confirmationText: 'BORRAR',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('4. Rejects wipe if caller does not own the device with 404 DEVICE_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/wipe`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('X-Forwarded-For', '192.168.1.103')
      .send({
        password: 'Password123!',
        confirmationText: 'BORRAR',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('5. Rejects wipe if device does not have adminEnabled with 409 CAPABILITY_NOT_AVAILABLE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceNonAdminId}/wipe`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        password: 'Password123!',
        confirmationText: 'BORRAR',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPABILITY_NOT_AVAILABLE');
  });

  it('6. Successfully requests remote wipe (202 ACCEPTED)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/wipe`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        password: 'Password123!',
        confirmationText: 'BORRAR',
      });

    expect(res.status).toBe(202);
    expect(res.body.command).toBeDefined();
    expect(res.body.command.type).toBe('WIPE');
    expect(res.body.command.status).toBe('SENT');

    const commandId = res.body.command.id;

    // 7. Device ACKs EXECUTING before wiping -> mapped to EXECUTED with EXECUTED_PENDING_CONFIRMATION
    const ackRes = await request(app.getHttpServer())
      .post(`/commands/${commandId}/ack`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({
        status: 'EXECUTING',
      });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe('EXECUTED');
    expect(ackRes.body.failureReason).toBe('EXECUTED_PENDING_CONFIRMATION');

    // 8. Device should now be marked wipedAt and tokens cleared
    const devRes = await request(app.getHttpServer())
      .get(`/devices/${deviceAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(devRes.status).toBe(200);
    expect(devRes.body.wipedAt).toBeDefined();
    expect(devRes.body.fcmToken).toBeNull();

    // Device token was cleared in database, so subsequent device token auth should fail
    const statusFail = await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/status`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({
        batteryLevel: 50,
        isCharging: false,
        networkType: 'wifi',
      });
    expect(statusFail.status).toBe(401);

    // 9. User can query GET /audit?deviceId= to verify wipe audit events
    const auditRes = await request(app.getHttpServer())
      .get(`/audit?deviceId=${deviceAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body)).toBe(true);
    expect(auditRes.body.length).toBeGreaterThan(0);

    const wipeEvent = auditRes.body.find((e: any) => e.action === 'REMOTE_WIPE_ATTEMPT');
    expect(wipeEvent).toBeDefined();
    expect(wipeEvent.deviceId).toBe(deviceAId);
  });
});
