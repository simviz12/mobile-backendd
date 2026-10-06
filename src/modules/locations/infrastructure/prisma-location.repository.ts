import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { Location, LocationSource } from '../domain/location.entity.js';
import { FindLocationsFilter, LocationRepository } from '../domain/location.repository.js';

@Injectable()
export class PrismaLocationRepository implements LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): Location {
    return Location.create({
      id: raw.id,
      deviceId: raw.deviceId,
      latitude: raw.latitude,
      longitude: raw.longitude,
      accuracyMeters: raw.accuracyMeters,
      speedMps: raw.speedMps,
      recordedAt: raw.recordedAt,
      receivedAt: raw.receivedAt,
      source: raw.source as LocationSource,
    });
  }

  async create(location: Location): Promise<Location> {
    const raw = await this.prisma.location.create({
      data: {
        id: location.id,
        deviceId: location.deviceId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters ?? null,
        speedMps: location.speedMps ?? null,
        recordedAt: location.recordedAt,
        receivedAt: location.receivedAt,
        source: location.source,
      },
    });
    return this.toDomain(raw);
  }

  async createMany(locations: Location[]): Promise<Location[]> {
    if (locations.length === 0) return [];

    await this.prisma.location.createMany({
      data: locations.map((loc) => ({
        id: loc.id,
        deviceId: loc.deviceId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyMeters: loc.accuracyMeters ?? null,
        speedMps: loc.speedMps ?? null,
        recordedAt: loc.recordedAt,
        receivedAt: loc.receivedAt,
        source: loc.source,
      })),
    });

    return locations;
  }

  async findLatestByDeviceId(deviceId: string): Promise<Location | null> {
    const raw = await this.prisma.location.findFirst({
      where: { deviceId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findAllByDeviceId(
    deviceId: string,
    filter?: FindLocationsFilter,
  ): Promise<Location[]> {
    const where: any = { deviceId };

    if (filter?.from || filter?.to) {
      where.recordedAt = {};
      if (filter.from) where.recordedAt.gte = filter.from;
      if (filter.to) where.recordedAt.lte = filter.to;
    }

    const limit = Math.min(filter?.limit ?? 50, 500);

    const rows = await this.prisma.location.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    return rows.map((r) => this.toDomain(r));
  }

  async deleteOlderThan(cutoffDate: Date): Promise<number> {
    const result = await this.prisma.location.deleteMany({
      where: {
        recordedAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }
}
