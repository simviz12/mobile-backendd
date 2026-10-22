import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicesModule } from '../devices/devices.module.js';
import { DEVICE_REPOSITORY } from '../devices/domain/device.repository.js';
import { DeviceRepository } from '../devices/domain/device.repository.js';
import { COMMAND_REPOSITORY } from './domain/command.repository.js';
import { PrismaCommandRepository } from './infrastructure/prisma-command.repository.js';
import { PUSH_NOTIFICATION_PORT } from './domain/push-notification.port.js';
import { FirebasePushAdapter } from './infrastructure/firebase-push.adapter.js';
import { CommandRepository } from './domain/command.repository.js';
import { PushNotificationPort } from './domain/push-notification.port.js';
import { AUDIT_EVENT_REPOSITORY } from './domain/audit-event.repository.js';
import { AuditEventRepository } from './domain/audit-event.repository.js';
import { PrismaAuditEventRepository } from './infrastructure/prisma-audit-event.repository.js';
import { SendCommandUseCase } from './application/send-command.usecase.js';
import { SendRingCommandUseCase } from './application/send-ring-command.usecase.js';
import { ListDeviceCommandsUseCase } from './application/list-device-commands.usecase.js';
import { GetCommandUseCase } from './application/get-command.usecase.js';
import { AckCommandUseCase } from './application/ack-command.usecase.js';
import { ExecuteWipeUseCase } from './application/execute-wipe.usecase.js';
import { ListAuditEventsUseCase } from './application/list-audit-events.usecase.js';
import { CommandExpiryJob } from './infrastructure/command-expiry.job.js';
import { CommandController } from './presentation/command.controller.js';
import { AuditController } from './presentation/audit.controller.js';
import {
  EVENT_PUBLISHER_PORT,
  type EventPublisherPort,
} from '../../shared/events/event-publisher.port.js';
import { TheftModeModule } from '../theft-mode/theft-mode.module.js';
import { THEFT_MODE_REPOSITORY, type TheftModeRepository } from '../theft-mode/domain/theft-mode.repository.js';
import { UsersModule } from '../users/users.module.js';
import { USER_REPOSITORY, type UserRepository } from '../users/domain/user.repository.js';
import { AuthModule } from '../auth/auth.module.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../auth/domain/auth-ports.js';

import { VerifyActionTwoFactorUseCase } from '../auth/application/verify-action-two-factor.usecase.js';

@Module({
  imports: [
    forwardRef(() => DevicesModule),
    forwardRef(() => TheftModeModule),
    UsersModule,
    AuthModule,
  ],
  controllers: [CommandController, AuditController],
  providers: [
    {
      provide: COMMAND_REPOSITORY,
      useClass: PrismaCommandRepository,
    },
    {
      provide: AUDIT_EVENT_REPOSITORY,
      useClass: PrismaAuditEventRepository,
    },
    {
      provide: PUSH_NOTIFICATION_PORT,
      useClass: FirebasePushAdapter,
    },
    {
      provide: SendCommandUseCase,
      useFactory: (
        deviceRepo: DeviceRepository,
        commandRepo: CommandRepository,
        pushPort: PushNotificationPort,
        auditRepo: AuditEventRepository,
        config: ConfigService,
      ) => {
        const ttl = config.get<number>('COMMAND_TTL_SECONDS', 120);
        const lockTtl = config.get<number>('LOCK_COMMAND_TTL_SECONDS', 60);
        return new SendCommandUseCase(
          deviceRepo,
          commandRepo,
          pushPort,
          auditRepo,
          ttl,
          lockTtl,
        );
      },
      inject: [
        DEVICE_REPOSITORY,
        COMMAND_REPOSITORY,
        PUSH_NOTIFICATION_PORT,
        AUDIT_EVENT_REPOSITORY,
        ConfigService,
      ],
    },
    {
      provide: SendRingCommandUseCase,
      useFactory: (sendCommandUseCase: SendCommandUseCase) =>
        new SendRingCommandUseCase(sendCommandUseCase),
      inject: [SendCommandUseCase],
    },
    {
      provide: ListDeviceCommandsUseCase,
      useFactory: (
        commandRepo: CommandRepository,
        deviceRepo: DeviceRepository,
      ) => new ListDeviceCommandsUseCase(commandRepo, deviceRepo),
      inject: [COMMAND_REPOSITORY, DEVICE_REPOSITORY],
    },
    {
      provide: GetCommandUseCase,
      useFactory: (
        commandRepo: CommandRepository,
        deviceRepo: DeviceRepository,
      ) => new GetCommandUseCase(commandRepo, deviceRepo),
      inject: [COMMAND_REPOSITORY, DEVICE_REPOSITORY],
    },
    {
      provide: AckCommandUseCase,
      useFactory: (
        commandRepo: CommandRepository,
        deviceRepo: DeviceRepository,
        eventPublisher: EventPublisherPort,
        theftModeRepo: TheftModeRepository,
      ) => new AckCommandUseCase(commandRepo, deviceRepo, eventPublisher, theftModeRepo),
      inject: [COMMAND_REPOSITORY, DEVICE_REPOSITORY, EVENT_PUBLISHER_PORT, THEFT_MODE_REPOSITORY],
    },
    {
      provide: ExecuteWipeUseCase,
      useFactory: (
        deviceRepo: DeviceRepository,
        userRepo: UserRepository,
        hasher: PasswordHasher,
        commandRepo: CommandRepository,
        pushPort: PushNotificationPort,
        auditRepo: AuditEventRepository,
        config: ConfigService,
        verifyActionTwoFactorUseCase: VerifyActionTwoFactorUseCase,
      ) => {
        const rawAllow = config.get<any>('ALLOW_REMOTE_WIPE', false);
        const allowRemoteWipe = rawAllow === true || rawAllow === 'true' || rawAllow === 1 || rawAllow === '1';
        const wipeTtl = config.get<number>('WIPE_COMMAND_TTL_SECONDS', 600);
        return new ExecuteWipeUseCase(
          deviceRepo,
          userRepo,
          hasher,
          commandRepo,
          pushPort,
          auditRepo,
          allowRemoteWipe,
          wipeTtl,
          verifyActionTwoFactorUseCase,
        );
      },
      inject: [
        DEVICE_REPOSITORY,
        USER_REPOSITORY,
        PASSWORD_HASHER,
        COMMAND_REPOSITORY,
        PUSH_NOTIFICATION_PORT,
        AUDIT_EVENT_REPOSITORY,
        ConfigService,
        VerifyActionTwoFactorUseCase,
      ],
    },
    {
      provide: ListAuditEventsUseCase,
      useFactory: (auditRepo: AuditEventRepository) => new ListAuditEventsUseCase(auditRepo),
      inject: [AUDIT_EVENT_REPOSITORY],
    },
    CommandExpiryJob,
  ],
  exports: [
    COMMAND_REPOSITORY,
    AUDIT_EVENT_REPOSITORY,
    PUSH_NOTIFICATION_PORT,
    SendCommandUseCase,
    ExecuteWipeUseCase,
    ListAuditEventsUseCase,
  ],
})
export class CommandsModule {}
