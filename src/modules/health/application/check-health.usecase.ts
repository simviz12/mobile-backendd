import {
  HealthCheckResult,
  DatabaseStatus,
} from '../domain/health-check.entity.js';
import { DatabaseHealthPort } from '../domain/database-health.port.js';

export interface HealthCheckUseCaseConfig {
  serviceName: string;
  version: string;
}

export class CheckHealthUseCase {
  constructor(
    private readonly databaseHealthPort: DatabaseHealthPort,
    private readonly config: HealthCheckUseCaseConfig,
  ) {}

  async execute(): Promise<HealthCheckResult> {
    const isDbUp = await this.databaseHealthPort.isHealthy();
    const databaseStatus: DatabaseStatus = isDbUp ? 'up' : 'down';

    return {
      status: 'ok',
      service: this.config.serviceName,
      version: this.config.version,
      time: new Date().toISOString(),
      database: databaseStatus,
    };
  }
}
