export type DatabaseStatus = 'up' | 'down';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  service: string;
  version: string;
  time: string;
  database: DatabaseStatus;
}
