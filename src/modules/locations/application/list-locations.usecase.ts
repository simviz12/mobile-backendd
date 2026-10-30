import { LocationRepository } from '../domain/location.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Location } from '../domain/location.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface ListLocationsInput {
  deviceId: string;
  callerUserId: string;
  from?: string;
  to?: string;
  limit?: number;
}

export class ListLocationsUseCase {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(input: ListLocationsInput): Promise<Location[]> {
    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const fromDate = input.from ? new Date(input.from) : undefined;
    const toDate = input.to ? new Date(input.to) : undefined;

    return this.locationRepository.findAllByDeviceId(input.deviceId, {
      from: fromDate,
      to: toDate,
      limit: input.limit ?? 50,
    });
  }
}
