import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendCommandUseCase } from './send-command.usecase.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';
import { CommandStatus, CommandType } from '../domain/command.entity.js';

import { AuditEventRepository } from '../domain/audit-event.repository.js';

describe('SendCommandUseCase (Unit Tests)', () => {
  let deviceRepo: DeviceRepository;
  let commandRepo: CommandRepository;
  let pushPort: PushNotificationPort;
  let auditRepo: AuditEventRepository;
  let useCase: SendCommandUseCase;

  const createProtectedDevice = (fcmToken?: string, adminEnabled = false) => {
    return Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel 8',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: fcmToken ?? 'valid_fcm_token_123',
      adminEnabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    deviceRepo = {
      findById: vi.fn(),
      findByOwnerAndInstallId: vi.fn(),
      findByTokenHash: vi.fn(),
      findAllByOwnerId: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    commandRepo = {
      findById: vi.fn(),
      findAllByDeviceId: vi.fn(),
      findExpiredPendingOrSent: vi.fn(),
      create: vi.fn().mockImplementation(async (c) => c),
      save: vi.fn().mockImplementation(async (c) => c),
    };
    pushPort = {
      sendDataMessage: vi.fn(),
    };
    auditRepo = {
      create: vi.fn().mockImplementation(async (e) => e),
    };
    useCase = new SendCommandUseCase(deviceRepo, commandRepo, pushPort, auditRepo, 120, 60);
  });

  it('should successfully send VIBRATE command and transition to SENT', async () => {
    const device = createProtectedDevice();
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);
    vi.mocked(pushPort.sendDataMessage).mockResolvedValue({
      success: true,
      messageId: 'projects/guardia/messages/vib123',
    });

    const result = await useCase.execute({
      deviceId: 'dev-1',
      callerUserId: 'user-1',
      type: CommandType.VIBRATE,
      payload: { durationSeconds: 10 },
    });

    expect(result.type).toBe(CommandType.VIBRATE);
    expect(result.status).toBe(CommandStatus.SENT);
    expect(result.payload).toEqual({ durationSeconds: 10 });
    expect(pushPort.sendDataMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.VIBRATE,
        payloadString: JSON.stringify({ durationSeconds: 10 }),
      }),
    );
  });

  it('should successfully send MESSAGE command with contactPhone', async () => {
    const device = createProtectedDevice();
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);
    vi.mocked(pushPort.sendDataMessage).mockResolvedValue({
      success: true,
      messageId: 'projects/guardia/messages/msg123',
    });

    const result = await useCase.execute({
      deviceId: 'dev-1',
      callerUserId: 'user-1',
      type: CommandType.MESSAGE,
      payload: {
        text: '  Please return phone to front desk  ',
        contactPhone: '+15551234567',
      },
    });

    expect(result.type).toBe(CommandType.MESSAGE);
    expect(result.status).toBe(CommandStatus.SENT);
    expect(result.payload).toEqual({
      text: 'Please return phone to front desk',
      contactPhone: '+15551234567',
    });
    expect(pushPort.sendDataMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.MESSAGE,
        payloadString: JSON.stringify({
          text: 'Please return phone to front desk',
          contactPhone: '+15551234567',
        }),
      }),
    );
  });

  it('should reject MESSAGE with invalid payload (> 200 chars)', async () => {
    const device = createProtectedDevice();
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
        type: CommandType.MESSAGE,
        payload: { text: 'a'.repeat(201) },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('should reject VIBRATE with invalid payload duration > 30', async () => {
    const device = createProtectedDevice();
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
        type: CommandType.VIBRATE,
        payload: { durationSeconds: 40 },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  describe('LOCK command', () => {
    it('should reject LOCK with 409 CAPABILITY_NOT_AVAILABLE when adminEnabled is false', async () => {
      const device = createProtectedDevice('valid_fcm', false);
      vi.mocked(deviceRepo.findById).mockResolvedValue(device);

      await expect(
        useCase.execute({
          deviceId: 'dev-1',
          callerUserId: 'user-1',
          type: CommandType.LOCK,
        }),
      ).rejects.toMatchObject({
        code: 'CAPABILITY_NOT_AVAILABLE',
        statusCode: 409,
        details: [{ capability: 'DEVICE_ADMIN' }],
      });
    });

    it('should successfully dispatch LOCK with 60s TTL and write AuditEvent when adminEnabled is true', async () => {
      const device = createProtectedDevice('valid_fcm', true);
      vi.mocked(deviceRepo.findById).mockResolvedValue(device);
      vi.mocked(pushPort.sendDataMessage).mockResolvedValue({
        success: true,
        messageId: 'projects/guardia/messages/lock123',
      });

      const start = Date.now();
      const result = await useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
        type: CommandType.LOCK,
      });

      expect(result.type).toBe(CommandType.LOCK);
      expect(result.status).toBe(CommandStatus.SENT);
      expect(result.payload).toBeNull();

      // Check shorter TTL: ~60 seconds from start
      const diffSeconds = Math.round((result.expiresAt.getTime() - start) / 1000);
      expect(diffSeconds).toBeCloseTo(60, 1);

      // Verify AuditEvent recorded
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          deviceId: 'dev-1',
          action: 'COMMAND_LOCK_ISSUED',
        }),
      );
    });

    it('should reject LOCK when non-empty payload is passed', async () => {
      const device = createProtectedDevice('valid_fcm', true);
      vi.mocked(deviceRepo.findById).mockResolvedValue(device);

      await expect(
        useCase.execute({
          deviceId: 'dev-1',
          callerUserId: 'user-1',
          type: CommandType.LOCK,
          payload: { foo: 'bar' },
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });
  });
});
