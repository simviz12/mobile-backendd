import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { AuditEvent } from '../domain/audit-event.entity.js';
import { AuditEventRepository } from '../domain/audit-event.repository.js';

@Injectable()
export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(event: AuditEvent): Promise<AuditEvent> {
    const raw = await this.prisma.auditEvent.create({
      data: {
        id: event.id,
        userId: event.userId,
        deviceId: event.deviceId ?? null,
        action: event.action,
        metadata: event.metadata ?? undefined,
        createdAt: event.createdAt,
      },
    });

    return AuditEvent.create({
      id: raw.id,
      userId: raw.userId,
      deviceId: raw.deviceId,
      action: raw.action,
      metadata: raw.metadata as Record<string, any> | null,
      createdAt: raw.createdAt,
    });
  }

  async findByUserId(
    userId: string,
    options?: { deviceId?: string; limit?: number },
  ): Promise<AuditEvent[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const where: any = { userId };
    if (options?.deviceId) {
      where.deviceId = options.deviceId;
    }

    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((raw) =>
      AuditEvent.create({
        id: raw.id,
        userId: raw.userId,
        deviceId: raw.deviceId,
        action: raw.action,
        metadata: raw.metadata as Record<string, any> | null,
        createdAt: raw.createdAt,
      }),
    );
  }
}
