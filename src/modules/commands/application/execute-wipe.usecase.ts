import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { DeviceMode } from '../../devices/domain/device.entity.js';
import { UserRepository } from '../../users/domain/user.repository.js';
import { PasswordHasher } from '../../auth/domain/auth-ports.js';
import { CommandRepository } from '../domain/command.repository.js';
import { PushNotificationPort } from '../domain/push-notification.port.js';
import { AuditEventRepository } from '../domain/audit-event.repository.js';
import { AuditEvent } from '../domain/audit-event.entity.js';
import { Command, CommandStatus, CommandType } from '../domain/command.entity.js';
import { VerifyActionTwoFactorUseCase } from '../../auth/application/verify-action-two-factor.usecase.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface ExecuteWipeInput {
  deviceId: string;
  callerUserId: string;
  password: string;
  confirmationText: string;
  twoFactorCode?: string;
  callerIp?: string;
  userAgent?: string;
}

export class ExecuteWipeUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly commandRepository: CommandRepository,
    private readonly pushNotificationPort: PushNotificationPort,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly allowRemoteWipe: boolean,
    private readonly wipeCommandTtlSeconds: number = 600,
    private readonly verifyActionTwoFactorUseCase?: VerifyActionTwoFactorUseCase,
  ) {}

  async execute(input: ExecuteWipeInput): Promise<Command> {
    const now = new Date();
    const ip = input.callerIp ?? 'unknown';
    const userAgent = input.userAgent ?? 'unknown';

    // Helper to log audit event on failure
    const logFailureAudit = async (result: string, metadata: Record<string, any> = {}) => {
      await this.auditEventRepository.create(
        AuditEvent.create({
          id: randomUUID(),
          userId: input.callerUserId,
          deviceId: input.deviceId,
          action: 'REMOTE_WIPE_ATTEMPT',
          metadata: {
            result,
            ip,
            userAgent,
            ...metadata,
          },
          createdAt: now,
        }),
      );
    };

    // 1. Check safety switch env ALLOW_REMOTE_WIPE
    if (!this.allowRemoteWipe) {
      await logFailureAudit('WIPE_DISABLED');
      throw new AppError(
        'WIPE_DISABLED',
        'Remote wipe is disabled on this server. Contact system administrator.',
        403,
      );
    }

    // 2. Validate confirmationText exactly "BORRAR" (case-sensitive)
    if (input.confirmationText !== 'BORRAR') {
      await logFailureAudit('INVALID_CONFIRMATION_TEXT', {
        providedConfirmation: input.confirmationText,
      });
      throw new AppError(
        'VALIDATION_ERROR',
        'Confirmation text must equal exactly "BORRAR"',
        400,
        ['confirmationText must equal "BORRAR"'],
      );
    }

    // 3. Re-verify user password with Argon2
    const user = await this.userRepository.findById(input.callerUserId);
    if (!user) {
      await logFailureAudit('USER_NOT_FOUND');
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await logFailureAudit('INVALID_CREDENTIALS');
      throw new AppError('INVALID_CREDENTIALS', 'Invalid password', 401);
    }

    // Verify 2FA code if 2FA is enabled
    if (this.verifyActionTwoFactorUseCase) {
      try {
        await this.verifyActionTwoFactorUseCase.execute({
          userId: input.callerUserId,
          twoFactorCode: input.twoFactorCode,
        });
      } catch (err: any) {
        await logFailureAudit(err.code || 'TWO_FACTOR_INVALID');
        throw err;
      }
    }

    // 4. Device checks (ownership, mode PROTECTED, reachable by FCM, adminEnabled=true)
    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device || !device.belongsTo(input.callerUserId)) {
      await logFailureAudit('DEVICE_NOT_FOUND');
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    if (device.mode !== DeviceMode.PROTECTED) {
      await logFailureAudit('DEVICE_NOT_PROTECTED');
      throw new AppError(
        'DEVICE_NOT_PROTECTED',
        'Commands can only be sent to devices in PROTECTED mode',
        409,
      );
    }

    if (!device.adminEnabled) {
      await logFailureAudit('CAPABILITY_NOT_AVAILABLE', { capability: 'DEVICE_ADMIN_WIPE' });
      throw new AppError(
        'CAPABILITY_NOT_AVAILABLE',
        'Device does not have Device Admin enabled for remote wipe',
        409,
        [{ capability: 'DEVICE_ADMIN_WIPE' }],
      );
    }

    // 5. Create WIPE Command with TTL WIPE_COMMAND_TTL_SECONDS (default 600)
    const ttlSeconds = this.wipeCommandTtlSeconds;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const command = Command.create({
      id: randomUUID(),
      deviceId: device.id,
      issuedById: input.callerUserId,
      type: CommandType.WIPE,
      payload: null,
      status: CommandStatus.PENDING,
      createdAt: now,
      expiresAt,
    });

    const savedPending = await this.commandRepository.create(command);

    // 6. Push notification delivery (if FCM token exists)
    if (device.fcmToken) {
      await this.pushNotificationPort.sendDataMessage({
        fcmToken: device.fcmToken,
        commandId: savedPending.id,
        type: CommandType.WIPE,
        payloadString: JSON.stringify({}),
        issuedAt: now.toISOString(),
        ttlSeconds,
      });
    }

    savedPending.markSent(new Date());
    await this.commandRepository.save(savedPending);

    // Audit success
    await this.auditEventRepository.create(
      AuditEvent.create({
        id: randomUUID(),
        userId: input.callerUserId,
        deviceId: device.id,
        action: 'REMOTE_WIPE_ATTEMPT',
        metadata: {
          result: 'SUCCESS',
          commandId: savedPending.id,
          ip,
          userAgent,
          ttlSeconds,
        },
        createdAt: now,
      }),
    );

    return savedPending;
  }
}
