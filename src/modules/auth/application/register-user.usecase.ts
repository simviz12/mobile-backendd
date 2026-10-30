import { UserRepository } from '../../users/domain/user.repository.js';
import { User } from '../../users/domain/user.entity.js';
import { RefreshToken } from '../domain/refresh-token.entity.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { PasswordHasher, TokenService } from '../domain/auth-ports.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { randomUUID } from 'crypto';

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string;
  userAgent?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError(
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists',
        409,
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const now = new Date();
    const newUser = User.create({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName.trim(),
      createdAt: now,
      updatedAt: now,
    });

    await this.userRepository.create(newUser);

    const accessToken = this.tokenService.generateAccessToken({
      sub: newUser.id,
    });
    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenTtlMs(),
    );

    const refreshTokenEntity = RefreshToken.create({
      id: randomUUID(),
      userId: newUser.id,
      tokenHash,
      expiresAt,
      createdAt: now,
      userAgent: input.userAgent,
    });

    await this.refreshTokenRepository.create(refreshTokenEntity);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiresIn(),
    };
  }
}
