import { UserRepository } from '../../users/domain/user.repository.js';
import { TwoFactorCryptoPort } from '../infrastructure/two-factor-crypto.service.js';
import { TotpServicePort } from '../infrastructure/otplib-totp.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface SetupTwoFactorInput {
  userId: string;
}

export interface SetupTwoFactorOutput {
  secret: string;
  otpauthUrl: string;
}

export class SetupTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly totpService: TotpServicePort,
    private readonly cryptoService: TwoFactorCryptoPort,
  ) {}

  async execute(input: SetupTwoFactorInput): Promise<SetupTwoFactorOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    if (user.twoFactorEnabled) {
      throw new AppError(
        'TWO_FACTOR_ALREADY_ENABLED',
        '2FA is already enabled on this account',
        409,
      );
    }

    const secret = this.totpService.generateSecret();
    const otpauthUrl = this.totpService.generateOtpauthUrl(user.email, secret);
    const encryptedSecret = this.cryptoService.encrypt(secret);

    user.setTempTwoFactorSecret(encryptedSecret);
    await this.userRepository.save(user);

    return {
      secret,
      otpauthUrl,
    };
  }
}
