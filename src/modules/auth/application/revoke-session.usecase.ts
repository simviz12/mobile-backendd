import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
}

export class RevokeSessionUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    const session = await this.refreshTokenRepository.findById(input.sessionId);
    if (!session || session.userId !== input.userId) {
      throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    }

    await this.refreshTokenRepository.revoke(input.sessionId);
  }
}
