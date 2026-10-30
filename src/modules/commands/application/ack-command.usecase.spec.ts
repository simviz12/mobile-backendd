import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AckCommandUseCase } from './ack-command.usecase.js';
import { CommandRepository } from '../domain/command.repository.js';
import { Command, CommandStatus, CommandType } from '../domain/command.entity.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';

describe('AckCommandUseCase (Unit Tests)', () => {
  let commandRepo: CommandRepository;
  let deviceRepo: DeviceRepository;
  let useCase: AckCommandUseCase;

  beforeEach(() => {
    commandRepo = {
      findById: vi.fn(),
      findAllByDeviceId: vi.fn(),
      findExpiredPendingOrSent: vi.fn(),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (c) => c),
    };
    deviceRepo = {
      findById: vi.fn(),
      findByInstallId: vi.fn(),
      findByDeviceTokenHash: vi.fn(),
      findAllByOwnerId: vi.fn(),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (d) => d),
      delete: vi.fn(),
    };
    useCase = new AckCommandUseCase(commandRepo, deviceRepo);
  });

  it('should acknowledge DELIVERED from target device', async () => {
    const cmd = Command.create({
      id: 'cmd-1',
      deviceId: 'dev-1',
      issuedById: 'u1',
      type: CommandType.RING,
      status: CommandStatus.SENT,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    vi.mocked(commandRepo.findById).mockResolvedValue(cmd);

    const res = await useCase.execute({
      commandId: 'cmd-1',
      authenticatingDeviceId: 'dev-1',
      status: 'DELIVERED',
    });

    expect(res.status).toBe(CommandStatus.DELIVERED);
    expect(res.deliveredAt).toBeDefined();
    expect(commandRepo.save).toHaveBeenCalled();
  });

  it('should reject with 403 FORBIDDEN if another device tries to ack', async () => {
    const cmd = Command.create({
      id: 'cmd-1',
      deviceId: 'dev-target',
      issuedById: 'u1',
      type: CommandType.RING,
      status: CommandStatus.SENT,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    vi.mocked(commandRepo.findById).mockResolvedValue(cmd);

    await expect(
      useCase.execute({
        commandId: 'cmd-1',
        authenticatingDeviceId: 'dev-attacker',
        status: 'EXECUTED',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('should map WIPE EXECUTING to EXECUTED with EXECUTED_PENDING_CONFIRMATION and wipe device', async () => {
    const cmd = Command.create({
      id: 'cmd-wipe-1',
      deviceId: 'dev-1',
      issuedById: 'u1',
      type: CommandType.WIPE,
      status: CommandStatus.SENT,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    const dev = Device.create({
      id: 'dev-1',
      ownerId: 'u1',
      installId: 'inst-1',
      name: 'Victim Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: 'fcm-victim',
      deviceTokenHash: 'hash-victim',
    });
    vi.mocked(commandRepo.findById).mockResolvedValue(cmd);
    vi.mocked(deviceRepo.findById).mockResolvedValue(dev);

    const res = await useCase.execute({
      commandId: 'cmd-wipe-1',
      authenticatingDeviceId: 'dev-1',
      status: 'EXECUTING',
    });

    expect(res.status).toBe(CommandStatus.EXECUTED);
    expect(res.failureReason).toBe('EXECUTED_PENDING_CONFIRMATION');
    expect(res.executedAt).toBeDefined();

    expect(dev.wipedAt).toBeDefined();
    expect(dev.fcmToken).toBeNull();
    expect(dev.deviceTokenHash).toBeNull();
    expect(deviceRepo.save).toHaveBeenCalledWith(dev);
  });
});

