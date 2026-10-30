import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { TheftMode } from '../domain/theft-mode.entity.js';
import { TheftModeRepository } from '../domain/theft-mode.repository.js';

@Injectable()
export class PrismaTheftModeRepository implements TheftModeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): TheftMode {
    return TheftMode.create({
      id: raw.id,
      deviceId: raw.deviceId,
      activatedById: raw.activatedById,
      activatedAt: raw.activatedAt,
      deactivatedAt: raw.deactivatedAt,
      message: raw.message,
      contactPhone: raw.contactPhone,
      locationIntervalSeconds: raw.locationIntervalSeconds,
      alarm: raw.alarm,
      lock: raw.lock,
    });
  }

  async findActiveByDeviceId(deviceId: string): Promise<TheftMode | null> {
    const raw = await this.prisma.theftMode.findFirst({
      where: {
        deviceId,
        deactivatedAt: null,
      },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findHistoryByDeviceId(deviceId: string): Promise<TheftMode[]> {
    const rows = await this.prisma.theftMode.findMany({
      where: { deviceId },
      orderBy: { activatedAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<TheftMode | null> {
    const raw = await this.prisma.theftMode.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async create(theftMode: TheftMode): Promise<TheftMode> {
    const created = await this.prisma.theftMode.create({
      data: {
        id: theftMode.id,
        deviceId: theftMode.deviceId,
        activatedById: theftMode.activatedById,
        activatedAt: theftMode.activatedAt,
        deactivatedAt: theftMode.deactivatedAt,
        message: theftMode.message,
        contactPhone: theftMode.contactPhone,
        locationIntervalSeconds: theftMode.locationIntervalSeconds,
        alarm: theftMode.alarm,
        lock: theftMode.lock,
      },
    });
    return this.toDomain(created);
  }

  async save(theftMode: TheftMode): Promise<TheftMode> {
    const updated = await this.prisma.theftMode.update({
      where: { id: theftMode.id },
      data: {
        deactivatedAt: theftMode.deactivatedAt,
      },
    });
    return this.toDomain(updated);
  }
}
