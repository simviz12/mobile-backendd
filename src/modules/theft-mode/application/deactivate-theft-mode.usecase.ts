import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { TheftModeRepository } from '../domain/theft-mode.repository.js';
import { UserRepository } from '../../users/domain/user.repository.js';
import { PasswordHasher } from '../../auth/domain/auth-ports.js';
import { SendCommandUseCase } from '../../commands/application/send-command.usecase.js';
import { AuditEventRepository } from '../../commands/domain/audit-event.repository.js';
import { AuditEvent } from '../../commands/domain/audit-event.entity.js';
import { Command, CommandType } from '../../commands/domain/command.entity.js';
import { TheftMode } from '../domain/theft-mode.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface DeactivateTheftModeInput {
  deviceId: string;
  callerUserId: string;
  callerIp?: string;
  password: string;
  force?: boolean;
}

export interface DeactivateTheftModeOutput {
  theftMode: TheftMode;
  command: Command;
  forced: boolean;
}

export class DeactivateTheftModeUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly theftModeRepository: TheftModeRepository,
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sendCommandUseCase: SendCommandUseCase,
    private readonly auditEventRepository: AuditEventRepository,
  ) {}

  async execute(input: DeactivateTheftModeInput): Promise<DeactivateTheftModeOutput> {
    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const activeTheftMode = await this.theftModeRepository.findActiveByDeviceId(device.id);
    if (!activeTheftMode) {
      throw new AppError(
        'THEFT_MODE_NOT_ACTIVE',
        'Theft mode is not active on this device',
        404,
      );
    }

    // Verify password again (argon2)
    const user = await this.userRepository.findById(input.callerUserId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid password', 401);
    }

    const now = new Date();

    // Create THEFT_MODE_OFF command
    const command = await this.sendCommandUseCase.execute({
      deviceId: device.id,
      callerUserId: input.callerUserId,
      type: CommandType.THEFT_MODE_OFF,
    });

    const isForced = !!input.force;
    if (isForced) {
      activeTheftMode.deactivate(now);
      await this.theftModeRepository.save(activeTheftMode);

      device.setTheftModeActive(false);
      await this.deviceRepository.save(device);
    }

    // Write AuditEvent row for THEFT_MODE_OFF
    await this.auditEventRepository.create(
      AuditEvent.create({
        id: randomUUID(),
        userId: input.callerUserId,
        deviceId: device.id,
        action: 'THEFT_MODE_DEACTIVATED',
        metadata: {
          theftModeId: activeTheftMode.id,
          commandId: command.id,
          ip: input.callerIp ?? 'unknown',
          forced: isForced,
        },
        createdAt: now,
      }),
    );

    return {
      theftMode: activeTheftMode,
      command,
      forced: isForced,
    };
  }
}
