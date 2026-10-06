import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendRingCommandUseCase } from './send-ring-command.usecase.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';
import { CommandStatus, CommandType } from '../domain/command.entity.js';

import { SendCommandUseCase } from './send-command.usecase.js';

describe('SendRingCommandUseCase (Unit Tests)', () => {
  let deviceRepo: DeviceRepository;
  let commandRepo: CommandRepository;
  let pushPort: PushNotificationPort;
  let sendCommandUseCase: SendCommandUseCase;
  let useCase: SendRingCommandUseCase;

  const createProtectedDevice = (fcmToken?: string) => {
    return Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel 8',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: fcmToken ?? 'valid_fcm_token_123',
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
    sendCommandUseCase = new SendCommandUseCase(deviceRepo, commandRepo, pushPort, 120);
    useCase = new SendRingCommandUseCase(sendCommandUseCase);
  });

  it('should successfully send RING command and transition to SENT', async () => {
    const device = createProtectedDevice();
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);
    vi.mocked(pushPort.sendDataMessage).mockResolvedValue({
      success: true,
      messageId: 'projects/guardia/messages/12345',
    });

    const result = await useCase.execute({
      deviceId: 'dev-1',
      callerUserId: 'user-1',
      durationSeconds: 45,
    });

    expect(result.status).toBe(CommandStatus.SENT);
    expect(result.sentAt).toBeDefined();
    expect(result.type).toBe(CommandType.RING);
    expect(result.payload).toEqual({ durationSeconds: 45 });
    expect(pushPort.sendDataMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        fcmToken: 'valid_fcm_token_123',
        type: 'RING',
        ttlSeconds: 120,
      }),
    );
  });

  it('should reject with 409 DEVICE_NOT_PROTECTED if target device is CONTROLLER', async () => {
    const controllerDevice = Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel 8 Controller',
      platform: 'android',
      mode: DeviceMode.CONTROLLER,
      fcmToken: 'token',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deviceRepo.findById).mockResolvedValue(controllerDevice);

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      code: 'DEVICE_NOT_PROTECTED',
      statusCode: 409,
    });
  });

  it('should reject with 409 DEVICE_NOT_REACHABLE if target device has no fcmToken', async () => {
    const deviceNoFcm = Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel 8 No FCM',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deviceRepo.findById).mockResolvedValue(deviceNoFcm);

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      code: 'DEVICE_NOT_REACHABLE',
      statusCode: 409,
    });
  });

  it('should clear device fcmToken and mark command FAILED when FCM rejects invalid token', async () => {
    const device = createProtectedDevice();
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);
    vi.mocked(pushPort.sendDataMessage).mockResolvedValue({
      success: false,
      error: 'FCM_TOKEN_INVALID',
      details: 'Requested entity was not found',
    });

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      code: 'DEVICE_NOT_REACHABLE',
      statusCode: 409,
    });

    expect(device.fcmToken).toBeNull();
    expect(deviceRepo.save).toHaveBeenCalledWith(device);
    expect(commandRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CommandStatus.FAILED,
        failureReason: 'FCM_TOKEN_INVALID',
      }),
    );
  });
});
