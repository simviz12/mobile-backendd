import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Device, DeviceMode } from '../domain/device.entity.js';
import { DeviceRepository } from '../domain/device.repository.js';
import { CommandRepository } from '../../commands/domain/command.repository.js';
import { LocationRepository } from '../../locations/domain/location.repository.js';
import { GetDeviceDiagnosticsUseCase } from './get-device-diagnostics.usecase.js';
import { UpdateDeviceCapabilitiesUseCase } from './update-device-capabilities.usecase.js';
import { AppError } from '../../../shared/errors/app-error.js';

describe('GetDeviceDiagnosticsUseCase & Capabilities (Unit Tests)', () => {
  let deviceRepo: DeviceRepository;
  let commandRepo: CommandRepository;
  let locationRepo: LocationRepository;
  let diagnosticsUseCase: GetDeviceDiagnosticsUseCase;
  let updateCapabilitiesUseCase: UpdateDeviceCapabilitiesUseCase;

  const heartbeatTimeout = 300;

  beforeEach(() => {
    deviceRepo = {
      findById: vi.fn(),
      findByOwnerAndInstallId: vi.fn(),
      findByTokenHash: vi.fn(),
      findAllByOwnerId: vi.fn(),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (d) => d),
      delete: vi.fn(),
    };

    commandRepo = {
      findById: vi.fn(),
      findAllByDeviceId: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      findExpiredPendingOrSent: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    locationRepo = {
      create: vi.fn(),
      createMany: vi.fn(),
      findLatestByDeviceId: vi.fn().mockResolvedValue(null),
      findAllByDeviceId: vi.fn().mockResolvedValue([]),
      deleteOlderThan: vi.fn(),
    };

    diagnosticsUseCase = new GetDeviceDiagnosticsUseCase(
      deviceRepo,
      commandRepo,
      locationRepo,
      heartbeatTimeout,
    );

    updateCapabilitiesUseCase = new UpdateDeviceCapabilitiesUseCase(
      deviceRepo,
      heartbeatTimeout,
    );
  });

  it('rejects cross-user diagnostics with 404 DEVICE_NOT_FOUND', async () => {
    const device = Device.create({
      id: 'd1',
      ownerId: 'owner-1',
      installId: 'inst-1',
      name: 'Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    await expect(diagnosticsUseCase.execute('d1', 'intruder-2')).rejects.toThrow(AppError);
  });

  it('detects problems: NO_FCM_TOKEN, NO_HEARTBEAT, NO_LOCATION, ADMIN_NOT_ENABLED', async () => {
    const device = Device.create({
      id: 'd1',
      ownerId: 'owner-1',
      installId: 'inst-1',
      name: 'Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: null,
      adminEnabled: false,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    const result = await diagnosticsUseCase.execute('d1', 'owner-1');

    expect(result.hasFcmToken).toBe(false);
    expect(result.lastSeenAt).toBeNull();
    expect(result.lastLocationAt).toBeNull();
    expect(result.problems).toContain('NO_FCM_TOKEN');
    expect(result.problems).toContain('NO_HEARTBEAT');
    expect(result.problems).toContain('NO_LOCATION');
    expect(result.problems).toContain('ADMIN_NOT_ENABLED');
  });

  it('detects denied permission problems when reported by device', async () => {
    const now = new Date();
    const device = Device.create({
      id: 'd1',
      ownerId: 'owner-1',
      installId: 'inst-1',
      name: 'Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: 'valid-fcm-token',
      deviceTokenHash: 'hash123',
      adminEnabled: true,
      lastSeenAt: now,
      permissions: {
        notifications: false,
        locationForeground: false,
        locationBackground: false,
        batteryOptimizationIgnored: false,
        deviceAdmin: true,
        fullScreenIntent: true,
      },
      createdAt: now,
      updatedAt: now,
    });

    vi.mocked(deviceRepo.findById).mockResolvedValue(device);
    vi.mocked(locationRepo.findLatestByDeviceId).mockResolvedValue({
      id: 'loc1',
      deviceId: 'd1',
      latitude: 4.6097,
      longitude: -74.0817,
      recordedAt: now,
      receivedAt: now,
      source: 'PERIODIC',
    } as any);

    const result = await diagnosticsUseCase.execute('d1', 'owner-1');

    expect(result.hasFcmToken).toBe(true);
    expect(result.hasDeviceToken).toBe(true);
    expect(result.problems).toContain('NOTIFICATIONS_DENIED');
    expect(result.problems).toContain('LOCATION_DENIED');
    expect(result.problems).toContain('BACKGROUND_LOCATION_DENIED');
    expect(result.problems).toContain('BATTERY_OPTIMIZED');
    expect(result.problems).not.toContain('NO_FCM_TOKEN');
    expect(result.problems).not.toContain('NO_HEARTBEAT');
    expect(result.problems).not.toContain('ADMIN_NOT_ENABLED');
  });

  it('updates permissions and device status via UpdateDeviceCapabilitiesUseCase', async () => {
    const device = Device.create({
      id: 'd1',
      ownerId: 'owner-1',
      installId: 'inst-1',
      name: 'Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      adminEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(deviceRepo.findById).mockResolvedValue(device);

    const result = await updateCapabilitiesUseCase.execute({
      deviceId: 'd1',
      authenticatingDeviceId: 'd1',
      adminEnabled: true,
      batteryLevel: 92,
      isCharging: true,
      permissions: {
        notifications: true,
        locationForeground: true,
        locationBackground: true,
        batteryOptimizationIgnored: true,
        deviceAdmin: true,
      },
    });

    expect(result.device.adminEnabled).toBe(true);
    expect(result.device.batteryLevel).toBe(92);
    expect(result.device.isCharging).toBe(true);
    expect(device.permissions?.notifications).toBe(true);
    expect(device.lastSeenAt).toBeInstanceOf(Date);
  });
});
