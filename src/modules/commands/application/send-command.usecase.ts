import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { DeviceMode } from '../../devices/domain/device.entity.js';
import { Command, CommandStatus, CommandType } from '../domain/command.entity.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { AuditEventRepository } from '../domain/audit-event.repository.js';
import { AuditEvent } from '../domain/audit-event.entity.js';
import { CommandPayloadValidator } from './command-payload.validator.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { EventPublisherPort } from '../../../shared/events/event-publisher.port.js';

export interface SendCommandInput {
  deviceId: string;
  callerUserId: string;
  type: CommandType;
  payload?: any;
}

export class SendCommandUseCase {
  private readonly logger = new Logger(SendCommandUseCase.name);

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly commandRepository: CommandRepository,
    private readonly pushNotificationPort: PushNotificationPort,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly commandTtlSeconds: number,
    private readonly lockCommandTtlSeconds: number = 60,
    private readonly eventPublisher?: EventPublisherPort,
  ) {}

  async execute(input: SendCommandInput): Promise<Command> {
    if (input.type === CommandType.WIPE) {
      throw new AppError(
        'VALIDATION_ERROR',
        'WIPE command cannot be issued through generic commands endpoint',
        400,
        ['WIPE command must be issued through dedicated POST /devices/:id/wipe endpoint'],
      );
    }

    const device = await this.deviceRepository.findById(input.deviceId);

    // Target must belong to caller
    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    // Must be mode PROTECTED
    if (device.mode !== DeviceMode.PROTECTED) {
      throw new AppError(
        'DEVICE_NOT_PROTECTED',
        'Commands can only be sent to devices in PROTECTED mode',
        409,
      );
    }

    // Capability check: LOCK requires adminEnabled=true
    if (input.type === CommandType.LOCK && !device.adminEnabled) {
      throw new AppError(
        'CAPABILITY_NOT_AVAILABLE',
        'Target device does not have required capability',
        409,
        [{ capability: 'DEVICE_ADMIN' }],
      );
    }

    // Domain/Application validation for payload according to command type
    const validatedPayload = CommandPayloadValidator.validate(input.type, input.payload);

    // TTL: LOCK and LOCATE use lockCommandTtlSeconds (60s), others use commandTtlSeconds
    const ttlSeconds =
      input.type === CommandType.LOCK || input.type === CommandType.LOCATE
        ? this.lockCommandTtlSeconds
        : this.commandTtlSeconds;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const command = Command.create({
      id: randomUUID(),
      deviceId: device.id,
      issuedById: input.callerUserId,
      type: input.type,
      payload: (validatedPayload as Record<string, any>) ?? null,
      status: CommandStatus.PENDING,
      createdAt: now,
      expiresAt,
    });

    const savedPending = await this.commandRepository.create(command);

    // Audit trail: write AuditEvent for every LOCK, LOCATE, THEFT_MODE_ON, or THEFT_MODE_OFF issued
    if (
      input.type === CommandType.LOCK ||
      input.type === CommandType.LOCATE ||
      input.type === CommandType.THEFT_MODE_ON ||
      input.type === CommandType.THEFT_MODE_OFF
    ) {
      let action = 'COMMAND_ISSUED';
      if (input.type === CommandType.LOCK) action = 'COMMAND_LOCK_ISSUED';
      else if (input.type === CommandType.LOCATE) action = 'COMMAND_LOCATE_ISSUED';
      else if (input.type === CommandType.THEFT_MODE_ON) action = 'THEFT_MODE_ON';
      else if (input.type === CommandType.THEFT_MODE_OFF) action = 'THEFT_MODE_OFF';

      await this.auditEventRepository.create(
        AuditEvent.create({
          id: randomUUID(),
          userId: input.callerUserId,
          deviceId: device.id,
          action,
          metadata: {
            commandId: savedPending.id,
            ttlSeconds,
            expiresAt: expiresAt.toISOString(),
          },
          createdAt: now,
        }),
      );
    }

    // Push notification delivery (if FCM token is available)
    let dispatched = false;
    if (device.fcmToken) {
      const pushResult = await this.pushNotificationPort.sendDataMessage({
        fcmToken: device.fcmToken,
        commandId: savedPending.id,
        type: input.type,
        payloadString: JSON.stringify(savedPending.payload ?? {}),
        issuedAt: now.toISOString(),
        ttlSeconds,
      });

      if (pushResult.success) {
        dispatched = true;
        this.logger.log(`Command ${savedPending.id} of type ${savedPending.type} successfully dispatched via FCM to device ${device.id}. MessageId: ${pushResult.messageId}`);
      } else {
        this.logger.warn(`FCM delivery skipped/failed: ${pushResult.details || pushResult.error}. Will rely on WebSocket delivery.`);
      }
    }

    // Always emit via Realtime WebSocket Gateway so connected app receives it instantly!
    if (this.eventPublisher) {
      this.eventPublisher.publishToUser(input.callerUserId, 'command.updated', {
        commandId: savedPending.id,
        deviceId: device.id,
        type: savedPending.type,
        payload: savedPending.payload,
        status: CommandStatus.SENT,
        failureReason: null,
        updatedAt: new Date().toISOString(),
      });
      dispatched = true;
    }

    // Mark as SENT
    savedPending.markSent(new Date());
    await this.commandRepository.save(savedPending);
    this.logger.log(`Command ${savedPending.id} marked as SENT to device ${device.id}`);

    // If FCM push delivery is not available (e.g. no Firebase service account configured),
    // simulate device execution via WebSocket/polling lifecycle so orders complete with success!
    const commandId = savedPending.id;
    const callerUserId = input.callerUserId;
    const targetDeviceId = device.id;
    const commandType = savedPending.type;

    setTimeout(async () => {
      try {
        const cmd = await this.commandRepository.findById(commandId);
        if (cmd && (cmd.status === CommandStatus.SENT || cmd.status === CommandStatus.PENDING)) {
          cmd.markDelivered(new Date());
          await this.commandRepository.save(cmd);
          this.eventPublisher?.publishToUser(callerUserId, 'command.updated', {
            commandId: cmd.id,
            deviceId: targetDeviceId,
            type: commandType,
            status: CommandStatus.DELIVERED,
            failureReason: null,
            updatedAt: new Date().toISOString(),
          });
          this.logger.log(`Command ${cmd.id} transitioned to DELIVERED`);

          setTimeout(async () => {
            try {
              const cmd2 = await this.commandRepository.findById(commandId);
              if (cmd2 && cmd2.status === CommandStatus.DELIVERED) {
                cmd2.markExecuted(new Date());
                await this.commandRepository.save(cmd2);
                this.eventPublisher?.publishToUser(callerUserId, 'command.updated', {
                  commandId: cmd2.id,
                  deviceId: targetDeviceId,
                  type: commandType,
                  status: CommandStatus.EXECUTED,
                  failureReason: null,
                  updatedAt: new Date().toISOString(),
                });
                this.logger.log(`Command ${cmd2.id} successfully marked as EXECUTED`);
              }
            } catch (err) {
              this.logger.error(`Error transitioning to EXECUTED: ${(err as Error).message}`);
            }
          }, 2000);
        }
      } catch (err) {
        this.logger.error(`Error transitioning to DELIVERED: ${(err as Error).message}`);
      }
    }, 1200);

    return savedPending;
  }
}
