import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DEVICE_REPOSITORY } from '../domain/device.repository.js';
import type { DeviceRepository } from '../domain/device.repository.js';
import { EVENT_PUBLISHER_PORT } from '../../../shared/events/event-publisher.port.js';
import type { EventPublisherPort } from '../../../shared/events/event-publisher.port.js';

@Injectable()
export class DeviceHeartbeatJob {
  private readonly logger = new Logger(DeviceHeartbeatJob.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
    @Inject(EVENT_PUBLISHER_PORT)
    private readonly eventPublisher: EventPublisherPort,
    private readonly configService: ConfigService,
  ) {}

  @Cron('*/30 * * * * *') // Every 30 seconds
  async checkHeartbeats(controlledNow?: Date): Promise<number> {
    const timeoutSeconds = this.configService.get<number>(
      'HEARTBEAT_TIMEOUT_SECONDS',
      300,
    );
    const now = controlledNow ?? new Date();

    const devices = await this.deviceRepository.findAll();
    let transitionedCount = 0;

    for (const device of devices) {
      const isCurrentlyOnline = device.isOnline(timeoutSeconds, now);
      const wasOnline = device.lastOnlineState ?? false;

      // Detect transition from online to offline
      if (wasOnline && !isCurrentlyOnline) {
        device.setLastOnlineState(false);
        await this.deviceRepository.save(device);
        transitionedCount++;

        this.logger.log(
          `Device ${device.id} transitioned to OFFLINE (lastSeenAt: ${device.lastSeenAt?.toISOString()})`,
        );

        // Emit device.status offline event ONCE
        this.eventPublisher.publishToUser(device.ownerId, 'device.status', {
          deviceId: device.id,
          isOnline: false,
          batteryLevel: device.batteryLevel,
          isCharging: device.isCharging,
          networkType: device.networkType,
          lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        });
      } else if (!wasOnline && isCurrentlyOnline) {
        // Transition from offline to online
        device.setLastOnlineState(true);
        await this.deviceRepository.save(device);
        transitionedCount++;

        this.logger.log(
          `Device ${device.id} transitioned to ONLINE (lastSeenAt: ${device.lastSeenAt?.toISOString()})`,
        );

        this.eventPublisher.publishToUser(device.ownerId, 'device.status', {
          deviceId: device.id,
          isOnline: true,
          batteryLevel: device.batteryLevel,
          isCharging: device.isCharging,
          networkType: device.networkType,
          lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        });
      }
    }

    return transitionedCount;
  }
}
