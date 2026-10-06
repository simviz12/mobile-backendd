import {
  Body,
  Controller,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import type { JwtValidatedUser } from '../../auth/infrastructure/jwt.strategy.js';
import { DeviceAuthGuard } from '../../devices/presentation/device-auth.guard.js';
import { SendCommandUseCase } from '../application/send-command.usecase.js';
import { SendRingCommandUseCase } from '../application/send-ring-command.usecase.js';
import { ListDeviceCommandsUseCase } from '../application/list-device-commands.usecase.js';
import { GetCommandUseCase } from '../application/get-command.usecase.js';
import { AckCommandUseCase } from '../application/ack-command.usecase.js';
import {
  AckCommandDto,
  CommandResponseDto,
  CreateCommandDto,
  ListCommandsQueryDto,
  PaginatedCommandsResponseDto,
} from './command.dto.js';

@ApiTags('Commands')
@Controller()
export class CommandController {
  constructor(
    private readonly sendCommandUseCase: SendCommandUseCase,
    private readonly sendRingCommandUseCase: SendRingCommandUseCase,
    private readonly listDeviceCommandsUseCase: ListDeviceCommandsUseCase,
    private readonly getCommandUseCase: GetCommandUseCase,
    private readonly ackCommandUseCase: AckCommandUseCase,
  ) {}

  @Post('devices/:id/commands')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a remote command (RING, VIBRATE, MESSAGE, LOCK) to a protected device' })
  @ApiResponse({ status: 201, type: CommandResponseDto })
  async sendCommand(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateCommandDto,
  ): Promise<CommandResponseDto> {
    const cmd = await this.sendCommandUseCase.execute({
      deviceId,
      callerUserId: user.userId,
      type: dto.type,
      payload: dto.payload,
    });
    return cmd.toResponse();
  }

  @Get('devices/:id/commands')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List commands for a device with cursor pagination and optional filters' })
  @ApiResponse({ status: 200, type: PaginatedCommandsResponseDto })
  async listCommands(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
    @Query() query: ListCommandsQueryDto,
  ): Promise<PaginatedCommandsResponseDto> {
    const result = await this.listDeviceCommandsUseCase.execute({
      deviceId,
      callerUserId: user.userId,
      limit: query.limit,
      cursor: query.cursor,
      status: query.status,
      type: query.type,
    });
    return {
      items: result.items.map((c) => c.toResponse()),
      nextCursor: result.nextCursor,
    };
  }

  @Get('commands/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get command status by ID' })
  @ApiResponse({ status: 200, type: CommandResponseDto })
  async getCommand(
    @Param('id') commandId: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<CommandResponseDto> {
    const cmd = await this.getCommandUseCase.execute(commandId, user.userId);
    return cmd.toResponse();
  }

  @Post('commands/:id/ack')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge command delivery/execution from target device (Authorization: Device <token>)',
  })
  @ApiResponse({ status: 200, type: CommandResponseDto })
  async ackCommand(
    @Param('id') commandId: string,
    @Req() req: Request,
    @Body() dto: AckCommandDto,
  ): Promise<CommandResponseDto> {
    const device = (req as any).device;
    const cmd = await this.ackCommandUseCase.execute({
      commandId,
      authenticatingDeviceId: device.id,
      status: dto.status,
      reason: dto.reason,
    });
    return cmd.toResponse();
  }
}
