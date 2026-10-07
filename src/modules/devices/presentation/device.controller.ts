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
import { DeviceAuthGuard } from './device-auth.guard.js';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import type { JwtValidatedUser } from '../../auth/infrastructure/jwt.strategy.js';
import type { Response } from 'express';
import { LinkDeviceUseCase } from '../application/link-device.usecase.js';
import { ListDevicesUseCase } from '../application/list-devices.usecase.js';
import { GetDeviceUseCase } from '../application/get-device.usecase.js';
import { UpdateDeviceUseCase } from '../application/update-device.usecase.js';
import { UnlinkDeviceUseCase } from '../application/unlink-device.usecase.js';
import { UpdateDeviceCapabilitiesUseCase } from '../application/update-device-capabilities.usecase.js';
import { GetDeviceDiagnosticsUseCase } from '../application/get-device-diagnostics.usecase.js';
import {
  DeviceResponseDto,
  DiagnosticsResponseDto,
  LinkDeviceDto,
  LinkDeviceResponseDto,
  ListDevicesResponseDto,
  UpdateDeviceCapabilitiesDto,
  UpdateDeviceDto,
} from './device.dto.js';
import type { Request } from 'express';
import { Req } from '@nestjs/common';

@ApiTags('Devices')
@Controller('devices')
export class DeviceController {
  constructor(
    private readonly linkDeviceUseCase: LinkDeviceUseCase,
    private readonly listDevicesUseCase: ListDevicesUseCase,
    private readonly getDeviceUseCase: GetDeviceUseCase,
    private readonly updateDeviceUseCase: UpdateDeviceUseCase,
    private readonly unlinkDeviceUseCase: UnlinkDeviceUseCase,
    private readonly updateDeviceCapabilitiesUseCase: UpdateDeviceCapabilitiesUseCase,
    private readonly getDeviceDiagnosticsUseCase: GetDeviceDiagnosticsUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  @Get(':id/diagnostics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get comprehensive diagnostics and health problems for a device',
  })
  @ApiResponse({ status: 200, type: DiagnosticsResponseDto })
  async getDiagnostics(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<DiagnosticsResponseDto> {
    return this.getDeviceDiagnosticsUseCase.execute(id, user.userId);
  }

  @Patch(':id/capabilities')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update device capabilities reported by the device itself (Authorization: Device <token>)',
  })
  @ApiResponse({ status: 200, type: DeviceResponseDto })
  async updateCapabilities(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateDeviceCapabilitiesDto,
  ): Promise<{ device: DeviceResponseDto }> {
    const authenticatingDevice = (req as any).device;
    return this.updateDeviceCapabilitiesUseCase.execute({
      deviceId: id,
      authenticatingDeviceId: authenticatingDevice.id,
      adminEnabled: dto.adminEnabled,
      permissions: dto.permissions,
      batteryLevel: dto.batteryLevel,
      isCharging: dto.isCharging,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
