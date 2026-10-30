import { UserRepository } from '../../users/domain/user.repository.js';
import { RefreshToken } from '../domain/refresh-token.entity.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { TwoFactorAttemptRepository } from '../domain/two-factor-attempt.repository.js';
import { TokenService } from '../domain/auth-ports.js';
import { TwoFactorCryptoPort } from '../infrastructure/two-factor-crypto.service.js';
import { TotpServicePort } from '../infrastructure/otplib-totp.service.js';
import { AuthResult } from './register-user.usecase.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface VerifyTwoFactorLoginInput {
  twoFactorToken: string;
  code: string;
  userAgent?: string;
}

export class VerifyTwoFactorLoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly twoFactorAttemptRepository: TwoFactorAttemptRepository,
    private readonly tokenService: TokenService,
    private readonly totpService: TotpServicePort,
    private readonly cryptoService: TwoFactorCryptoPort,
  ) {}

  async execute(input: VerifyTwoFactorLoginInput): Promise<AuthResult> {
    const verified = this.tokenService.verifyTwoFactorToken(input.twoFactorToken);
    if (!verified) {
      throw new AppError(
        'INVALID_TOKEN',
        'Invalid or expired 2FA verification token',
        401,
      );
    }

    const userId = verified.userId;
    const user = await this.userRepository.findById(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecretEnc) {
      throw new AppError(
        'TWO_FACTOR_NOT_ENABLED',
        '2FA is not enabled for this user',
        400,
      );
    }

    // Check account lockout (5 failures for 15 minutes)
    const attempt = await this.twoFactorAttemptRepository.findByUserId(userId);
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (attempt.lockedUntil.getTime() - Date.now()) / (60 * 1000),
      );
      throw new AppError(
        'ACCOUNT_LOCKED',
        `Account is temporarily locked due to too many failed 2FA attempts. Try again in ${minutesRemaining} minutes.`,
        429,
      );
    }

    // Verify TOTP or backup code
    const secret = this.cryptoService.decrypt(user.twoFactorSecretEnc);
    const isTotpValid = this.totpService.verifyToken(input.code, secret);

    let isCodeValid = isTotpValid;
    let usedBackupCodeHash: string | null = null;

    if (!isCodeValid) {
      const hashed = this.cryptoService.hashBackupCode(input.code);
      if (user.twoFactorBackupCodes.includes(hashed)) {
        isCodeValid = true;
        usedBackupCodeHash = hashed;
      }
    }

    if (!isCodeValid) {
      const result = await this.twoFactorAttemptRepository.recordFailure(userId, 15, 5);
      if (result.isLocked) {
        throw new AppError(
          'ACCOUNT_LOCKED',
          'Account is locked for 15 minutes due to 5 failed 2FA attempts.',
          429,
        );
      }
      throw new AppError(
        'TWO_FACTOR_INVALID',
        `Invalid 2FA code. Remaining attempts: ${Math.max(0, 5 - result.failedCount)}`,
        401,
      );
    }

    // Success: reset failures
    await this.twoFactorAttemptRepository.resetFailures(userId);

    // Consume backup code if used
    if (usedBackupCodeHash) {
      user.useBackupCode(usedBackupCodeHash);
      await this.userRepository.save(user);
    }

    // Generate normal session tokens
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id });
    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenTtlMs(),
    );

    const refreshTokenEntity = RefreshToken.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      userAgent: input.userAgent,
    });

    await this.refreshTokenRepository.create(refreshTokenEntity);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiresIn(),
    };
  }
}
