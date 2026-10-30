import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { TheftModeRepository } from '../domain/theft-mode.repository.js';
import { SendCommandUseCase } from '../../commands/application/send-command.usecase.js';
import { AuditEventRepository } from '../../commands/domain/audit-event.repository.js';
import { AuditEvent } from '../../commands/domain/audit-event.entity.js';
import { TheftMode } from '../domain/theft-mode.entity.js';
import { Command, CommandType } from '../../commands/domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface ActivateTheftModeInput {
  deviceId: string;
  callerUserId: string;
  callerIp?: string;
  message: string;
  contactPhone?: string;
  locationIntervalSeconds: number;
  alarm: boolean;
  lock: boolean;
}

export interface ActivateTheftModeOutput {
  theftMode: TheftMode;
  command: Command;
}

export class ActivateTheftModeUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly theftModeRepository: TheftModeRepository,
    private readonly sendCommandUseCase: SendCommandUseCase,
    private readonly auditEventRepository: AuditEventRepository,
  ) {}

  async execute(input: ActivateTheftModeInput): Promise<ActivateTheftModeOutput> {
    const device = await this.deviceRepository.findById(input.deviceId);

    // Ownership check: strict 404
    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    // Capability check: If lock=true and adminEnabled=false -> 409 CAPABILITY_NOT_AVAILABLE
    if (input.lock && !device.adminEnabled) {
      throw new AppError(
        'CAPABILITY_NOT_AVAILABLE',
        'Device cannot activate theft mode with lock because device admin is not enabled',
        409,
        [{ capability: 'DEVICE_ADMIN' }],
      );
    }

    // Single active theft mode check
    const existingActive = await this.theftModeRepository.findActiveByDeviceId(device.id);
    if (existingActive) {
      throw new AppError(
        'THEFT_MODE_ALREADY_ACTIVE',
        'Theft mode is already active on this device',
        409,
      );
    }

    const now = new Date();
    const theftMode = TheftMode.create({
      id: randomUUID(),
      deviceId: device.id,
      activatedById: input.callerUserId,
      activatedAt: now,
      message: input.message,
      contactPhone: input.contactPhone ?? null,
      locationIntervalSeconds: input.locationIntervalSeconds,
      alarm: input.alarm,
      lock: input.lock,
    });

    // Send single atomic THEFT_MODE_ON command to device
    const command = await this.sendCommandUseCase.execute({
      deviceId: device.id,
      callerUserId: input.callerUserId,
      type: CommandType.THEFT_MODE_ON,
      payload: {
        message: input.message,
        contactPhone: input.contactPhone,
        locationIntervalSeconds: input.locationIntervalSeconds,
        alarm: input.alarm,
        lock: input.lock,
      },
    });

    // Save TheftMode record in DB
    const savedTheftMode = await this.theftModeRepository.create(theftMode);

    // Update device theftModeActive flag
    device.setTheftModeActive(true);
    await this.deviceRepository.save(device);

    // Write AuditEvent row for THEFT_MODE_ON with issuing user and IP
    await this.auditEventRepository.create(
      AuditEvent.create({
        id: randomUUID(),
        userId: input.callerUserId,
        deviceId: device.id,
        action: 'THEFT_MODE_ACTIVATED',
        metadata: {
          theftModeId: savedTheftMode.id,
          commandId: command.id,
          ip: input.callerIp ?? 'unknown',
          alarm: input.alarm,
          lock: input.lock,
          locationIntervalSeconds: input.locationIntervalSeconds,
        },
        createdAt: now,
      }),
    );

    return {
      theftMode: savedTheftMode,
      command,
    };
  }
}
