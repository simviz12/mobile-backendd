import { TheftMode } from './theft-mode.entity.js';

export interface TheftModeRepository {
  findActiveByDeviceId(deviceId: string): Promise<TheftMode | null>;
  findHistoryByDeviceId(deviceId: string): Promise<TheftMode[]>;
  findById(id: string): Promise<TheftMode | null>;
  create(theftMode: TheftMode): Promise<TheftMode>;
  save(theftMode: TheftMode): Promise<TheftMode>;
}

export const THEFT_MODE_REPOSITORY = Symbol('THEFT_MODE_REPOSITORY');
