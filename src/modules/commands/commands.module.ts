import { Module } from '@nestjs/common';
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
import { CommandExpiryJob } from './infrastructure/command-expiry.job.js';
import { CommandController } from './presentation/command.controller.js';

@Module({
  imports: [DevicesModule],
  controllers: [CommandController],
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
      useFactory: (commandRepo: CommandRepository) =>
        new AckCommandUseCase(commandRepo),
      inject: [COMMAND_REPOSITORY],
    },
    CommandExpiryJob,
  ],
  exports: [COMMAND_REPOSITORY, PUSH_NOTIFICATION_PORT, SendCommandUseCase],
})
export class CommandsModule {}
