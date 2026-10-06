import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  AuthResponseDto,
  CurrentUserProfileDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RefreshResponseDto,
  RegisterDto,
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
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.loginUserUseCase.execute({
      email: dto.email,
      password: dto.password,
      userAgent,
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
