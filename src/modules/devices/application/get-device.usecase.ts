import { DeviceRepository } from '../domain/device.repository.js';
import { Device } from '../domain/device.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export class GetDeviceUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(
    deviceId: string,
    callerUserId: string,
  ): Promise<ReturnType<Device['toResponse']>> {
    const device = await this.deviceRepository.findById(deviceId);

    // Strict ownership: 404 DEVICE_NOT_FOUND if not found or belongs to someone else
    if (!device || !device.belongsTo(callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    return device.toResponse(this.heartbeatTimeoutSeconds, new Date());
  }
}
