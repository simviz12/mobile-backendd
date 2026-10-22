import { UserRepository } from '../../users/domain/user.repository.js';
import { TwoFactorCryptoPort } from '../infrastructure/two-factor-crypto.service.js';
import { TotpServicePort } from '../infrastructure/otplib-totp.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface EnableTwoFactorInput {
  userId: string;
  code: string;
}

export interface EnableTwoFactorOutput {
  backupCodes: string[];
}

export class EnableTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly totpService: TotpServicePort,
    private readonly cryptoService: TwoFactorCryptoPort,
  ) {}

  async execute(input: EnableTwoFactorInput): Promise<EnableTwoFactorOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.twoFactorTempSecretEnc) {
      throw new AppError(
        'TWO_FACTOR_NOT_SETUP',
        '2FA setup has not been initiated. Call /auth/2fa/setup first.',
        400,
      );
    }

    const secret = this.cryptoService.decrypt(user.twoFactorTempSecretEnc);
    const isValid = this.totpService.verifyToken(input.code, secret);
    if (!isValid) {
      throw new AppError(
        'TWO_FACTOR_INVALID',
        'Invalid 2FA authentication code',
        401,
      );
    }

    // Generate 10 one-time backup codes
    const backupCodes = this.totpService.generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map((code) =>
      this.cryptoService.hashBackupCode(code),
    );

    user.enableTwoFactor(hashedBackupCodes);
    await this.userRepository.save(user);

    return {
      backupCodes,
    };
  }
}
