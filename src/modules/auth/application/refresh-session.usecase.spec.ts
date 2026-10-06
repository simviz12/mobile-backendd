import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshSessionUseCase } from './refresh-session.usecase.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { TokenService } from '../domain/auth-ports.js';
import { RefreshToken } from '../domain/refresh-token.entity.js';

describe('RefreshSessionUseCase', () => {
  let tokenRepo: RefreshTokenRepository;
  let tokenService: TokenService;
  let useCase: RefreshSessionUseCase;

  beforeEach(() => {
    tokenRepo = {
      create: vi.fn(),
      findByTokenHash: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('new_access_token'),
      generateRefreshToken: vi.fn().mockReturnValue('new_refresh_token'),
      hashToken: vi.fn().mockImplementation((t: string) => `hash_${t}`),
      getAccessTokenExpiresIn: vi.fn().mockReturnValue(900),
      getRefreshTokenTtlMs: vi.fn().mockReturnValue(2592000000),
    };
    useCase = new RefreshSessionUseCase(tokenRepo, tokenService);
  });

  it('should rotate token successfully on valid refresh token', async () => {
    const activeToken = RefreshToken.create({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash_raw_token',
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
    });

    vi.mocked(tokenRepo.findByTokenHash).mockResolvedValue(activeToken);

    const result = await useCase.execute({ refreshToken: 'raw_token' });

    expect(result.accessToken).toBe('new_access_token');
    expect(result.refreshToken).toBe('new_refresh_token');
    expect(tokenRepo.revoke).toHaveBeenCalledWith('token-1', expect.any(String));
    expect(tokenRepo.create).toHaveBeenCalled();
  });

  it('should detect reuse and revoke all sessions for user', async () => {
    const revokedToken = RefreshToken.create({
      id: 'token-old',
      userId: 'user-1',
      tokenHash: 'hash_stolen_token',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: new Date(),
      replacedById: 'token-new',
      createdAt: new Date(),
    });

    vi.mocked(tokenRepo.findByTokenHash).mockResolvedValue(revokedToken);

    await expect(
      useCase.execute({ refreshToken: 'stolen_token' }),
    ).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSED',
      statusCode: 401,
    });

    expect(tokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('should throw REFRESH_TOKEN_EXPIRED when expired', async () => {
    const expiredToken = RefreshToken.create({
      id: 'token-exp',
      userId: 'user-1',
      tokenHash: 'hash_expired_token',
      expiresAt: new Date(Date.now() - 10000),
      createdAt: new Date(),
    });

    vi.mocked(tokenRepo.findByTokenHash).mockResolvedValue(expiredToken);

    await expect(
      useCase.execute({ refreshToken: 'expired_token' }),
    ).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_EXPIRED',
      statusCode: 401,
    });

    expect(tokenRepo.revoke).toHaveBeenCalledWith('token-exp');
  });
});
