import { RefreshToken } from './refresh-token.entity.js';

export interface RefreshTokenRepository {
  create(refreshToken: RefreshToken): Promise<void>;
  findById(id: string): Promise<RefreshToken | null>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  listActiveByUserId(userId: string): Promise<RefreshToken[]>;
  revoke(id: string, replacedById?: string): Promise<void>;
  revokeAllForUser(userId: string, exceptId?: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
