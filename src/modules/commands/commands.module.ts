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
      provide: PUSH_NOTIFICATION_PORT,
      useClass: FirebasePushAdapter,
    },
    {
      provide: SendRingCommandUseCase,
      useFactory: (
        deviceRepo: DeviceRepository,
        commandRepo: CommandRepository,
        pushPort: PushNotificationPort,
        config: ConfigService,
      ) => {
        const ttl = config.get<number>('COMMAND_TTL_SECONDS', 120);
        return new SendRingCommandUseCase(deviceRepo, commandRepo, pushPort, ttl);
      },
      inject: [
        DEVICE_REPOSITORY,
        COMMAND_REPOSITORY,
        PUSH_NOTIFICATION_PORT,
        ConfigService,
      ],
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
  exports: [COMMAND_REPOSITORY, PUSH_NOTIFICATION_PORT],
})
export class CommandsModule {}
