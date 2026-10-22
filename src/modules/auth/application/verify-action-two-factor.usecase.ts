import { UserRepository } from '../../users/domain/user.repository.js';
import { TwoFactorCryptoPort } from '../infrastructure/two-factor-crypto.service.js';
import { TotpServicePort } from '../infrastructure/otplib-totp.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface VerifyActionTwoFactorInput {
  userId: string;
  twoFactorCode?: string;
}

export class VerifyActionTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly totpService: TotpServicePort,
    private readonly cryptoService: TwoFactorCryptoPort,
  ) {}

  async execute(input: VerifyActionTwoFactorInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.twoFactorEnabled) {
      return; // 2FA is not enabled on this user, action proceeds without TOTP
    }

    if (!input.twoFactorCode) {
      throw new AppError(
        'TWO_FACTOR_REQUIRED',
        '2FA is enabled on your account. Please provide your twoFactorCode.',
        401,
      );
    }

    if (!user.twoFactorSecretEnc) {
      throw new AppError('TWO_FACTOR_INVALID', '2FA configuration error', 401);
    }

    const secret = this.cryptoService.decrypt(user.twoFactorSecretEnc);
    const isTotpValid = this.totpService.verifyToken(input.twoFactorCode, secret);

    let isCodeValid = isTotpValid;
    let usedBackupCodeHash: string | null = null;

    if (!isCodeValid) {
      const hashed = this.cryptoService.hashBackupCode(input.twoFactorCode);
      if (user.twoFactorBackupCodes.includes(hashed)) {
        isCodeValid = true;
        usedBackupCodeHash = hashed;
      }
    }

    if (!isCodeValid) {
      throw new AppError(
        'TWO_FACTOR_INVALID',
        'Invalid 2FA authentication code',
        401,
      );
    }

    if (usedBackupCodeHash) {
      user.useBackupCode(usedBackupCodeHash);
      await this.userRepository.save(user);
    }
  }
}
