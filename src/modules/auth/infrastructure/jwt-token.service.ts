import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import ms from 'ms';
import { TokenPayload, TokenService } from '../domain/auth-ports.js';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly accessSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
    this.accessTtl = this.configService.get<string>('JWT_ACCESS_TTL', '15m')!;
    this.refreshTtl = this.configService.get<string>('JWT_REFRESH_TTL', '30d')!;
  }

  generateAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { sub: payload.sub },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtl as any,
      },
    );
  }

  generateRefreshToken(): string {
    return randomBytes(40).toString('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateTwoFactorToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: '2fa_login' },
      {
        secret: this.accessSecret,
        expiresIn: '5m' as any, // short-lived single purpose
      },
    );
  }

  verifyTwoFactorToken(token: string): { userId: string } | null {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.accessSecret,
      }) as any;
      if (decoded && decoded.purpose === '2fa_login' && decoded.sub) {
        return { userId: decoded.sub };
      }
      return null;
    } catch {
      return null;
    }
  }

  getAccessTokenExpiresIn(): number {
    const millis = (ms as any)(this.accessTtl);
    return Math.floor(millis / 1000);
  }

  getRefreshTokenTtlMs(): number {
    return (ms as any)(this.refreshTtl);
  }
}
