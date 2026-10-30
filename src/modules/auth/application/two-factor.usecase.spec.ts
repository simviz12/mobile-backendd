import { describe, it, expect, beforeEach } from 'vitest';
import { SetupTwoFactorUseCase } from '../application/setup-two-factor.usecase.js';
import { EnableTwoFactorUseCase } from '../application/enable-two-factor.usecase.js';
import { DisableTwoFactorUseCase } from '../application/disable-two-factor.usecase.js';
import { VerifyTwoFactorLoginUseCase } from '../application/verify-two-factor-login.usecase.js';
import { VerifyActionTwoFactorUseCase } from '../application/verify-action-two-factor.usecase.js';
import { User } from '../../users/domain/user.entity.js';
import { UserRepository } from '../../users/domain/user.repository.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { TwoFactorAttemptRepository } from '../domain/two-factor-attempt.repository.js';
import { PasswordHasher, TokenService } from '../domain/auth-ports.js';
import { TwoFactorCryptoPort } from '../infrastructure/two-factor-crypto.service.js';
import { TotpServicePort } from '../infrastructure/otplib-totp.service.js';

describe('2FA and Hardening Use Cases (unit)', () => {
  let mockUser: User;
  let userRepo: UserRepository;
  let tokenRepo: RefreshTokenRepository;
  let attemptRepo: TwoFactorAttemptRepository;
  let tokenService: TokenService;
  let totpService: TotpServicePort;
  let cryptoService: TwoFactorCryptoPort;
  let passwordHasher: PasswordHasher;

  beforeEach(() => {
    mockUser = User.create({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: '$argon2id$mockedhash',
      displayName: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userRepo = {
      findById: async (id: string) => (id === mockUser.id ? mockUser : null),
      findByEmail: async (email: string) => (email === mockUser.email ? mockUser : null),
      save: async (u: User) => {
        mockUser = u;
      },
      create: async (u: User) => u,
    };

    tokenRepo = {
      create: async () => {},
      findById: async () => null,
      findByTokenHash: async () => null,
      listActiveByUserId: async () => [],
      revoke: async () => {},
      revokeAllForUser: async () => {},
    };

    attemptRepo = {
      findByUserId: async () => null,
      recordFailure: async () => ({ failedCount: 1, isLocked: false }),
      resetFailures: async () => {},
    };

    tokenService = {
      generateAccessToken: () => 'access-token',
      generateRefreshToken: () => 'refresh-token',
      hashToken: (t) => `hash-${t}`,
      generateTwoFactorToken: (uid) => `2fa-token-${uid}`,
      verifyTwoFactorToken: (t) => (t === '2fa-token-user-1' ? { userId: 'user-1' } : null),
      getAccessTokenExpiresIn: () => 900,
      getRefreshTokenTtlMs: () => 3600000,
    };

    totpService = {
      generateSecret: () => 'JBSWY3DPEHPK3PXP',
      generateOtpauthUrl: () => 'otpauth://totp/Guardian:test@example.com?secret=JBSWY3DPEHPK3PXP',
      verifyToken: (token: string, secret: string) => token === '123456' && secret === 'JBSWY3DPEHPK3PXP',
      generateBackupCodes: () => ['BACKUP-01', 'BACKUP-02'],
    };

    cryptoService = {
      encrypt: (p) => `enc:${p}`,
      decrypt: (c) => c.replace('enc:', ''),
      hashBackupCode: (code) => `hashed-${code}`,
    };

    passwordHasher = {
      hash: async (p) => `hash-${p}`,
      compare: async (p) => p === 'Password123!',
    };
  });

  it('Setup 2FA generates secret and stores encrypted temporary secret', async () => {
    const useCase = new SetupTwoFactorUseCase(userRepo, totpService, cryptoService);
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(mockUser.twoFactorTempSecretEnc).toBe('enc:JBSWY3DPEHPK3PXP');
    expect(mockUser.twoFactorEnabled).toBe(false);
  });

  it('Enable 2FA validates code and activates 2FA returning backup codes', async () => {
    mockUser.setTempTwoFactorSecret('enc:JBSWY3DPEHPK3PXP');
    const useCase = new EnableTwoFactorUseCase(userRepo, totpService, cryptoService);

    const result = await useCase.execute({ userId: 'user-1', code: '123456' });

    expect(result.backupCodes).toEqual(['BACKUP-01', 'BACKUP-02']);
    expect(mockUser.twoFactorEnabled).toBe(true);
    expect(mockUser.twoFactorSecretEnc).toBe('enc:JBSWY3DPEHPK3PXP');
    expect(mockUser.twoFactorBackupCodes).toContain('hashed-BACKUP-01');
  });

  it('Disable 2FA validates password and code and removes 2FA', async () => {
    mockUser.setTempTwoFactorSecret('enc:JBSWY3DPEHPK3PXP');
    mockUser.enableTwoFactor(['hashed-BACKUP-01']);

    const useCase = new DisableTwoFactorUseCase(userRepo, passwordHasher, totpService, cryptoService);
    await useCase.execute({
      userId: 'user-1',
      password: 'Password123!',
      code: '123456',
    });

    expect(mockUser.twoFactorEnabled).toBe(false);
    expect(mockUser.twoFactorSecretEnc).toBeNull();
  });

  it('VerifyTwoFactorLogin completes login and returns tokens on valid code', async () => {
    mockUser.setTempTwoFactorSecret('enc:JBSWY3DPEHPK3PXP');
    mockUser.enableTwoFactor(['hashed-BACKUP-01']);

    const useCase = new VerifyTwoFactorLoginUseCase(
      userRepo,
      tokenRepo,
      attemptRepo,
      tokenService,
      totpService,
      cryptoService,
    );

    const result = await useCase.execute({
      twoFactorToken: '2fa-token-user-1',
      code: '123456',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('VerifyActionTwoFactor requires twoFactorCode when 2FA is active', async () => {
    mockUser.setTempTwoFactorSecret('enc:JBSWY3DPEHPK3PXP');
    mockUser.enableTwoFactor(['hashed-BACKUP-01']);

    const useCase = new VerifyActionTwoFactorUseCase(userRepo, totpService, cryptoService);

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toThrow('2FA is enabled on your account');
    await expect(useCase.execute({ userId: 'user-1', twoFactorCode: '999999' })).rejects.toThrow('Invalid 2FA authentication code');

    // Valid code succeeds
    await expect(useCase.execute({ userId: 'user-1', twoFactorCode: '123456' })).resolves.toBeUndefined();
  });
});
