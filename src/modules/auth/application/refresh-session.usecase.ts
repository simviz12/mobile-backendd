import { RefreshToken } from '../domain/refresh-token.entity.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { TokenService } from '../domain/auth-ports.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface RefreshSessionInput {
  refreshToken: string;
  userAgent?: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class RefreshSessionUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: RefreshSessionInput): Promise<RefreshResult> {
    if (!input.refreshToken) {
      throw new AppError(
        'REFRESH_TOKEN_INVALID',
        'Refresh token is required',
        401,
      );
    }

    const tokenHash = this.tokenService.hashToken(input.refreshToken);
    const existingToken = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!existingToken) {
      throw new AppError(
        'REFRESH_TOKEN_INVALID',
        'Invalid refresh token',
        401,
      );
    }

    // Reuse detection: If revoked token is presented, revoke all sessions for this user
    if (existingToken.isRevoked()) {
      await this.refreshTokenRepository.revokeAllForUser(existingToken.userId);
      throw new AppError(
        'REFRESH_TOKEN_REUSED',
        'Revoked refresh token reuse detected. All user sessions have been invalidated.',
        401,
      );
    }

    // Expiration check
    if (existingToken.isExpired()) {
      await this.refreshTokenRepository.revoke(existingToken.id);
      throw new AppError(
        'REFRESH_TOKEN_EXPIRED',
        'Refresh token has expired',
        401,
      );
    }

    // Token Rotation: Generate new token pair
    const newAccessToken = this.tokenService.generateAccessToken({
      sub: existingToken.userId,
    });
    const newRawRefreshToken = this.tokenService.generateRefreshToken();
    const newTokenHash = this.tokenService.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenTtlMs(),
    );

    const newRefreshToken = RefreshToken.create({
      id: randomUUID(),
      userId: existingToken.userId,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      createdAt: new Date(),
      userAgent: input.userAgent || existingToken.userAgent,
    });

    // Revoke old token and link to new one
    await this.refreshTokenRepository.revoke(existingToken.id, newRefreshToken.id);
    await this.refreshTokenRepository.create(newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiresIn(),
    };
  }
}
