import { DeviceRepository } from '../domain/device.repository.js';
import { EventPublisherPort } from '../../../shared/events/event-publisher.port.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface ReportDeviceStatusInput {
  deviceId: string;
  authenticatingDeviceId: string;
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'wifi' | 'mobile' | 'none' | 'unknown';
  appVersion?: string;
}

export class ReportDeviceStatusUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly eventPublisher: EventPublisherPort,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(input: ReportDeviceStatusInput): Promise<void> {
    if (input.deviceId !== input.authenticatingDeviceId) {
      throw new AppError('FORBIDDEN', 'Device is not allowed to update other devices', 403);
    }

    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const now = new Date();
    device.updateStatus({
      batteryLevel: input.batteryLevel,
      isCharging: input.isCharging,
      networkType: input.networkType,
      appVersion: input.appVersion,
      now,
    });

    // Mark online state in entity and DB
    device.setLastOnlineState(true);

    await this.deviceRepository.save(device);

    // Emit device.status event to device owner
    this.eventPublisher.publishToUser(device.ownerId, 'device.status', {
      deviceId: device.id,
      isOnline: true,
      batteryLevel: device.batteryLevel,
      isCharging: device.isCharging,
      networkType: device.networkType,
      lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : now.toISOString(),
    });
  }
}
