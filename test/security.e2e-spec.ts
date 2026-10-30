import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { VerifyActionTwoFactorUseCase } from '../src/modules/auth/application/verify-action-two-factor.usecase.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { generateSync } from 'otplib';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Security, 2FA & Session Management Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userEmail = 'security.test@example.com';
  let userPass = 'Password123!';
  let userToken: string;
  let userId: string;
  let totpSecret: string;
  let backupCodes: string[] = [];

  const mockPushNotificationPort: PushNotificationPort = {
    sendDataMessage: async () => ({ success: true, messageId: 'mock-msg-id' }),
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
          verify2fa,
        ) =>
          new ExecuteWipeUseCase(
            deviceRepo,
            userRepo,
            hasher,
            commandRepo,
            pushPort,
            auditRepo,
            true, // allowRemoteWipe
            600,
            verify2fa,
          ),
        inject: [
          DEVICE_REPOSITORY,
          USER_REPOSITORY,
          PASSWORD_HASHER,
          COMMAND_REPOSITORY,
          PUSH_NOTIFICATION_PORT,
          AUDIT_EVENT_REPOSITORY,
          VerifyActionTwoFactorUseCase,
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

    // Register test user
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password: userPass, displayName: 'Security Tester' });
    userToken = reg.body.accessToken;
    userId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.command.deleteMany({ where: { issuedById: userId } });
    await prisma.auditEvent.deleteMany({ where: { userId } });
    await prisma.device.deleteMany({ where: { ownerId: userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.twoFactorAttempt.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('1. POST /auth/2fa/setup returns secret and otpauthUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/2fa/setup')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.secret).toBeDefined();
    expect(res.body.otpauthUrl).toContain('otpauth://totp/');
    totpSecret = res.body.secret;
  });

  it('2. POST /auth/2fa/enable activates 2FA with valid code and returns 10 backup codes', async () => {
    const code = generateSync({ secret: totpSecret });

    const res = await request(app.getHttpServer())
      .post('/auth/2fa/enable')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes).toHaveLength(10);
    backupCodes = res.body.backupCodes;
  });

  it('3. POST /auth/login with 2FA enabled returns requiresTwoFactor and twoFactorToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: userPass });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.twoFactorToken).toBeDefined();
    expect(res.body.accessToken).toBeUndefined();

    // 4. POST /auth/2fa/verify with wrong code fails
    const failRes = await request(app.getHttpServer())
      .post('/auth/2fa/verify')
      .send({
        twoFactorToken: res.body.twoFactorToken,
        code: '000000',
      });
    expect(failRes.status).toBe(401);
    expect(failRes.body.error.code).toBe('TWO_FACTOR_INVALID');

    // 5. POST /auth/2fa/verify with single-use backup code succeeds
    const successRes = await request(app.getHttpServer())
      .post('/auth/2fa/verify')
      .send({
        twoFactorToken: res.body.twoFactorToken,
        code: backupCodes[0],
      });
    expect(successRes.status).toBe(200);
    expect(successRes.body.accessToken).toBeDefined();

    // 6. Same backup code cannot be used again
    const loginAgain = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: userPass });

    const reusedRes = await request(app.getHttpServer())
      .post('/auth/2fa/verify')
      .send({
        twoFactorToken: loginAgain.body.twoFactorToken,
        code: backupCodes[0],
      });
    expect(reusedRes.status).toBe(401);
  });

  it('7. Sensitive actions require 2FA when enabled (theft mode deactivation)', async () => {
    // Link device
    const link = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        installId: 'sec-device-uuid',
        name: 'Sec Device',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'sec-fcm-token',
      });
    const deviceId = link.body.device.id;
    const deviceToken = link.body.deviceToken;

    await request(app.getHttpServer())
      .patch(`/devices/${deviceId}/capabilities`)
      .set('Authorization', `Device ${deviceToken}`)
      .send({ adminEnabled: true, wipeEnabled: true });

    // Activate theft mode
    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/theft-mode`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        message: 'Robado',
        locationIntervalSeconds: 60,
        alarm: false,
        lock: false,
      });

    // Deactivation without 2FA code fails with 401 TWO_FACTOR_REQUIRED
    const deactFail = await request(app.getHttpServer())
      .delete(`/devices/${deviceId}/theft-mode`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ password: userPass });

    expect(deactFail.status).toBe(401);
    expect(deactFail.body.error.code).toBe('TWO_FACTOR_REQUIRED');

    // Deactivation with valid TOTP succeeds
    const totpCode = generateSync({ secret: totpSecret });
    const deactOk = await request(app.getHttpServer())
      .delete(`/devices/${deviceId}/theft-mode?force=true`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ password: userPass, twoFactorCode: totpCode });

    expect(deactOk.status).toBe(200);
  });

  it('8. Session management: list, revoke, and change-password', async () => {
    // List sessions
    const sessionsRes = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${userToken}`);

    expect(sessionsRes.status).toBe(200);
    expect(Array.isArray(sessionsRes.body)).toBe(true);
    expect(sessionsRes.body.length).toBeGreaterThan(0);
    const sessionId = sessionsRes.body[0].id;

    // Revoke one session
    const revRes = await request(app.getHttpServer())
      .delete(`/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(revRes.status).toBe(204);

    // Change password revokes all remaining sessions
    const changeRes = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        currentPassword: userPass,
        newPassword: 'NewPassword999!',
      });
    expect(changeRes.status).toBe(204);
  });
});
