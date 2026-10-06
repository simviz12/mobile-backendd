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

export interface TokenService {
  generateAccessToken(payload: TokenPayload): string;
  generateRefreshToken(): string;
  hashToken(token: string): string;
  getAccessTokenExpiresIn(): number;
  getRefreshTokenTtlMs(): number;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
