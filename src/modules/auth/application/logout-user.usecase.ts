import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { TokenService } from '../domain/auth-ports.js';

export interface LogoutUserInput {
  refreshToken: string;
}

export class LogoutUserUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: LogoutUserInput): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    const tokenHash = this.tokenService.hashToken(input.refreshToken);
    const existingToken = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (existingToken && !existingToken.isRevoked()) {
      await this.refreshTokenRepository.revoke(existingToken.id);
    }
  }
}
