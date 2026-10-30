import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LOCATION_REPOSITORY } from '../domain/location.repository.js';
import type { LocationRepository } from '../domain/location.repository.js';

@Injectable()
export class LocationRetentionJob {
  private readonly logger = new Logger(LocationRetentionJob.name);

  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRetention(): Promise<number> {
    const retentionDays = this.configService.get<number>('LOCATION_RETENTION_DAYS', 30);
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deletedCount = await this.locationRepository.deleteOlderThan(cutoffDate);
    if (deletedCount > 0) {
      this.logger.log(`Pruned ${deletedCount} location records older than ${retentionDays} days (${cutoffDate.toISOString()})`);
    }
    return deletedCount;
  }
}
