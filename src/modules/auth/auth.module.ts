import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import { USER_REPOSITORY } from '../users/domain/user.repository.js';
import { UserRepository } from '../users/domain/user.repository.js';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository.js';
import { PASSWORD_HASHER, TOKEN_SERVICE } from './domain/auth-ports.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.adapter.js';
import { JwtTokenService } from './infrastructure/jwt-token.service.js';
import { RegisterUserUseCase } from './application/register-user.usecase.js';
import { LoginUserUseCase } from './application/login-user.usecase.js';
import { RefreshSessionUseCase } from './application/refresh-session.usecase.js';
import { LogoutUserUseCase } from './application/logout-user.usecase.js';
import { SetupTwoFactorUseCase } from './application/setup-two-factor.usecase.js';
import { EnableTwoFactorUseCase } from './application/enable-two-factor.usecase.js';
import { DisableTwoFactorUseCase } from './application/disable-two-factor.usecase.js';
import { VerifyTwoFactorLoginUseCase } from './application/verify-two-factor-login.usecase.js';
import { ListSessionsUseCase } from './application/list-sessions.usecase.js';
import { RevokeSessionUseCase } from './application/revoke-session.usecase.js';
import { LogoutAllSessionsUseCase } from './application/logout-all-sessions.usecase.js';
import { ChangePasswordUseCase } from './application/change-password.usecase.js';
import { VerifyActionTwoFactorUseCase } from './application/verify-action-two-factor.usecase.js';
import {
  TWO_FACTOR_CRYPTO_PORT,
  AesTwoFactorCryptoService,
  TwoFactorCryptoPort,
} from './infrastructure/two-factor-crypto.service.js';
import {
  TOTP_SERVICE_PORT,
  OtplibTotpService,
  TotpServicePort,
} from './infrastructure/otplib-totp.service.js';
import {
  TWO_FACTOR_ATTEMPT_REPOSITORY,
  TwoFactorAttemptRepository,
} from './domain/two-factor-attempt.repository.js';
import { PrismaTwoFactorAttemptRepository } from './infrastructure/prisma-two-factor-attempt.repository.js';
import { AuthController } from './presentation/auth.controller.js';
import { JwtStrategy } from './infrastructure/jwt.strategy.js';
import { RefreshTokenRepository } from './domain/refresh-token.repository.js';
import { PasswordHasher, TokenService } from './domain/auth-ports.js';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      provide: TWO_FACTOR_ATTEMPT_REPOSITORY,
      useClass: PrismaTwoFactorAttemptRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    {
      provide: TWO_FACTOR_CRYPTO_PORT,
      useFactory: (config: ConfigService) => {
        const secret =
          config.get<string>('TWO_FACTOR_ENCRYPTION_KEY') ||
          config.get<string>('JWT_ACCESS_SECRET')!;
        return new AesTwoFactorCryptoService(secret);
      },
      inject: [ConfigService],
    },
    {
      provide: TOTP_SERVICE_PORT,
      useClass: OtplibTotpService,
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        userRepo: UserRepository,
        tokenRepo: RefreshTokenRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
      ) => new RegisterUserUseCase(userRepo, tokenRepo, hasher, tokens),
      inject: [
        USER_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_HASHER,
        TOKEN_SERVICE,
      ],
    },
    {
      provide: LoginUserUseCase,
      useFactory: (
        userRepo: UserRepository,
        tokenRepo: RefreshTokenRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
      ) => new LoginUserUseCase(userRepo, tokenRepo, hasher, tokens),
      inject: [
        USER_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_HASHER,
        TOKEN_SERVICE,
      ],
    },
    {
      provide: RefreshSessionUseCase,
      useFactory: (
        tokenRepo: RefreshTokenRepository,
        tokens: TokenService,
      ) => new RefreshSessionUseCase(tokenRepo, tokens),
      inject: [REFRESH_TOKEN_REPOSITORY, TOKEN_SERVICE],
    },
    {
      provide: LogoutUserUseCase,
      useFactory: (
        tokenRepo: RefreshTokenRepository,
        tokens: TokenService,
      ) => new LogoutUserUseCase(tokenRepo, tokens),
      inject: [REFRESH_TOKEN_REPOSITORY, TOKEN_SERVICE],
    },
    {
      provide: SetupTwoFactorUseCase,
      useFactory: (
        userRepo: UserRepository,
        totp: TotpServicePort,
        crypto: TwoFactorCryptoPort,
      ) => new SetupTwoFactorUseCase(userRepo, totp, crypto),
      inject: [USER_REPOSITORY, TOTP_SERVICE_PORT, TWO_FACTOR_CRYPTO_PORT],
    },
    {
      provide: EnableTwoFactorUseCase,
      useFactory: (
        userRepo: UserRepository,
        totp: TotpServicePort,
        crypto: TwoFactorCryptoPort,
      ) => new EnableTwoFactorUseCase(userRepo, totp, crypto),
      inject: [USER_REPOSITORY, TOTP_SERVICE_PORT, TWO_FACTOR_CRYPTO_PORT],
    },
    {
      provide: DisableTwoFactorUseCase,
      useFactory: (
        userRepo: UserRepository,
        hasher: PasswordHasher,
        totp: TotpServicePort,
        crypto: TwoFactorCryptoPort,
      ) => new DisableTwoFactorUseCase(userRepo, hasher, totp, crypto),
      inject: [
        USER_REPOSITORY,
        PASSWORD_HASHER,
        TOTP_SERVICE_PORT,
        TWO_FACTOR_CRYPTO_PORT,
      ],
    },
    {
      provide: VerifyTwoFactorLoginUseCase,
      useFactory: (
        userRepo: UserRepository,
        tokenRepo: RefreshTokenRepository,
        attemptRepo: TwoFactorAttemptRepository,
        tokens: TokenService,
        totp: TotpServicePort,
        crypto: TwoFactorCryptoPort,
      ) =>
        new VerifyTwoFactorLoginUseCase(
          userRepo,
          tokenRepo,
          attemptRepo,
          tokens,
          totp,
          crypto,
        ),
      inject: [
        USER_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        TWO_FACTOR_ATTEMPT_REPOSITORY,
        TOKEN_SERVICE,
        TOTP_SERVICE_PORT,
        TWO_FACTOR_CRYPTO_PORT,
      ],
    },
    {
      provide: ListSessionsUseCase,
      useFactory: (tokenRepo: RefreshTokenRepository) =>
        new ListSessionsUseCase(tokenRepo),
      inject: [REFRESH_TOKEN_REPOSITORY],
    },
    {
      provide: RevokeSessionUseCase,
      useFactory: (tokenRepo: RefreshTokenRepository) =>
        new RevokeSessionUseCase(tokenRepo),
      inject: [REFRESH_TOKEN_REPOSITORY],
    },
    {
      provide: LogoutAllSessionsUseCase,
      useFactory: (tokenRepo: RefreshTokenRepository) =>
        new LogoutAllSessionsUseCase(tokenRepo),
      inject: [REFRESH_TOKEN_REPOSITORY],
    },
    {
      provide: ChangePasswordUseCase,
      useFactory: (
        userRepo: UserRepository,
        tokenRepo: RefreshTokenRepository,
        hasher: PasswordHasher,
      ) => new ChangePasswordUseCase(userRepo, tokenRepo, hasher),
      inject: [USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: VerifyActionTwoFactorUseCase,
      useFactory: (
        userRepo: UserRepository,
        totp: TotpServicePort,
        crypto: TwoFactorCryptoPort,
      ) => new VerifyActionTwoFactorUseCase(userRepo, totp, crypto),
      inject: [USER_REPOSITORY, TOTP_SERVICE_PORT, TWO_FACTOR_CRYPTO_PORT],
    },
  ],
  exports: [
    PASSWORD_HASHER,
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshSessionUseCase,
    LogoutUserUseCase,
    SetupTwoFactorUseCase,
    EnableTwoFactorUseCase,
    DisableTwoFactorUseCase,
    VerifyTwoFactorLoginUseCase,
    ListSessionsUseCase,
    RevokeSessionUseCase,
    LogoutAllSessionsUseCase,
    ChangePasswordUseCase,
    VerifyActionTwoFactorUseCase,
  ],
})
export class AuthModule {}
