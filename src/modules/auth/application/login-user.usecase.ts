import { UserRepository } from '../../users/domain/user.repository.js';
import { RefreshToken } from '../domain/refresh-token.entity.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { PasswordHasher, TokenService } from '../domain/auth-ports.js';
import { AuthResult } from './register-user.usecase.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface LoginUserInput {
  email: string;
  password: string;
  userAgent?: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: LoginUserInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new AppError(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        401,
      );
    }

    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new AppError(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        401,
      );
    }

    const accessToken = this.tokenService.generateAccessToken({ sub: user.id });
    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenTtlMs(),
    );

    const refreshTokenEntity = RefreshToken.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      userAgent: input.userAgent,
    });

    await this.refreshTokenRepository.create(refreshTokenEntity);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiresIn(),
    };
  }
}
