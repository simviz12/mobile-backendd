import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteWipeUseCase } from './execute-wipe.usecase.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { UserRepository } from '../../users/domain/user.repository.js';
import { PasswordHasher } from '../../auth/domain/auth-ports.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { AuditEventRepository } from '../domain/audit-event.repository.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';
import { User } from '../../users/domain/user.entity.js';
import { CommandType, CommandStatus } from '../domain/command.entity.js';

describe('ExecuteWipeUseCase (Unit Tests)', () => {
  let deviceRepo: DeviceRepository;
  let userRepo: UserRepository;
  let hasher: PasswordHasher;
  let commandRepo: CommandRepository;
  let pushPort: PushNotificationPort;
  let auditRepo: AuditEventRepository;

  beforeEach(() => {
    deviceRepo = {
      findById: vi.fn(),
      findByInstallId: vi.fn(),
      findByDeviceTokenHash: vi.fn(),
      findAllByOwnerId: vi.fn(),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (d) => d),
      delete: vi.fn(),
    };
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };
    hasher = {
      hash: vi.fn(),
      compare: vi.fn(),
    };
    commandRepo = {
      findById: vi.fn(),
      findAllByDeviceId: vi.fn(),
      findExpiredPendingOrSent: vi.fn(),
      create: vi.fn().mockImplementation(async (c) => c),
      save: vi.fn().mockImplementation(async (c) => c),
    };
    pushPort = {
      sendDataMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-wipe-1' }),
    };
    auditRepo = {
      create: vi.fn().mockImplementation(async (a) => a),
      findByUserId: vi.fn().mockResolvedValue([]),
    };
  });

  it('should reject with 403 WIPE_DISABLED when ALLOW_REMOTE_WIPE is false', async () => {
    const useCase = new ExecuteWipeUseCase(
      deviceRepo,
      userRepo,
      hasher,
      commandRepo,
      pushPort,
      auditRepo,
      false, // allowRemoteWipe
      600,
    );

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'u-1',
        password: 'ValidPassword123!',
        confirmationText: 'BORRAR',
      }),
    ).rejects.toMatchObject({
      code: 'WIPE_DISABLED',
      statusCode: 403,
    });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REMOTE_WIPE_ATTEMPT',
        metadata: expect.objectContaining({ result: 'WIPE_DISABLED' }),
      }),
    );
  });

  it('should reject with 400 VALIDATION_ERROR when confirmationText is not "BORRAR"', async () => {
    const useCase = new ExecuteWipeUseCase(
      deviceRepo,
      userRepo,
      hasher,
      commandRepo,
      pushPort,
      auditRepo,
      true, // allowRemoteWipe
      600,
    );

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'u-1',
        password: 'ValidPassword123!',
        confirmationText: 'borrar', // lowercase
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ result: 'INVALID_CONFIRMATION_TEXT' }),
      }),
    );
  });

  it('should reject with 401 INVALID_CREDENTIALS when password does not match', async () => {
    const useCase = new ExecuteWipeUseCase(
      deviceRepo,
      userRepo,
      hasher,
      commandRepo,
      pushPort,
      auditRepo,
      true,
      600,
    );

    const user = User.create({
      id: 'u-1',
      email: 'test@example.com',
      passwordHash: 'hashed_pw',
      fullName: 'Test User',
      createdAt: new Date(),
    });
    vi.mocked(userRepo.findById).mockResolvedValue(user);
    vi.mocked(hasher.compare).mockResolvedValue(false);

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'u-1',
        password: 'WrongPassword',
        confirmationText: 'BORRAR',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ result: 'INVALID_CREDENTIALS' }),
      }),
    );
  });

  it('should reject with 409 CAPABILITY_NOT_AVAILABLE if adminEnabled is false', async () => {
    const useCase = new ExecuteWipeUseCase(
      deviceRepo,
      userRepo,
      hasher,
      commandRepo,
      pushPort,
      auditRepo,
      true,
      600,
    );

    const user = User.create({
      id: 'u-1',
      email: 'test@example.com',
      passwordHash: 'hashed_pw',
      fullName: 'Test User',
      createdAt: new Date(),
    });
    const device = Device.create({
      id: 'dev-1',
      ownerId: 'u-1',
      installId: 'inst-1',
      name: 'Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: 'fcm-token',
      adminEnabled: false,
    });

    vi.mocked(userRepo.findById).mockResolvedValue(user);
    vi.mocked(hasher.compare).mockResolvedValue(true);
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'u-1',
        password: 'ValidPassword123!',
        confirmationText: 'BORRAR',
      }),
    ).rejects.toMatchObject({
      code: 'CAPABILITY_NOT_AVAILABLE',
      statusCode: 409,
    });
  });

  it('should successfully dispatch WIPE command and audit log when all safeguards pass', async () => {
    const useCase = new ExecuteWipeUseCase(
      deviceRepo,
      userRepo,
      hasher,
      commandRepo,
      pushPort,
      auditRepo,
      true,
      600,
    );

    const user = User.create({
      id: 'u-1',
      email: 'test@example.com',
      passwordHash: 'hashed_pw',
      fullName: 'Test User',
      createdAt: new Date(),
    });
    const device = Device.create({
      id: 'dev-1',
      ownerId: 'u-1',
      installId: 'inst-1',
      name: 'Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: 'fcm-token',
      adminEnabled: true,
      wipeEnabled: true,
    });

    vi.mocked(userRepo.findById).mockResolvedValue(user);
    vi.mocked(hasher.compare).mockResolvedValue(true);
    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    const cmd = await useCase.execute({
      deviceId: 'dev-1',
      callerUserId: 'u-1',
      password: 'ValidPassword123!',
      confirmationText: 'BORRAR',
    });

    expect(cmd.type).toBe(CommandType.WIPE);
    expect(cmd.status).toBe(CommandStatus.SENT);
    expect(pushPort.sendDataMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.WIPE,
        ttlSeconds: 600,
      }),
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REMOTE_WIPE_ATTEMPT',
        metadata: expect.objectContaining({ result: 'SUCCESS' }),
      }),
    );
  });
});
