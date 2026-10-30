import { DeviceRepository } from '../domain/device.repository.js';
import { EventPublisherPort } from '../../../shared/events/event-publisher.port.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface UnlinkDeviceInput {
  deviceId: string;
  callerUserId: string;
}

export class UnlinkDeviceUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly eventPublisher?: EventPublisherPort,
  ) {}

  async execute(input: UnlinkDeviceInput): Promise<void> {
    const device = await this.deviceRepository.findById(input.deviceId);

    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    // Unlinking invalidates device token and deletes the device
    await this.deviceRepository.delete(input.deviceId);

    if (this.eventPublisher) {
      this.eventPublisher.publishToUser(device.ownerId, 'device.unlinked', {
        deviceId: device.id,
        ownerId: device.ownerId,
      });
    }
  }
}
