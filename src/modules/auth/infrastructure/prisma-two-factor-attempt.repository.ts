import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import {
  TwoFactorAttempt,
  TwoFactorAttemptRepository,
} from '../domain/two-factor-attempt.repository.js';

@Injectable()
export class PrismaTwoFactorAttemptRepository
  implements TwoFactorAttemptRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<TwoFactorAttempt | null> {
    const raw = await this.prisma.twoFactorAttempt.findUnique({
      where: { userId },
    });
    if (!raw) return null;
    return {
      id: raw.id,
      userId: raw.userId,
      failedCount: raw.failedCount,
      lockedUntil: raw.lockedUntil,
      updatedAt: raw.updatedAt,
    };
  }

  async recordFailure(
    userId: string,
    lockoutMinutes = 15,
    maxFailures = 5,
  ): Promise<{ failedCount: number; isLocked: boolean; lockedUntil?: Date | null }> {
    const existing = await this.prisma.twoFactorAttempt.findUnique({
      where: { userId },
    });

    const newCount = (existing?.failedCount ?? 0) + 1;
    let lockedUntil: Date | null = existing?.lockedUntil ?? null;

    if (newCount >= maxFailures) {
      lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    }

    const updated = await this.prisma.twoFactorAttempt.upsert({
      where: { userId },
      create: {
        userId,
        failedCount: newCount,
        lockedUntil,
      },
      update: {
        failedCount: newCount,
        lockedUntil,
      },
    });

    const isLocked = !!(
      updated.lockedUntil && updated.lockedUntil > new Date()
    );

    return {
      failedCount: updated.failedCount,
      isLocked,
      lockedUntil: updated.lockedUntil,
    };
  }

  async resetFailures(userId: string): Promise<void> {
    await this.prisma.twoFactorAttempt.upsert({
      where: { userId },
      create: {
        userId,
        failedCount: 0,
        lockedUntil: null,
      },
      update: {
        failedCount: 0,
        lockedUntil: null,
      },
    });
  }
}
