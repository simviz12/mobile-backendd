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

  getAccessTokenExpiresIn(): number {
    const millis = (ms as any)(this.accessTtl);
    return Math.floor(millis / 1000);
  }

  getRefreshTokenTtlMs(): number {
    return (ms as any)(this.refreshTtl);
  }
}
