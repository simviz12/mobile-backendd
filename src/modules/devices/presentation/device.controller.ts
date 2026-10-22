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
import { Throttle } from '@nestjs/throttler';
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
import { ReportDeviceStatusUseCase } from '../application/report-device-status.usecase.js';
import { ExecuteWipeUseCase } from '../../commands/application/execute-wipe.usecase.js';
import { WipeDeviceDto, WipeResponseDto } from './wipe.dto.js';
import {
  DeviceResponseDto,
  DiagnosticsResponseDto,
  LinkDeviceDto,
  LinkDeviceResponseDto,
  ListDevicesResponseDto,
  ReportStatusDto,
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
    private readonly reportDeviceStatusUseCase: ReportDeviceStatusUseCase,
    private readonly executeWipeUseCase: ExecuteWipeUseCase,
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

  @Post(':id/status')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Report battery, charging, network type, and touch device heartbeat (Authorization: Device <token>)',
  })
  @ApiResponse({ status: 204, description: 'Status recorded successfully' })
  async reportStatus(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: ReportStatusDto,
  ): Promise<void> {
    const authenticatingDevice = (req as any).device;
    await this.reportDeviceStatusUseCase.execute({
      deviceId: id,
      authenticatingDeviceId: authenticatingDevice.id,
      batteryLevel: dto.batteryLevel,
      isCharging: dto.isCharging,
      networkType: dto.networkType,
      appVersion: dto.appVersion,
    });
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
      wipeEnabled: dto.wipeEnabled,
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

  @Post(':id/wipe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Request remote wipe for a protected device (requires password and confirmation text "BORRAR")',
  })
  @ApiResponse({
    status: 202,
    description: 'Wipe command dispatched to device',
    type: WipeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR (confirmation text must equal "BORRAR")' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'WIPE_DISABLED' })
  @ApiResponse({ status: 404, description: 'DEVICE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DEVICE_NOT_PROTECTED or CAPABILITY_NOT_AVAILABLE or DEVICE_NOT_REACHABLE' })
  @ApiResponse({ status: 429, description: 'Too Many Requests (Rate limit exceeded)' })
  async wipeDevice(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: WipeDeviceDto,
    @Req() req: Request,
  ): Promise<WipeResponseDto> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;

    const command = await this.executeWipeUseCase.execute({
      deviceId: id,
      callerUserId: user.userId,
      password: dto.password,
      confirmationText: dto.confirmationText,
      twoFactorCode: dto.twoFactorCode,
      callerIp: ip,
      userAgent,
    });

    return { command: command.toResponse() };
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
