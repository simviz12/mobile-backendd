import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { RefreshToken } from '../domain/refresh-token.entity.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(token: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        replacedById: token.replacedById,
        createdAt: token.createdAt,
        userAgent: token.userAgent,
      },
    });
  }

  async findById(id: string): Promise<RefreshToken | null> {
    const raw = await this.prisma.refreshToken.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return RefreshToken.create(raw);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const raw = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });
    if (!raw) return null;
    return RefreshToken.create(raw);
  }

  async listActiveByUserId(userId: string): Promise<RefreshToken[]> {
    const raws = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => RefreshToken.create(r));
  }

  async revoke(id: string, replacedById?: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        replacedById: replacedById ?? null,
      },
    });
  }

  async revokeAllForUser(userId: string, exceptId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
