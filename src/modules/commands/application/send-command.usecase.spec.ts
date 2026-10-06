import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendCommandUseCase } from './send-command.usecase.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';
import { CommandStatus, CommandType } from '../domain/command.entity.js';

describe('SendCommandUseCase (Unit Tests)', () => {
  let deviceRepo: DeviceRepository;
  let commandRepo: CommandRepository;
  let pushPort: PushNotificationPort;
  let useCase: SendCommandUseCase;

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
    useCase = new SendCommandUseCase(deviceRepo, commandRepo, pushPort, 120);
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
});
