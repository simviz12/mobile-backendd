export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface TokenPayload {
  sub: string;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TwoFactorTokenPayload {
  sub: string;
  purpose: '2fa_login';
}

export interface TokenService {
  generateAccessToken(payload: TokenPayload): string;
  generateRefreshToken(): string;
  hashToken(token: string): string;
  generateTwoFactorToken(userId: string): string;
  verifyTwoFactorToken(token: string): { userId: string } | null;
  getAccessTokenExpiresIn(): number;
  getRefreshTokenTtlMs(): number;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
