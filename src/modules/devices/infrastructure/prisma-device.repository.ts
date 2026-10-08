import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { Device, DeviceMode } from '../domain/device.entity.js';
import { DeviceRepository } from '../domain/device.repository.js';

@Injectable()
export class PrismaDeviceRepository implements DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): Device {
    let lastLocation: any = null;
    if (raw.locations && raw.locations.length > 0) {
      const loc = raw.locations[0];
      lastLocation = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyMeters: loc.accuracyMeters,
        recordedAt: loc.recordedAt instanceof Date ? loc.recordedAt.toISOString() : loc.recordedAt,
      };
    }

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
      adminEnabled: raw.adminEnabled,
      batteryLevel: raw.batteryLevel,
      isCharging: raw.isCharging,
      networkType: raw.networkType,
      lastSeenAt: raw.lastSeenAt,
      lastOnlineState: raw.lastOnlineState,
      permissions: raw.permissions as any,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      lastLocation,
    });
  }

  async findById(id: string): Promise<Device | null> {
    const raw = await this.prisma.device.findUnique({
      where: { id },
      include: {
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
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
      include: {
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findByTokenHash(deviceTokenHash: string): Promise<Device | null> {
    const raw = await this.prisma.device.findFirst({
      where: { deviceTokenHash },
      include: {
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findAllByOwnerId(ownerId: string): Promise<Device[]> {
    const rows = await this.prisma.device.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findAll(): Promise<Device[]> {
    const rows = await this.prisma.device.findMany({
      include: {
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
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
        networkType: device.networkType,
        lastSeenAt: device.lastSeenAt,
        lastOnlineState: device.lastOnlineState ?? false,
        permissions: (device.permissions as any) ?? undefined,
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
        adminEnabled: device.adminEnabled,
        batteryLevel: device.batteryLevel,
        isCharging: device.isCharging,
        networkType: device.networkType,
        lastSeenAt: device.lastSeenAt,
        lastOnlineState: device.lastOnlineState ?? false,
        permissions: (device.permissions as any) ?? undefined,
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
