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
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
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
  ],
  exports: [RegisterUserUseCase, LoginUserUseCase, RefreshSessionUseCase, LogoutUserUseCase],
})
export class AuthModule {}
