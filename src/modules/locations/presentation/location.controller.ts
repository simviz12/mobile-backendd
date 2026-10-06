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
import { RecordLocationUseCase } from '../application/record-location.usecase.js';
import { GetLatestLocationUseCase } from '../application/get-latest-location.usecase.js';
import { ListLocationsUseCase } from '../application/list-locations.usecase.js';
import {
  LocationResponseDto,
  PostLocationDto,
  QueryLocationsDto,
} from './location.dto.js';
import { LocationSource } from '../domain/location.entity.js';

@ApiTags('Locations')
@Controller('devices/:id/locations')
export class LocationController {
  constructor(
    private readonly recordLocationUseCase: RecordLocationUseCase,
    private readonly getLatestLocationUseCase: GetLatestLocationUseCase,
    private readonly listLocationsUseCase: ListLocationsUseCase,
  ) {}

  @Post()
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record device location (single or batch up to 50 items) (Authorization: Device <token>)',
  })
  @ApiResponse({ status: 201, type: [LocationResponseDto] })
  async recordLocation(
    @Param('id') deviceId: string,
    @Req() req: Request,
    @Body() dto: PostLocationDto,
  ): Promise<LocationResponseDto[] | LocationResponseDto> {
    const authenticatingDevice = (req as any).device;

    const item =
      dto.latitude !== undefined && dto.longitude !== undefined && dto.recordedAt && dto.source
        ? {
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracyMeters: dto.accuracyMeters,
            speedMps: dto.speedMps,
            recordedAt: dto.recordedAt,
            source: dto.source as LocationSource,
          }
        : undefined;

    const locations = dto.locations?.map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracyMeters: loc.accuracyMeters,
      speedMps: loc.speedMps,
      recordedAt: loc.recordedAt,
      source: loc.source,
    }));

    const results = await this.recordLocationUseCase.execute({
      deviceId,
      authenticatingDeviceId: authenticatingDevice.id,
      item,
      locations,
    });

    const response = results.map((r) => r.toResponse());
    return dto.locations ? response : response[0];
  }

  @Get('latest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get latest recorded location for a device' })
  @ApiResponse({ status: 200, type: LocationResponseDto })
  async getLatestLocation(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
  ): Promise<LocationResponseDto> {
    const latest = await this.getLatestLocationUseCase.execute({
      deviceId,
      callerUserId: user.userId,
    });
    return latest.toResponse();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get location history for a device (newest first, max 500)' })
  @ApiResponse({ status: 200, type: [LocationResponseDto] })
  async listLocations(
    @Param('id') deviceId: string,
    @CurrentUser() user: JwtValidatedUser,
    @Query() query: QueryLocationsDto,
  ): Promise<LocationResponseDto[]> {
    const list = await this.listLocationsUseCase.execute({
      deviceId,
      callerUserId: user.userId,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    return list.map((l) => l.toResponse());
  }
}
