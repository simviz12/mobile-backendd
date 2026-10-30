import { forwardRef, Module } from '@nestjs/common';
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
import { UpdateDeviceCapabilitiesUseCase } from './application/update-device-capabilities.usecase.js';
import { GetDeviceDiagnosticsUseCase } from './application/get-device-diagnostics.usecase.js';
import { DeviceController } from './presentation/device.controller.js';
import { DeviceAuthGuard } from './presentation/device-auth.guard.js';
import { DeviceRepository } from './domain/device.repository.js';
import { DeviceTokenGenerator } from './domain/device-token.generator.js';
import { ReportDeviceStatusUseCase } from './application/report-device-status.usecase.js';
import { DeviceHeartbeatJob } from './infrastructure/device-heartbeat.job.js';
import { CommandsModule } from '../commands/commands.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { COMMAND_REPOSITORY, type CommandRepository } from '../commands/domain/command.repository.js';
import { LOCATION_REPOSITORY, type LocationRepository } from '../locations/domain/location.repository.js';
import {
  EVENT_PUBLISHER_PORT,
  type EventPublisherPort,
} from '../../shared/events/event-publisher.port.js';

@Module({
  imports: [
    forwardRef(() => CommandsModule),
    forwardRef(() => LocationsModule),
  ],
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
        eventPublisher: EventPublisherPort,
      ) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new LinkDeviceUseCase(repo, generator, timeout, eventPublisher);
      },
      inject: [DEVICE_REPOSITORY, DEVICE_TOKEN_GENERATOR, ConfigService, EVENT_PUBLISHER_PORT],
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
      useFactory: (repo: DeviceRepository, eventPublisher: EventPublisherPort) =>
        new UnlinkDeviceUseCase(repo, eventPublisher),
      inject: [DEVICE_REPOSITORY, EVENT_PUBLISHER_PORT],
    },
    {
      provide: UpdateDeviceCapabilitiesUseCase,
      useFactory: (repo: DeviceRepository, config: ConfigService) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new UpdateDeviceCapabilitiesUseCase(repo, timeout);
      },
      inject: [DEVICE_REPOSITORY, ConfigService],
    },
    {
      provide: GetDeviceDiagnosticsUseCase,
      useFactory: (
        devRepo: DeviceRepository,
        cmdRepo: CommandRepository,
        locRepo: LocationRepository,
        config: ConfigService,
      ) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new GetDeviceDiagnosticsUseCase(devRepo, cmdRepo, locRepo, timeout);
      },
      inject: [DEVICE_REPOSITORY, COMMAND_REPOSITORY, LOCATION_REPOSITORY, ConfigService],
    },
    {
      provide: ReportDeviceStatusUseCase,
      useFactory: (
        repo: DeviceRepository,
        eventPublisher: EventPublisherPort,
        config: ConfigService,
      ) => {
        const timeout = config.get<number>('HEARTBEAT_TIMEOUT_SECONDS', 300);
        return new ReportDeviceStatusUseCase(repo, eventPublisher, timeout);
      },
      inject: [DEVICE_REPOSITORY, EVENT_PUBLISHER_PORT, ConfigService],
    },
    DeviceHeartbeatJob,
  ],
  exports: [
    DEVICE_REPOSITORY,
    DEVICE_TOKEN_GENERATOR,
    DeviceAuthGuard,
    UpdateDeviceCapabilitiesUseCase,
    ReportDeviceStatusUseCase,
  ],
})
export class DevicesModule {}

