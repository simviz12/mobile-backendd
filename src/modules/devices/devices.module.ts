import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEVICE_REPOSITORY } from './domain/device.repository.js';
import { PrismaDeviceRepository } from './infrastructure/prisma-device.repository.js';
import { DEVICE_TOKEN_GENERATOR } from './domain/device-token.generator.js';
import { CryptoDeviceTokenGenerator } from './infrastructure/crypto-device-token.generator.js';
import { LinkDeviceUseCase } from './application/link-device.usecase.js';
import { ListDevicesUseCase } from './application/list-devices.usecase.js';
import { GetDeviceUseCase } from './application/get-device.usecase.js';
import { UpdateDeviceUseCase } from './application/update-device.usecase.js';
import { UnlinkDeviceUseCase } from './application/unlink-device.usecase.js';
import { DeviceController } from './presentation/device.controller.js';
import { DeviceAuthGuard } from './presentation/device-auth.guard.js';
import { DeviceRepository } from './domain/device.repository.js';
import { DeviceTokenGenerator } from './domain/device-token.generator.js';

@Module({
  controllers: [DeviceController],
  providers: [
    {
      provide: DEVICE_REPOSITORY,
      useClass: PrismaDeviceRepository,
    },
    {
      provide: DEVICE_TOKEN_GENERATOR,
      useClass: CryptoDeviceTokenGenerator,
    },
    DeviceAuthGuard,
    {
      provide: LinkDeviceUseCase,
      useFactory: (
        repo: DeviceRepository,
        generator: DeviceTokenGenerator,
        config: ConfigService,
      ) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new LinkDeviceUseCase(repo, generator, timeout);
      },
      inject: [DEVICE_REPOSITORY, DEVICE_TOKEN_GENERATOR, ConfigService],
    },
    {
      provide: ListDevicesUseCase,
      useFactory: (repo: DeviceRepository, config: ConfigService) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new ListDevicesUseCase(repo, timeout);
      },
      inject: [DEVICE_REPOSITORY, ConfigService],
    },
    {
      provide: GetDeviceUseCase,
      useFactory: (repo: DeviceRepository, config: ConfigService) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new GetDeviceUseCase(repo, timeout);
      },
      inject: [DEVICE_REPOSITORY, ConfigService],
    },
    {
      provide: UpdateDeviceUseCase,
      useFactory: (repo: DeviceRepository, config: ConfigService) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new UpdateDeviceUseCase(repo, timeout);
      },
      inject: [DEVICE_REPOSITORY, ConfigService],
    },
    {
      provide: UnlinkDeviceUseCase,
      useFactory: (repo: DeviceRepository) => new UnlinkDeviceUseCase(repo),
      inject: [DEVICE_REPOSITORY],
    },
  ],
  exports: [DEVICE_REPOSITORY, DEVICE_TOKEN_GENERATOR, DeviceAuthGuard],
})
export class DevicesModule {}
