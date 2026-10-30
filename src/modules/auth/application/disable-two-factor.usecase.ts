import { UserRepository } from '../../users/domain/user.repository.js';
import { PasswordHasher } from '../domain/auth-ports.js';
import { TwoFactorCryptoPort } from '../infrastructure/two-factor-crypto.service.js';
import { TotpServicePort } from '../infrastructure/otplib-totp.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface DisableTwoFactorInput {
  userId: string;
  password: string;
  code: string;
}

export class DisableTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly totpService: TotpServicePort,
    private readonly cryptoService: TwoFactorCryptoPort,
  ) {}

  async execute(input: DisableTwoFactorInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecretEnc) {
      throw new AppError(
        'TWO_FACTOR_NOT_ENABLED',
        '2FA is not enabled on this account',
        400,
      );
    }

    // Verify password
    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError(
        'INVALID_CREDENTIALS',
        'Invalid password',
        401,
      );
    }

    // Verify TOTP or backup code
    const secret = this.cryptoService.decrypt(user.twoFactorSecretEnc);
    const isTotpValid = this.totpService.verifyToken(input.code, secret);

    let isCodeValid = isTotpValid;
    if (!isCodeValid) {
      const hashed = this.cryptoService.hashBackupCode(input.code);
      if (user.twoFactorBackupCodes.includes(hashed)) {
        isCodeValid = true;
      }
    }

    if (!isCodeValid) {
      throw new AppError(
        'TWO_FACTOR_INVALID',
        'Invalid 2FA authentication code',
        401,
      );
    }

    user.disableTwoFactor();
    await this.userRepository.save(user);
  }
}
