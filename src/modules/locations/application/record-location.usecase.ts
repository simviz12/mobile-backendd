import { LocationRepository } from '../domain/location.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Location, LocationSource } from '../domain/location.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface LocationItemInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  speedMps?: number | null;
  recordedAt: string | Date;
  source: LocationSource;
}

export interface RecordLocationInput {
  deviceId: string;
  authenticatingDeviceId: string;
  item?: LocationItemInput;
  locations?: LocationItemInput[];
}

export class RecordLocationUseCase {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(input: RecordLocationInput): Promise<Location[]> {
    if (input.deviceId !== input.authenticatingDeviceId) {
      throw new AppError('FORBIDDEN', 'Device is not allowed to record location for other devices', 403);
    }

    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const rawItems: LocationItemInput[] = [];
    if (input.locations && input.locations.length > 0) {
      if (input.locations.length > 50) {
        throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, [
          'Batch locations must not exceed 50 items',
        ]);
      }
      rawItems.push(...input.locations);
    } else if (input.item) {
      rawItems.push(input.item);
    } else {
      throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, [
        'Either single location fields or locations array must be provided',
      ]);
    }

    const now = new Date();
    const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const locationsToSave: Location[] = [];

    for (const [index, item] of rawItems.entries()) {
      const errors: string[] = [];

      if (typeof item.latitude !== 'number' || item.latitude < -90 || item.latitude > 90) {
        errors.push(`item[${index}].latitude must be between -90 and 90`);
      }
      if (typeof item.longitude !== 'number' || item.longitude < -180 || item.longitude > 180) {
        errors.push(`item[${index}].longitude must be between -180 and 180`);
      }

      const recDate = new Date(item.recordedAt);
      if (isNaN(recDate.getTime())) {
        errors.push(`item[${index}].recordedAt is an invalid date`);
      } else {
        if (recDate > fiveMinutesAhead) {
          errors.push(`item[${index}].recordedAt is in the future (>5 minutes ahead)`);
        }
        if (recDate < twentyFourHoursAgo) {
          errors.push(`item[${index}].recordedAt is older than 24 hours`);
        }
      }

      if (!Object.values(LocationSource).includes(item.source)) {
        errors.push(`item[${index}].source must be LOCATE_COMMAND, PERIODIC or THEFT_MODE`);
      }

      if (errors.length > 0) {
        throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, errors);
      }

      locationsToSave.push(
        Location.create({
          id: randomUUID(),
          deviceId: device.id,
          latitude: item.latitude,
          longitude: item.longitude,
          accuracyMeters: item.accuracyMeters ?? null,
          speedMps: item.speedMps ?? null,
          recordedAt: recDate,
          receivedAt: now,
          source: item.source,
        }),
      );
    }

    if (locationsToSave.length === 1) {
      const saved = await this.locationRepository.create(locationsToSave[0]);
      return [saved];
    } else {
      return this.locationRepository.createMany(locationsToSave);
    }
  }
}
