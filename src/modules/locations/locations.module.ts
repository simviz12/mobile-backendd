import { forwardRef, Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module.js';
import { DEVICE_REPOSITORY, DeviceRepository } from '../devices/domain/device.repository.js';
import { LOCATION_REPOSITORY, LocationRepository } from './domain/location.repository.js';
import { PrismaLocationRepository } from './infrastructure/prisma-location.repository.js';
import { RecordLocationUseCase } from './application/record-location.usecase.js';
import { GetLatestLocationUseCase } from './application/get-latest-location.usecase.js';
import { ListLocationsUseCase } from './application/list-locations.usecase.js';
import { LocationRetentionJob } from './infrastructure/location-retention.job.js';
import { LocationController } from './presentation/location.controller.js';
import {
  EVENT_PUBLISHER_PORT,
  type EventPublisherPort,
} from '../../shared/events/event-publisher.port.js';

@Module({
  imports: [forwardRef(() => DevicesModule)],
  controllers: [LocationController],
  providers: [
    {
      provide: LOCATION_REPOSITORY,
      useClass: PrismaLocationRepository,
    },
    {
      provide: RecordLocationUseCase,
      useFactory: (
        locRepo: LocationRepository,
        devRepo: DeviceRepository,
        eventPublisher: EventPublisherPort,
      ) => new RecordLocationUseCase(locRepo, devRepo, eventPublisher),
      inject: [LOCATION_REPOSITORY, DEVICE_REPOSITORY, EVENT_PUBLISHER_PORT],
    },
    {
      provide: GetLatestLocationUseCase,
      useFactory: (locRepo: LocationRepository, devRepo: DeviceRepository) =>
        new GetLatestLocationUseCase(locRepo, devRepo),
      inject: [LOCATION_REPOSITORY, DEVICE_REPOSITORY],
    },
    {
      provide: ListLocationsUseCase,
      useFactory: (locRepo: LocationRepository, devRepo: DeviceRepository) =>
        new ListLocationsUseCase(locRepo, devRepo),
      inject: [LOCATION_REPOSITORY, DEVICE_REPOSITORY],
    },
    LocationRetentionJob,
  ],
  exports: [LOCATION_REPOSITORY],
})
export class LocationsModule {}
