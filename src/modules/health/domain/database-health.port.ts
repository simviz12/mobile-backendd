export interface DatabaseHealthPort {
  isHealthy(): Promise<boolean>;
}

export const DATABASE_HEALTH_PORT = Symbol('DATABASE_HEALTH_PORT');
