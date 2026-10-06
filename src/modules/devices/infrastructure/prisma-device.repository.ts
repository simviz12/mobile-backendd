import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { Device, DeviceMode } from '../domain/device.entity.js';
import { DeviceRepository } from '../domain/device.repository.js';

@Injectable()
export class PrismaDeviceRepository implements DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): Device {
    return Device.create({
      id: raw.id,
      ownerId: raw.ownerId,
      installId: raw.installId,
      name: raw.name,
      platform: raw.platform as 'android' | 'ios',
      model: raw.model,
      osVersion: raw.osVersion,
      appVersion: raw.appVersion,
      mode: raw.mode as DeviceMode,
      fcmToken: raw.fcmToken,
      deviceTokenHash: raw.deviceTokenHash,
      batteryLevel: raw.batteryLevel,
      isCharging: raw.isCharging,
      lastSeenAt: raw.lastSeenAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  async findById(id: string): Promise<Device | null> {
    const raw = await this.prisma.device.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findByOwnerAndInstallId(ownerId: string, installId: string): Promise<Device | null> {
    const raw = await this.prisma.device.findUnique({
      where: {
        ownerId_installId: {
          ownerId,
          installId,
        },
      },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findByTokenHash(deviceTokenHash: string): Promise<Device | null> {
    const raw = await this.prisma.device.findFirst({
      where: { deviceTokenHash },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findAllByOwnerId(ownerId: string): Promise<Device[]> {
    const rows = await this.prisma.device.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(device: Device): Promise<Device> {
    const created = await this.prisma.device.create({
      data: {
        id: device.id,
        ownerId: device.ownerId,
        installId: device.installId,
        name: device.name,
        platform: device.platform,
        model: device.model,
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        mode: device.mode,
        fcmToken: device.fcmToken,
        deviceTokenHash: device.deviceTokenHash,
        batteryLevel: device.batteryLevel,
        isCharging: device.isCharging,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      },
    });
    return this.toDomain(created);
  }

  async save(device: Device): Promise<Device> {
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        name: device.name,
        fcmToken: device.fcmToken,
        deviceTokenHash: device.deviceTokenHash,
        updatedAt: device.updatedAt,
      },
    });
    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.device.delete({
      where: { id },
    });
  }
}
