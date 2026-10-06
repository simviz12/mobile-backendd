import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import type { JwtValidatedUser } from '../../auth/infrastructure/jwt.strategy.js';
import { LinkDeviceUseCase } from '../application/link-device.usecase.js';
import { ListDevicesUseCase } from '../application/list-devices.usecase.js';
import { GetDeviceUseCase } from '../application/get-device.usecase.js';
import { UpdateDeviceUseCase } from '../application/update-device.usecase.js';
import { UnlinkDeviceUseCase } from '../application/unlink-device.usecase.js';
import {
  DeviceResponseDto,
  LinkDeviceDto,
  LinkDeviceResponseDto,
  ListDevicesResponseDto,
  UpdateDeviceDto,
} from './device.dto.js';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeviceController {
  constructor(
    private readonly linkDeviceUseCase: LinkDeviceUseCase,
    private readonly listDevicesUseCase: ListDevicesUseCase,
    private readonly getDeviceUseCase: GetDeviceUseCase,
    private readonly updateDeviceUseCase: UpdateDeviceUseCase,
    private readonly unlinkDeviceUseCase: UnlinkDeviceUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Link or re-link a mobile device to the authenticated user account',
  })
  @ApiResponse({
    status: 201,
    description: 'Device linked for the first time',
    type: LinkDeviceResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Existing installation updated and new device token rotated',
    type: LinkDeviceResponseDto,
  })
  async linkDevice(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: LinkDeviceDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.linkDeviceUseCase.execute({
      ownerId: user.userId,
      installId: dto.installId,
      name: dto.name,
      platform: dto.platform,
      model: dto.model,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
      mode: dto.mode,
      fcmToken: dto.fcmToken,
    });

    const statusCode = result.isNew ? HttpStatus.CREATED : HttpStatus.OK;
    res.status(statusCode).json({
      device: result.device,
      deviceToken: result.deviceToken,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all devices belonging to the authenticated user (newest first)',
  })
  @ApiResponse({ status: 200, type: ListDevicesResponseDto })
  async listDevices(
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<ListDevicesResponseDto> {
    const devices = await this.listDevicesUseCase.execute(user.userId);
    return { devices };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get details of a specific device belonging to the user',
  })
  @ApiResponse({ status: 200, type: DeviceResponseDto })
  async getDevice(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<DeviceResponseDto> {
    return this.getDeviceUseCase.execute(id, user.userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update device details (name, fcmToken)',
  })
  @ApiResponse({ status: 200, type: DeviceResponseDto })
  async updateDevice(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: UpdateDeviceDto,
  ): Promise<DeviceResponseDto> {
    return this.updateDeviceUseCase.execute({
      deviceId: id,
      callerUserId: user.userId,
      name: dto.name,
      fcmToken: dto.fcmToken,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unlink and delete a device, invalidating its device token',
  })
  @ApiResponse({ status: 204 })
  async unlinkDevice(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<void> {
    await this.unlinkDeviceUseCase.execute({
      deviceId: id,
      callerUserId: user.userId,
    });
  }
}
