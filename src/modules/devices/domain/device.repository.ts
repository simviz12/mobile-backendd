import { Device } from './device.entity.js';

export interface DeviceRepository {
  findById(id: string): Promise<Device | null>;
  findByOwnerAndInstallId(ownerId: string, installId: string): Promise<Device | null>;
  findByTokenHash(tokenHash: string): Promise<Device | null>;
  findAllByOwnerId(ownerId: string): Promise<Device[]>;
  findAll(): Promise<Device[]>;
  create(device: Device): Promise<Device>;
  save(device: Device): Promise<Device>;
  delete(id: string): Promise<void>;
}

export const DEVICE_REPOSITORY = Symbol('DEVICE_REPOSITORY');
