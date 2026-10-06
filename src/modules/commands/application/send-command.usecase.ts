import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { DeviceMode } from '../../devices/domain/device.entity.js';
import { Command, CommandStatus, CommandType } from '../domain/command.entity.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { CommandPayloadValidator } from './command-payload.validator.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface SendCommandInput {
  deviceId: string;
  callerUserId: string;
  type: CommandType;
  payload?: any;
}

export class SendCommandUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly commandRepository: CommandRepository,
    private readonly pushNotificationPort: PushNotificationPort,
    private readonly commandTtlSeconds: number,
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

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.commandTtlSeconds * 1000);

    const command = Command.create({
      id: randomUUID(),
      deviceId: device.id,
      issuedById: input.callerUserId,
      type: input.type,
      payload: validatedPayload as Record<string, any>,
      status: CommandStatus.PENDING,
      createdAt: now,
      expiresAt,
    });

    const savedPending = await this.commandRepository.create(command);

    // Push notification delivery
    const pushResult = await this.pushNotificationPort.sendDataMessage({
      fcmToken: device.fcmToken,
      commandId: savedPending.id,
      type: input.type,
      payloadString: JSON.stringify(savedPending.payload ?? {}),
      issuedAt: now.toISOString(),
      ttlSeconds: this.commandTtlSeconds,
    });

    if (pushResult.success) {
      savedPending.markSent(new Date());
      await this.commandRepository.save(savedPending);
      return savedPending;
    }

    // If FCM rejects with unregistered or invalid token: clear device fcmToken and mark FAILED
    if (pushResult.error === 'FCM_TOKEN_INVALID') {
      device.updateDetails({ fcmToken: null });
      await this.deviceRepository.save(device);

      savedPending.markFailed('FCM_TOKEN_INVALID');
      await this.commandRepository.save(savedPending);

      throw new AppError(
        'DEVICE_NOT_REACHABLE',
        'Target device FCM token is invalid or unregistered',
        409,
      );
    }

    // Other FCM error: mark FAILED
    savedPending.markFailed(pushResult.details || 'FCM_DELIVERY_FAILED');
    await this.commandRepository.save(savedPending);

    throw new AppError(
      'DEVICE_NOT_REACHABLE',
      `FCM delivery failed: ${pushResult.details}`,
      409,
    );
  }
}
