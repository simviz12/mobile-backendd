import { Location } from './location.entity.js';

export interface FindLocationsFilter {
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface LocationRepository {
  create(location: Location): Promise<Location>;
  createMany(locations: Location[]): Promise<Location[]>;
  findLatestByDeviceId(deviceId: string): Promise<Location | null>;
  findAllByDeviceId(deviceId: string, filter?: FindLocationsFilter): Promise<Location[]>;
  deleteOlderThan(cutoffDate: Date): Promise<number>;
}

export const LOCATION_REPOSITORY = Symbol('LOCATION_REPOSITORY');
