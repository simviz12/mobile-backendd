import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUserUseCase } from './register-user.usecase.js';
import { UserRepository } from '../../users/domain/user.repository.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { PasswordHasher, TokenService } from '../domain/auth-ports.js';
import { User } from '../../users/domain/user.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

describe('RegisterUserUseCase', () => {
  let userRepo: UserRepository;
  let tokenRepo: RefreshTokenRepository;
  let hasher: PasswordHasher;
  let tokenService: TokenService;
  let useCase: RegisterUserUseCase;

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
      hash: vi.fn().mockResolvedValue('hashed_pw'),
      compare: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('mock_access_token'),
      generateRefreshToken: vi.fn().mockReturnValue('mock_refresh_token'),
      hashToken: vi.fn().mockReturnValue('hashed_token'),
      getAccessTokenExpiresIn: vi.fn().mockReturnValue(900),
      getRefreshTokenTtlMs: vi.fn().mockReturnValue(2592000000),
    };
    useCase = new RegisterUserUseCase(userRepo, tokenRepo, hasher, tokenService);
  });

  it('should register a new user successfully', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'alex@example.com',
      password: 'Password123!',
      displayName: 'Alex',
    });

    expect(result.user.email).toBe('alex@example.com');
    expect(result.user.displayName).toBe('Alex');
    expect(result.accessToken).toBe('mock_access_token');
    expect(result.refreshToken).toBe('mock_refresh_token');
    expect(result.expiresIn).toBe(900);
    expect(userRepo.create).toHaveBeenCalled();
    expect(tokenRepo.create).toHaveBeenCalled();
  });

  it('should throw EMAIL_ALREADY_REGISTERED when email exists', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(
      User.create({
        id: '123',
        email: 'alex@example.com',
        displayName: 'Alex',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(
      useCase.execute({
        email: 'alex@example.com',
        password: 'Password123!',
        displayName: 'Alex',
      }),
    ).rejects.toThrow(AppError);

    await expect(
      useCase.execute({
        email: 'alex@example.com',
        password: 'Password123!',
        displayName: 'Alex',
      }),
    ).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
      statusCode: 409,
    });
  });
});
