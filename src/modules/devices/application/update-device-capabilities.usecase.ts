import { DeviceRepository } from '../domain/device.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface UpdateDeviceCapabilitiesInput {
  deviceId: string;
  authenticatingDeviceId: string;
  adminEnabled: boolean;
}

export class UpdateDeviceCapabilitiesUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(input: UpdateDeviceCapabilitiesInput) {
    if (input.deviceId !== input.authenticatingDeviceId) {
      throw new AppError('FORBIDDEN', 'Device is not allowed to update other devices', 403);
    }

    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    device.updateCapabilities({ adminEnabled: input.adminEnabled });
    const saved = await this.deviceRepository.save(device);

    return {
      device: saved.toResponse(this.heartbeatTimeoutSeconds),
    };
  }
}
