import { LocationRepository } from '../domain/location.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Location } from '../domain/location.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface GetLatestLocationInput {
  deviceId: string;
  callerUserId: string;
}

export class GetLatestLocationUseCase {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(input: GetLatestLocationInput): Promise<Location> {
    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const latest = await this.locationRepository.findLatestByDeviceId(input.deviceId);
    if (!latest) {
      throw new AppError('NO_LOCATION_YET', 'No location has been recorded for this device yet', 404);
    }

    return latest;
  }
}
