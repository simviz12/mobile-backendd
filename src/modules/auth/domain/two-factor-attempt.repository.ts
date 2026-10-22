export interface TwoFactorAttempt {
  id: string;
  userId: string;
  failedCount: number;
  lockedUntil?: Date | null;
  updatedAt: Date;
}

export interface TwoFactorAttemptRepository {
  findByUserId(userId: string): Promise<TwoFactorAttempt | null>;
  recordFailure(userId: string, lockoutMinutes?: number, maxFailures?: number): Promise<{ failedCount: number; isLocked: boolean; lockedUntil?: Date | null }>;
  resetFailures(userId: string): Promise<void>;
}

export const TWO_FACTOR_ATTEMPT_REPOSITORY = Symbol('TWO_FACTOR_ATTEMPT_REPOSITORY');
