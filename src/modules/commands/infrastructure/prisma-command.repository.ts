import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { Command, CommandStatus, CommandType } from '../domain/command.entity.js';
import { CommandRepository } from '../domain/command.repository.js';

@Injectable()
export class PrismaCommandRepository implements CommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): Command {
    return Command.create({
      id: raw.id,
      deviceId: raw.deviceId,
      issuedById: raw.issuedById,
      type: raw.type as CommandType,
      payload: raw.payload ? (raw.payload as Record<string, any>) : null,
      status: raw.status as CommandStatus,
      failureReason: raw.failureReason,
      createdAt: raw.createdAt,
      sentAt: raw.sentAt,
      deliveredAt: raw.deliveredAt,
      executedAt: raw.executedAt,
      expiresAt: raw.expiresAt,
    });
  }

  async findById(id: string): Promise<Command | null> {
    const raw = await this.prisma.command.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findAllByDeviceId(
    deviceId: string,
    filter?: { status?: string; type?: string; limit?: number; cursor?: string },
  ): Promise<{ items: Command[]; nextCursor: string | null }> {
    const limit = filter?.limit ?? 20;
    const where: any = { deviceId };

    if (filter?.status) {
      where.status = filter.status as CommandStatus;
    }

    if (filter?.type) {
      where.type = filter.type as CommandType;
    }

    let cursorId: string | undefined = undefined;
    if (filter?.cursor) {
      try {
        const decoded = Buffer.from(filter.cursor, 'base64').toString('utf8');
        cursorId = decoded;
      } catch {
        cursorId = filter.cursor;
      }
    }

    const rows = await this.prisma.command.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    });

    let nextCursor: string | null = null;
    let items = rows;

    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(lastItem.id, 'utf8').toString('base64');
    }

    return {
      items: items.map((r) => this.toDomain(r)),
      nextCursor,
    };
  }

  async findExpiredPendingOrSent(now: Date): Promise<Command[]> {
    const rows = await this.prisma.command.findMany({
      where: {
        status: { in: [CommandStatus.PENDING, CommandStatus.SENT] },
        expiresAt: { lte: now },
      },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(command: Command): Promise<Command> {
    const raw = await this.prisma.command.create({
      data: {
        id: command.id,
        deviceId: command.deviceId,
        issuedById: command.issuedById,
        type: command.type,
        payload: command.payload ?? undefined,
        status: command.status,
        failureReason: command.failureReason,
        createdAt: command.createdAt,
        sentAt: command.sentAt,
        deliveredAt: command.deliveredAt,
        executedAt: command.executedAt,
        expiresAt: command.expiresAt,
      },
    });
    return this.toDomain(raw);
  }

  async save(command: Command): Promise<Command> {
    const raw = await this.prisma.command.update({
      where: { id: command.id },
      data: {
        status: command.status,
        failureReason: command.failureReason,
        sentAt: command.sentAt,
        deliveredAt: command.deliveredAt,
        executedAt: command.executedAt,
      },
    });
    return this.toDomain(raw);
  }
}
