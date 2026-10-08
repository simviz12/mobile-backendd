import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { EventPublisherPort } from '../../../shared/events/event-publisher.port.js';
import { CommandRepository } from '../domain/command.repository.js';
import { Command } from '../domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface AckCommandInput {
  commandId: string;
  authenticatingDeviceId: string;
  status: 'DELIVERED' | 'EXECUTED' | 'FAILED';
  reason?: string;
}

export class AckCommandUseCase {
  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly deviceRepository?: DeviceRepository,
    private readonly eventPublisher?: EventPublisherPort,
  ) {}

  async execute(input: AckCommandInput): Promise<Command> {
    const command = await this.commandRepository.findById(input.commandId);
    if (!command) {
      throw new AppError('COMMAND_NOT_FOUND', 'Command not found', 404);
    }

    // Device token must belong to the command's device
    if (command.deviceId !== input.authenticatingDeviceId) {
      throw new AppError(
        'FORBIDDEN',
        'Device is not the target of this command',
        403,
      );
    }

    // Idempotent transitions
    const now = new Date();
    switch (input.status) {
      case 'DELIVERED':
        command.markDelivered(now);
        break;
      case 'EXECUTED':
        command.markExecuted(now);
        break;
      case 'FAILED':
        command.markFailed(input.reason || 'DEVICE_EXECUTION_FAILED');
        break;
    }

    await this.commandRepository.save(command);

    // Refresh device lastSeenAt on authenticated call
    if (this.deviceRepository) {
      const device = await this.deviceRepository.findById(command.deviceId);
      if (device) {
        device.recordHeartbeat(now);
        device.setLastOnlineState(true);
        await this.deviceRepository.save(device);

        if (this.eventPublisher) {
          this.eventPublisher.publishToUser(device.ownerId, 'command.updated', {
            commandId: command.id,
            deviceId: command.deviceId,
            type: command.type,
            status: command.status,
            failureReason: command.failureReason ?? null,
            updatedAt: (command.executedAt ?? command.deliveredAt ?? now).toISOString(),
          });
        }
      }
    }

    return command;
  }
}
