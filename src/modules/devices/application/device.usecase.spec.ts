import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Device, DeviceMode } from '../domain/device.entity.js';
import { LinkDeviceUseCase } from './link-device.usecase.js';
import { DeviceRepository } from '../domain/device.repository.js';
import { DeviceTokenGenerator } from '../domain/device-token.generator.js';

describe('Devices Unit Tests', () => {
  let deviceRepo: DeviceRepository;
  let tokenGenerator: DeviceTokenGenerator;
  const heartbeatTimeout = 300;

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
    tokenGenerator = {
      generateToken: vi.fn().mockReturnValue('raw_256_bit_token'),
      hashToken: vi.fn().mockImplementation((t: string) => `hash_${t}`),
    };
  });

  describe('Device Entity - isOnline Rule with controlled clock', () => {
    it('should be offline when lastSeenAt is null', () => {
      const device = Device.create({
        id: 'd1',
        ownerId: 'u1',
        installId: 'inst1',
        name: 'Phone 1',
        platform: 'android',
        mode: DeviceMode.PROTECTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(device.isOnline(heartbeatTimeout, new Date())).toBe(false);
    });

    it('should be online when lastSeenAt is within HEARTBEAT_TIMEOUT_SECONDS', () => {
      const now = new Date('2026-10-06T12:00:00Z');
      const lastSeenAt = new Date('2026-10-06T11:57:00Z'); // 180 seconds ago <= 300s

      const device = Device.create({
        id: 'd1',
        ownerId: 'u1',
        installId: 'inst1',
        name: 'Phone 1',
        platform: 'android',
        mode: DeviceMode.PROTECTED,
        lastSeenAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(device.isOnline(heartbeatTimeout, now)).toBe(true);
    });

    it('should be offline when lastSeenAt exceeds HEARTBEAT_TIMEOUT_SECONDS', () => {
      const now = new Date('2026-10-06T12:00:00Z');
      const lastSeenAt = new Date('2026-10-06T11:54:00Z'); // 360 seconds ago > 300s

      const device = Device.create({
        id: 'd1',
        ownerId: 'u1',
        installId: 'inst1',
        name: 'Phone 1',
        platform: 'android',
        mode: DeviceMode.PROTECTED,
        lastSeenAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(device.isOnline(heartbeatTimeout, now)).toBe(false);
    });
  });

  describe('LinkDeviceUseCase', () => {
    it('should create new device and return raw deviceToken and isNew=true', async () => {
      vi.mocked(deviceRepo.findByOwnerAndInstallId).mockResolvedValue(null);
      vi.mocked(deviceRepo.create).mockImplementation(async (d) => d);

      const useCase = new LinkDeviceUseCase(deviceRepo, tokenGenerator, heartbeatTimeout);
      const result = await useCase.execute({
        ownerId: 'u1',
        installId: 'inst-1',
        name: 'Pixel 8',
        platform: 'android',
        mode: DeviceMode.PROTECTED,
      });

      expect(result.isNew).toBe(true);
      expect(result.deviceToken).toBe('raw_256_bit_token');
      expect(result.device.name).toBe('Pixel 8');
      expect(result.device.batteryLevel).toBeNull();
      expect(result.device.isOnline).toBe(false);
      expect(deviceRepo.create).toHaveBeenCalled();
    });

    it('should idempotently re-link existing installId, update name, rotate token, and return isNew=false', async () => {
      const existing = Device.create({
        id: 'd-existing',
        ownerId: 'u1',
        installId: 'inst-1',
        name: 'Old Name',
        platform: 'android',
        mode: DeviceMode.PROTECTED,
        deviceTokenHash: 'old_hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(deviceRepo.findByOwnerAndInstallId).mockResolvedValue(existing);
      vi.mocked(deviceRepo.save).mockImplementation(async (d) => d);

      const useCase = new LinkDeviceUseCase(deviceRepo, tokenGenerator, heartbeatTimeout);
      const result = await useCase.execute({
        ownerId: 'u1',
        installId: 'inst-1',
        name: 'New Name',
        platform: 'android',
        mode: DeviceMode.PROTECTED,
      });

      expect(result.isNew).toBe(false);
      expect(result.deviceToken).toBe('raw_256_bit_token');
      expect(result.device.name).toBe('New Name');
      expect(deviceRepo.save).toHaveBeenCalled();
      expect(deviceRepo.create).not.toHaveBeenCalled();
    });
  });
});
