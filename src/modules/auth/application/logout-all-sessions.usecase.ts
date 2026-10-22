import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';

export class LogoutAllSessionsUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }
}
