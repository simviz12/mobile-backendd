import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { RegisterUserUseCase } from '../application/register-user.usecase.js';
import { LoginUserUseCase } from '../application/login-user.usecase.js';
import { RefreshSessionUseCase } from '../application/refresh-session.usecase.js';
import { LogoutUserUseCase } from '../application/logout-user.usecase.js';
import { GetCurrentUserUseCase } from '../../users/application/get-current-user.usecase.js';
import { SetupTwoFactorUseCase } from '../application/setup-two-factor.usecase.js';
import { EnableTwoFactorUseCase } from '../application/enable-two-factor.usecase.js';
import { DisableTwoFactorUseCase } from '../application/disable-two-factor.usecase.js';
import { VerifyTwoFactorLoginUseCase } from '../application/verify-two-factor-login.usecase.js';
import { ListSessionsUseCase } from '../application/list-sessions.usecase.js';
import { RevokeSessionUseCase } from '../application/revoke-session.usecase.js';
import { LogoutAllSessionsUseCase } from '../application/logout-all-sessions.usecase.js';
import { ChangePasswordUseCase } from '../application/change-password.usecase.js';
import {
  AuthResponseDto,
  ChangePasswordDto,
  CurrentUserProfileDto,
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  EnableTwoFactorResponseDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RefreshResponseDto,
  RegisterDto,
  SessionItemDto,
  SetupTwoFactorResponseDto,
  VerifyTwoFactorLoginDto,
} from './auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import type { JwtValidatedUser } from '../infrastructure/jwt.strategy.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUserUseCase: LogoutUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly setupTwoFactorUseCase: SetupTwoFactorUseCase,
    private readonly enableTwoFactorUseCase: EnableTwoFactorUseCase,
    private readonly disableTwoFactorUseCase: DisableTwoFactorUseCase,
    private readonly verifyTwoFactorLoginUseCase: VerifyTwoFactorLoginUseCase,
    private readonly listSessionsUseCase: ListSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly logoutAllSessionsUseCase: LogoutAllSessionsUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.registerUserUseCase.execute({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
      userAgent,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Successful login or 2FA challenge' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<any> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.loginUserUseCase.execute({
      email: dto.email,
      password: dto.password,
      userAgent,
    });
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup TOTP 2FA secret' })
  @ApiResponse({ status: 200, type: SetupTwoFactorResponseDto })
  async setupTwoFactor(
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<SetupTwoFactorResponseDto> {
    return this.setupTwoFactorUseCase.execute({ userId: user.userId });
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm and enable TOTP 2FA with 6-digit code' })
  @ApiResponse({ status: 200, type: EnableTwoFactorResponseDto })
  async enableTwoFactor(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: EnableTwoFactorDto,
  ): Promise<EnableTwoFactorResponseDto> {
    return this.enableTwoFactorUseCase.execute({
      userId: user.userId,
      code: dto.code,
    });
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable TOTP 2FA with password and code' })
  @ApiResponse({ status: 204 })
  async disableTwoFactor(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: DisableTwoFactorDto,
  ): Promise<void> {
    await this.disableTwoFactorUseCase.execute({
      userId: user.userId,
      password: dto.password,
      code: dto.code,
    });
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify 2FA token with TOTP or backup code to complete login' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorLoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.verifyTwoFactorLoginUseCase.execute({
      twoFactorToken: dto.twoFactorToken,
      code: dto.code,
      userAgent,
    });
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active refresh sessions for the current user' })
  @ApiResponse({ status: 200, type: [SessionItemDto] })
  async listSessions(
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<SessionItemDto[]> {
    const sessions = await this.listSessionsUseCase.execute(user.userId);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific refresh session' })
  @ApiResponse({ status: 204 })
  async revokeSession(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<void> {
    await this.revokeSessionUseCase.execute({
      userId: user.userId,
      sessionId: id,
    });
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all refresh sessions for the current user' })
  @ApiResponse({ status: 204 })
  async logoutAll(
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<void> {
    await this.logoutAllSessionsUseCase.execute(user.userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password and revoke all other sessions' })
  @ApiResponse({ status: 204 })
  async changePassword(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.changePasswordUseCase.execute({
      userId: user.userId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
  ): Promise<RefreshResponseDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.refreshSessionUseCase.execute({
      refreshToken: dto.refreshToken,
      userAgent,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token session' })
  @ApiResponse({ status: 204 })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.logoutUserUseCase.execute({
      refreshToken: dto.refreshToken,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, type: CurrentUserProfileDto })
  async me(@CurrentUser() user: JwtValidatedUser): Promise<CurrentUserProfileDto> {
    return this.getCurrentUserUseCase.execute(user.userId);
  }
}
