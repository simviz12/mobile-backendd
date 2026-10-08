import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import type { JwtValidatedUser } from '../../auth/infrastructure/jwt.strategy.js';
import { ActivateTheftModeUseCase } from '../application/activate-theft-mode.usecase.js';
import { GetTheftModeUseCase } from '../application/get-theft-mode.usecase.js';
import { DeactivateTheftModeUseCase } from '../application/deactivate-theft-mode.usecase.js';
import {
  ActivateTheftModeDto,
  ActivateTheftModeResponseDto,
  DeactivateTheftModeDto,
  DeactivateTheftModeResponseDto,
  TheftModeResponseDto,
} from './theft-mode.dto.js';

@ApiTags('TheftMode')
@Controller('devices/:id/theft-mode')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TheftModeController {
  constructor(
    private readonly activateTheftModeUseCase: ActivateTheftModeUseCase,
    private readonly getTheftModeUseCase: GetTheftModeUseCase,
    private readonly deactivateTheftModeUseCase: DeactivateTheftModeUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Activate theft mode on a protected device' })
  @ApiResponse({
    status: 201,
    description: 'Theft mode activated and THEFT_MODE_ON command dispatched',
    type: ActivateTheftModeResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'THEFT_MODE_ALREADY_ACTIVE or CAPABILITY_NOT_AVAILABLE',
  })
  async activate(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: ActivateTheftModeDto,
    @Req() req: Request,
  ): Promise<ActivateTheftModeResponseDto> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const result = await this.activateTheftModeUseCase.execute({
      deviceId,
      callerUserId: user.userId,
      callerIp: ip,
      message: dto.message,
      contactPhone: dto.contactPhone,
      locationIntervalSeconds: dto.locationIntervalSeconds,
      alarm: dto.alarm,
      lock: dto.lock,
    });

    return {
      theftMode: result.theftMode.toJSON(),
      command: result.command.toResponse(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get active theft mode configuration for device' })
  @ApiResponse({
    status: 200,
    description: 'Active theft mode record',
    type: TheftModeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'THEFT_MODE_NOT_ACTIVE or DEVICE_NOT_FOUND',
  })
  async getActive(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<TheftModeResponseDto> {
    const theftMode = await this.getTheftModeUseCase.getActive(deviceId, user.userId);
    return theftMode.toJSON();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get history of theft mode activations for device' })
  @ApiResponse({
    status: 200,
    description: 'List of theft mode activation records',
    type: [TheftModeResponseDto],
  })
  async getHistory(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<TheftModeResponseDto[]> {
    const records = await this.getTheftModeUseCase.getHistory(deviceId, user.userId);
    return records.map((r) => r.toJSON());
  }

  @Delete()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Deactivate theft mode on a protected device' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description: 'Immediately close theft mode in database without waiting for device ack',
  })
  @ApiResponse({
    status: 200,
    description: 'THEFT_MODE_OFF command created',
    type: DeactivateTheftModeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'INVALID_CREDENTIALS if password confirmation fails',
  })
  @ApiResponse({
    status: 404,
    description: 'THEFT_MODE_NOT_ACTIVE or DEVICE_NOT_FOUND',
  })
  async deactivate(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: DeactivateTheftModeDto,
    @Query('force') force: string | undefined,
    @Req() req: Request,
  ): Promise<DeactivateTheftModeResponseDto> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const isForce = force === 'true' || force === '1';

    const result = await this.deactivateTheftModeUseCase.execute({
      deviceId,
      callerUserId: user.userId,
      callerIp: ip,
      password: dto.password,
      force: isForce,
    });

    return {
      theftMode: result.theftMode.toJSON(),
      command: result.command.toResponse(),
      forced: result.forced,
    };
  }
}
