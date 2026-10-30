import { Injectable, Logger } from '@nestjs/common';
import { DatabaseHealthPort } from '../domain/database-health.port.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';

@Injectable()
export class PrismaDatabaseHealthAdapter implements DatabaseHealthPort {
  private readonly logger = new Logger(PrismaDatabaseHealthAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return true;
    } catch (error) {
      this.logger.warn(`Database health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
