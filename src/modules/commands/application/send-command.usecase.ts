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
  ) {}

  async execute(input: SendCommandInput): Promise<Command> {
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

    // Must have an fcmToken
    if (!device.fcmToken) {
      throw new AppError(
        'DEVICE_NOT_REACHABLE',
        'Target device has no registered FCM token',
        409,
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

    // Push notification delivery
    const pushResult = await this.pushNotificationPort.sendDataMessage({
      fcmToken: device.fcmToken,
      commandId: savedPending.id,
      type: input.type,
      payloadString: JSON.stringify(savedPending.payload ?? {}),
      issuedAt: now.toISOString(),
      ttlSeconds,
    });

    if (pushResult.success) {
      savedPending.markSent(new Date());
      await this.commandRepository.save(savedPending);
      this.logger.log(`Command ${savedPending.id} of type ${savedPending.type} successfully dispatched to device ${device.id}. MessageId: ${pushResult.messageId}`);
      return savedPending;
    }

    // If FCM rejects with unregistered or invalid token: clear device fcmToken and mark FAILED
    if (pushResult.error === 'FCM_TOKEN_INVALID') {
      device.updateDetails({ fcmToken: null });
      await this.deviceRepository.save(device);

      savedPending.markFailed('FCM_TOKEN_INVALID');
      await this.commandRepository.save(savedPending);
      this.logger.error(`Command ${savedPending.id} failed delivery: invalid or unregistered FCM token on device ${device.id}`);

      throw new AppError(
        'DEVICE_NOT_REACHABLE',
        'Target device FCM token is invalid or unregistered',
        409,
      );
    }

    // Other FCM error: mark FAILED
    savedPending.markFailed(pushResult.details || 'FCM_DELIVERY_FAILED');
    await this.commandRepository.save(savedPending);
    this.logger.error(`Command ${savedPending.id} failed delivery: ${pushResult.details || pushResult.error} on device ${device.id}`);

    throw new AppError(
      'DEVICE_NOT_REACHABLE',
      `FCM delivery failed: ${pushResult.details}`,
      409,
    );
  }
}
