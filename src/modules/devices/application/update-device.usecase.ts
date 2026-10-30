import { DeviceRepository } from '../domain/device.repository.js';
import { Device } from '../domain/device.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface UpdateDeviceInput {
  deviceId: string;
  callerUserId: string;
  name?: string;
  fcmToken?: string;
}

export class UpdateDeviceUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(input: UpdateDeviceInput): Promise<ReturnType<Device['toResponse']>> {
    const device = await this.deviceRepository.findById(input.deviceId);

    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    device.updateDetails({
      name: input.name,
      fcmToken: input.fcmToken,
    });

    const saved = await this.deviceRepository.save(device);
    return saved.toResponse(this.heartbeatTimeoutSeconds, new Date());
  }
}
