import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginUserUseCase } from './login-user.usecase.js';
import { UserRepository } from '../../users/domain/user.repository.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { PasswordHasher, TokenService } from '../domain/auth-ports.js';
import { User } from '../../users/domain/user.entity.js';

describe('LoginUserUseCase', () => {
  let userRepo: UserRepository;
  let tokenRepo: RefreshTokenRepository;
  let hasher: PasswordHasher;
  let tokenService: TokenService;
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };
    tokenRepo = {
      create: vi.fn(),
      findByTokenHash: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
    };
    hasher = {
      hash: vi.fn(),
      compare: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('mock_access_token'),
      generateRefreshToken: vi.fn().mockReturnValue('mock_refresh_token'),
      hashToken: vi.fn().mockReturnValue('hashed_token'),
      getAccessTokenExpiresIn: vi.fn().mockReturnValue(900),
      getRefreshTokenTtlMs: vi.fn().mockReturnValue(2592000000),
    };
    useCase = new LoginUserUseCase(userRepo, tokenRepo, hasher, tokenService);
  });

  it('should login successfully with valid credentials', async () => {
    const existingUser = User.create({
      id: 'user-1',
      email: 'alex@example.com',
      passwordHash: 'hashed_pw',
      displayName: 'Alex',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(userRepo.findByEmail).mockResolvedValue(existingUser);
    vi.mocked(hasher.compare).mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'alex@example.com',
      password: 'CorrectPassword123',
    });

    expect(result.user.id).toBe('user-1');
    expect(result.accessToken).toBe('mock_access_token');
    expect(result.refreshToken).toBe('mock_refresh_token');
    expect(tokenRepo.create).toHaveBeenCalled();
  });

  it('should throw INVALID_CREDENTIALS when user is not found', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'unknown@example.com',
        password: 'Password123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('should throw INVALID_CREDENTIALS when password does not match', async () => {
    const existingUser = User.create({
      id: 'user-1',
      email: 'alex@example.com',
      passwordHash: 'hashed_pw',
      displayName: 'Alex',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(userRepo.findByEmail).mockResolvedValue(existingUser);
    vi.mocked(hasher.compare).mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'alex@example.com',
        password: 'WrongPassword123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });
});
