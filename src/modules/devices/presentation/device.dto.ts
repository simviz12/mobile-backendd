import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceMode } from '../domain/device.entity.js';

export class LinkDeviceDto {
  @ApiProperty({ example: 'install-uuid-12345' })
  @IsString()
  @IsNotEmpty({ message: 'installId should not be empty' })
  installId!: string;

  @ApiProperty({ example: 'My Pixel 8 Pro' })
  @IsString()
  @Length(1, 40, { message: 'name must be between 1 and 40 characters' })
  name!: string;

  @ApiProperty({ example: 'android', enum: ['android', 'ios'] })
  @IsIn(['android', 'ios'], { message: 'platform must be either android or ios' })
  platform!: 'android' | 'ios';

  @ApiPropertyOptional({ example: 'Pixel 8 Pro' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'Android 14' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiProperty({ enum: DeviceMode, example: DeviceMode.PROTECTED })
  @IsEnum(DeviceMode, { message: 'mode must be a valid DeviceMode (PROTECTED or CONTROLLER)' })
  mode!: DeviceMode;

  @ApiPropertyOptional({ example: 'fcm-registration-token-sample' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional({ example: 'Renamed Phone' })
  @IsOptional()
  @IsString()
  @Length(1, 40, { message: 'name must be between 1 and 40 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'fcm-new-token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}

export class DeviceResponseDto {
  @ApiProperty({ example: 'c028a39a-7964-42b7-a36e-5264b3017a52' })
  id!: string;

  @ApiProperty({ example: 'u123...' })
  ownerId!: string;

  @ApiProperty({ example: 'install-uuid-12345' })
  installId!: string;

  @ApiProperty({ example: 'My Pixel 8 Pro' })
  name!: string;

  @ApiProperty({ example: 'android' })
  platform!: string;

  @ApiPropertyOptional({ example: 'Pixel 8 Pro' })
  model?: string | null;

  @ApiPropertyOptional({ example: 'Android 14' })
  osVersion?: string | null;

  @ApiPropertyOptional({ example: '1.0.0' })
  appVersion?: string | null;

  @ApiProperty({ enum: DeviceMode, example: DeviceMode.PROTECTED })
  mode!: DeviceMode;

  @ApiPropertyOptional({ example: 'fcm-token-sample' })
  fcmToken?: string | null;

  @ApiProperty({ example: false })
  adminEnabled!: boolean;

  @ApiPropertyOptional({ example: 85 })
  batteryLevel?: number | null;

  @ApiPropertyOptional({ example: false })
  isCharging?: boolean | null;

  @ApiPropertyOptional({ example: null })
  lastSeenAt?: string | null;

  @ApiProperty({ example: false })
  isOnline!: boolean;

  @ApiPropertyOptional({
    example: {
      latitude: 4.6097,
      longitude: -74.0817,
      accuracyMeters: 10.5,
      recordedAt: '2026-10-06T12:00:00.000Z',
    },
    nullable: true,
  })
  lastLocation?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    recordedAt: string;
  } | null;

  @ApiProperty({ example: '2026-10-06T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-06T00:00:00.000Z' })
  updatedAt!: string;
}

export class DevicePermissionsDto {
  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  locationForeground?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  locationBackground?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  batteryOptimizationIgnored?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  deviceAdmin?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  fullScreenIntent?: boolean | null;
}

export class UpdateDeviceCapabilitiesDto {
  @ApiPropertyOptional({ example: true, description: 'Whether Device Admin privilege is active' })
  @IsOptional()
  @IsBoolean({ message: 'adminEnabled must be a boolean' })
  adminEnabled?: boolean;

  @ApiPropertyOptional({ type: DevicePermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DevicePermissionsDto)
  permissions?: DevicePermissionsDto;

  @ApiPropertyOptional({ example: 85, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number | null;

  @ApiPropertyOptional({ example: false, nullable: true })
  @IsOptional()
  @IsBoolean()
  isCharging?: boolean | null;
}

export class LinkDeviceResponseDto {
  @ApiProperty({ type: DeviceResponseDto })
  device!: DeviceResponseDto;

  @ApiProperty({ example: 'd9b736b...256bit-token' })
  deviceToken!: string;
}

export class ListDevicesResponseDto {
  @ApiProperty({ type: [DeviceResponseDto] })
  devices!: DeviceResponseDto[];
}

export class DiagnosticsLastCommandDto {
  @ApiProperty({ example: 'VIBRATE' })
  type!: string;

  @ApiProperty({ example: 'EXPIRED' })
  status!: string;

  @ApiPropertyOptional({ example: 'COMMAND_EXPIRED', nullable: true })
  failureReason!: string | null;

  @ApiProperty({ example: '2026-10-07T16:42:05.355Z' })
  at!: string;
}

export class DiagnosticsResponseDto {
  @ApiProperty({ example: true })
  hasFcmToken!: boolean;

  @ApiProperty({ example: true })
  hasDeviceToken!: boolean;

  @ApiPropertyOptional({ example: '2026-10-07T16:00:00.000Z', nullable: true })
  lastSeenAt!: string | null;

  @ApiPropertyOptional({ example: '2026-10-07T16:00:00.000Z', nullable: true })
  lastStatusAt!: string | null;

  @ApiPropertyOptional({ example: '2026-10-07T16:00:00.000Z', nullable: true })
  lastLocationAt!: string | null;

  @ApiPropertyOptional({ type: DiagnosticsLastCommandDto, nullable: true })
  lastCommand!: DiagnosticsLastCommandDto | null;

  @ApiProperty({ type: DevicePermissionsDto })
  permissions!: DevicePermissionsDto;

  @ApiProperty({ example: ['NO_HEARTBEAT', 'NO_LOCATION'], type: [String] })
  problems!: string[];
}
