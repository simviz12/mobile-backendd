import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { RefreshToken } from '../domain/refresh-token.entity.js';

export class ListSessionsUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.listActiveByUserId(userId);
  }
}
