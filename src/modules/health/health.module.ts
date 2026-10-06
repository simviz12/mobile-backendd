import { Module } from '@nestjs/common';
import { HealthController } from './presentation/health.controller.js';
import { CheckHealthUseCase } from './application/check-health.usecase.js';
import { PrismaDatabaseHealthAdapter } from './infrastructure/prisma-database-health.adapter.js';
import { DATABASE_HEALTH_PORT } from './domain/database-health.port.js';
import { readFileSync } from 'fs';
import { join } from 'path';

function getAppVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
    );
    return pkg.version || '0.0.1';
  } catch {
    return '0.0.1';
  }
}

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: DATABASE_HEALTH_PORT,
      useClass: PrismaDatabaseHealthAdapter,
    },
    {
      provide: CheckHealthUseCase,
      useFactory: (dbAdapter: PrismaDatabaseHealthAdapter) => {
        return new CheckHealthUseCase(dbAdapter, {
          serviceName: 'guardian-api',
          version: getAppVersion(),
        });
      },
      inject: [DATABASE_HEALTH_PORT],
    },
  ],
})
export class HealthModule {}
