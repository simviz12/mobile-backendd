import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordLocationUseCase } from './record-location.usecase.js';
import { LocationRepository } from '../domain/location.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Device, DeviceMode } from '../../devices/domain/device.entity.js';
import { LocationSource } from '../domain/location.entity.js';

describe('RecordLocationUseCase (Unit Tests)', () => {
  let locationRepo: LocationRepository;
  let deviceRepo: DeviceRepository;
  let useCase: RecordLocationUseCase;

  const createDevice = () => {
    return Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel 8',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      fcmToken: 'valid_token',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    locationRepo = {
      create: vi.fn().mockImplementation(async (l) => l),
      createMany: vi.fn().mockImplementation(async (ls) => ls),
      findLatestByDeviceId: vi.fn(),
      findAllByDeviceId: vi.fn(),
      deleteOlderThan: vi.fn(),
    };
    deviceRepo = {
      findById: vi.fn().mockResolvedValue(createDevice()),
      findByOwnerAndInstallId: vi.fn(),
      findByTokenHash: vi.fn(),
      findAllByOwnerId: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new RecordLocationUseCase(locationRepo, deviceRepo);
  });

  it('records single valid location successfully', async () => {
    const now = new Date().toISOString();
    const result = await useCase.execute({
      deviceId: 'dev-1',
      authenticatingDeviceId: 'dev-1',
      item: {
        latitude: 4.6097,
        longitude: -74.0817,
        accuracyMeters: 5,
        speedMps: 1.5,
        recordedAt: now,
        source: LocationSource.LOCATE_COMMAND,
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBe(4.6097);
    expect(result[0].longitude).toBe(-74.0817);
    expect(locationRepo.create).toHaveBeenCalled();
  });

  it('records batch of locations up to 50 items successfully', async () => {
    const now = new Date().toISOString();
    const batch = Array.from({ length: 10 }, (_, i) => ({
      latitude: 4.0 + i * 0.01,
      longitude: -74.0 - i * 0.01,
      accuracyMeters: 10,
      speedMps: 0,
      recordedAt: now,
      source: LocationSource.PERIODIC,
    }));

    const result = await useCase.execute({
      deviceId: 'dev-1',
      authenticatingDeviceId: 'dev-1',
      locations: batch,
    });

    expect(result).toHaveLength(10);
    expect(locationRepo.createMany).toHaveBeenCalled();
  });

  it('rejects batch exceeding 50 items with 400 VALIDATION_ERROR', async () => {
    const now = new Date().toISOString();
    const batch = Array.from({ length: 51 }, () => ({
      latitude: 4.0,
      longitude: -74.0,
      recordedAt: now,
      source: LocationSource.PERIODIC,
    }));

    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        authenticatingDeviceId: 'dev-1',
        locations: batch,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('rejects out-of-range coordinates (latitude > 90)', async () => {
    const now = new Date().toISOString();
    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        authenticatingDeviceId: 'dev-1',
        item: {
          latitude: 91.0,
          longitude: -74.0,
          recordedAt: now,
          source: LocationSource.LOCATE_COMMAND,
        },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('rejects recordedAt more than 5 minutes in the future', async () => {
    const future = new Date(Date.now() + 6 * 60 * 1000).toISOString();
    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        authenticatingDeviceId: 'dev-1',
        item: {
          latitude: 4.0,
          longitude: -74.0,
          recordedAt: future,
          source: LocationSource.LOCATE_COMMAND,
        },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('rejects recordedAt older than 24 hours', async () => {
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        authenticatingDeviceId: 'dev-1',
        item: {
          latitude: 4.0,
          longitude: -74.0,
          recordedAt: past,
          source: LocationSource.LOCATE_COMMAND,
        },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('rejects when authenticating device does not match URL deviceId with 403 FORBIDDEN', async () => {
    await expect(
      useCase.execute({
        deviceId: 'dev-1',
        authenticatingDeviceId: 'dev-2',
        item: {
          latitude: 4.0,
          longitude: -74.0,
          recordedAt: new Date().toISOString(),
          source: LocationSource.LOCATE_COMMAND,
        },
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });
});
