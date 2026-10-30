import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivateTheftModeUseCase } from './activate-theft-mode.usecase.js';
import { DeactivateTheftModeUseCase } from './deactivate-theft-mode.usecase.js';
import { TheftMode } from '../domain/theft-mode.entity.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';
import { Command, CommandStatus, CommandType } from '../../commands/domain/command.entity.js';

describe('Theft Mode Unit Tests', () => {
  let mockDeviceRepo: any;
  let mockTheftModeRepo: any;
  let mockSendCommandUseCase: any;
  let mockAuditRepo: any;
  let mockUserRepo: any;
  let mockPasswordHasher: any;

  let activateUseCase: ActivateTheftModeUseCase;
  let deactivateUseCase: DeactivateTheftModeUseCase;

  beforeEach(() => {
    mockDeviceRepo = {
      findById: vi.fn(),
      save: vi.fn().mockImplementation((dev) => Promise.resolve(dev)),
    };
    mockTheftModeRepo = {
      findActiveByDeviceId: vi.fn(),
      findHistoryByDeviceId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn().mockImplementation((tm) => Promise.resolve(tm)),
      save: vi.fn().mockImplementation((tm) => Promise.resolve(tm)),
    };
    mockSendCommandUseCase = {
      execute: vi.fn().mockResolvedValue(
        Command.create({
          id: 'cmd-theft-1',
          deviceId: 'dev-1',
          issuedById: 'user-1',
          type: CommandType.THEFT_MODE_ON,
          status: CommandStatus.SENT,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 120000),
        }),
      ),
    };
    mockAuditRepo = {
      create: vi.fn().mockResolvedValue(undefined),
    };
    mockUserRepo = {
      findById: vi.fn(),
    };
    mockPasswordHasher = {
      compare: vi.fn(),
      hash: vi.fn(),
    };

    activateUseCase = new ActivateTheftModeUseCase(
      mockDeviceRepo,
      mockTheftModeRepo,
      mockSendCommandUseCase,
      mockAuditRepo,
    );

    deactivateUseCase = new DeactivateTheftModeUseCase(
      mockDeviceRepo,
      mockTheftModeRepo,
      mockUserRepo,
      mockPasswordHasher,
      mockSendCommandUseCase,
      mockAuditRepo,
    );
  });

  const createProtectedDevice = (overrides: Partial<any> = {}) =>
    Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel 8',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: 'fcm-token-123',
      adminEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

  describe('ActivateTheftModeUseCase', () => {
    it('should activate theft mode and dispatch single atomic command', async () => {
      const device = createProtectedDevice();
      mockDeviceRepo.findById.mockResolvedValue(device);
      mockTheftModeRepo.findActiveByDeviceId.mockResolvedValue(null);

      const result = await activateUseCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
        callerIp: '127.0.0.1',
        message: 'Phone stolen, return to owner',
        contactPhone: '+123456789',
        locationIntervalSeconds: 60,
        alarm: true,
        lock: true,
      });

      expect(result.theftMode).toBeDefined();
      expect(result.theftMode.message).toBe('Phone stolen, return to owner');
      expect(result.command).toBeDefined();
      expect(mockSendCommandUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'dev-1',
          type: CommandType.THEFT_MODE_ON,
          payload: {
            message: 'Phone stolen, return to owner',
            contactPhone: '+123456789',
            locationIntervalSeconds: 60,
            alarm: true,
            lock: true,
          },
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalled();
      expect(device.theftModeActive).toBe(true);
    });

    it('should reject when lock=true but device adminEnabled=false', async () => {
      const device = createProtectedDevice({ adminEnabled: false });
      mockDeviceRepo.findById.mockResolvedValue(device);

      await expect(
        activateUseCase.execute({
          deviceId: 'dev-1',
          callerUserId: 'user-1',
          message: 'Phone stolen',
          locationIntervalSeconds: 60,
          alarm: false,
          lock: true,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'CAPABILITY_NOT_AVAILABLE',
          statusCode: 409,
        }),
      );
    });

    it('should reject when theft mode is already active (single-active rule)', async () => {
      const device = createProtectedDevice();
      mockDeviceRepo.findById.mockResolvedValue(device);
      mockTheftModeRepo.findActiveByDeviceId.mockResolvedValue(
        TheftMode.create({
          id: 'tm-active',
          deviceId: 'dev-1',
          activatedById: 'user-1',
          activatedAt: new Date(),
          message: 'Active already',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        }),
      );

      await expect(
        activateUseCase.execute({
          deviceId: 'dev-1',
          callerUserId: 'user-1',
          message: 'Another attempt',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'THEFT_MODE_ALREADY_ACTIVE',
          statusCode: 409,
        }),
      );
    });
  });

  describe('DeactivateTheftModeUseCase', () => {
    it('should reject with 401 INVALID_CREDENTIALS when password check fails', async () => {
      const device = createProtectedDevice({ theftModeActive: true });
      mockDeviceRepo.findById.mockResolvedValue(device);
      mockTheftModeRepo.findActiveByDeviceId.mockResolvedValue(
        TheftMode.create({
          id: 'tm-1',
          deviceId: 'dev-1',
          activatedById: 'user-1',
          activatedAt: new Date(),
          message: 'Active',
          locationIntervalSeconds: 60,
          alarm: true,
          lock: true,
        }),
      );
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'argon_hash',
      });
      mockPasswordHasher.compare.mockResolvedValue(false);

      await expect(
        deactivateUseCase.execute({
          deviceId: 'dev-1',
          callerUserId: 'user-1',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        }),
      );
    });

    it('should create THEFT_MODE_OFF command on correct password and keep active if force=false', async () => {
      const device = createProtectedDevice({ theftModeActive: true });
      mockDeviceRepo.findById.mockResolvedValue(device);
      const activeTm = TheftMode.create({
        id: 'tm-1',
        deviceId: 'dev-1',
        activatedById: 'user-1',
        activatedAt: new Date(),
        message: 'Active',
        locationIntervalSeconds: 60,
        alarm: true,
        lock: true,
      });
      mockTheftModeRepo.findActiveByDeviceId.mockResolvedValue(activeTm);
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'argon_hash',
      });
      mockPasswordHasher.compare.mockResolvedValue(true);

      const result = await deactivateUseCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
        password: 'ValidPassword123!',
        force: false,
      });

      expect(result.forced).toBe(false);
      expect(activeTm.isActive).toBe(true);
      expect(mockSendCommandUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'dev-1',
          type: CommandType.THEFT_MODE_OFF,
        }),
      );
    });

    it('should immediately deactivate in DB when force=true', async () => {
      const device = createProtectedDevice({ theftModeActive: true });
      mockDeviceRepo.findById.mockResolvedValue(device);
      const activeTm = TheftMode.create({
        id: 'tm-1',
        deviceId: 'dev-1',
        activatedById: 'user-1',
        activatedAt: new Date(),
        message: 'Active',
        locationIntervalSeconds: 60,
        alarm: true,
        lock: true,
      });
      mockTheftModeRepo.findActiveByDeviceId.mockResolvedValue(activeTm);
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'argon_hash',
      });
      mockPasswordHasher.compare.mockResolvedValue(true);

      const result = await deactivateUseCase.execute({
        deviceId: 'dev-1',
        callerUserId: 'user-1',
        password: 'ValidPassword123!',
        force: true,
      });

      expect(result.forced).toBe(true);
      expect(activeTm.isActive).toBe(false);
      expect(activeTm.deactivatedAt).toBeDefined();
      expect(device.theftModeActive).toBe(false);
      expect(mockTheftModeRepo.save).toHaveBeenCalled();
      expect(mockDeviceRepo.save).toHaveBeenCalled();
    });
  });
});
