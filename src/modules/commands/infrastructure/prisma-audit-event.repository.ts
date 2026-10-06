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
}
