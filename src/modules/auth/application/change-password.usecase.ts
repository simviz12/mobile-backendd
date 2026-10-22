import { UserRepository } from '../../users/domain/user.repository.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { PasswordHasher } from '../domain/auth-ports.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    const isCurrentValid = await this.passwordHasher.compare(
      input.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new AppError(
        'INVALID_CREDENTIALS',
        'Current password is incorrect',
        401,
      );
    }

    if (input.currentPassword === input.newPassword) {
      throw new AppError(
        'VALIDATION_ERROR',
        'New password must be different from current password',
        400,
      );
    }

    const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
    user.changePassword(newPasswordHash);
    await this.userRepository.save(user);

    // Revoke other sessions (or all refresh tokens for this user)
    await this.refreshTokenRepository.revokeAllForUser(input.userId);
  }
}
