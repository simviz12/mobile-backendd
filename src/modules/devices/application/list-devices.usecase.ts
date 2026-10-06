import { DeviceRepository } from '../domain/device.repository.js';
import { Device } from '../domain/device.entity.js';

export class ListDevicesUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(ownerId: string): Promise<ReturnType<Device['toResponse']>[]> {
    const devices = await this.deviceRepository.findAllByOwnerId(ownerId);
    const now = new Date();
    return devices.map((d) => d.toResponse(this.heartbeatTimeoutSeconds, now));
  }
}
