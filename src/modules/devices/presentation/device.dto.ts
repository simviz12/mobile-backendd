import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
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

  @ApiPropertyOptional({ example: 85 })
  batteryLevel?: number | null;

  @ApiPropertyOptional({ example: false })
  isCharging?: boolean | null;

  @ApiPropertyOptional({ example: null })
  lastSeenAt?: string | null;

  @ApiProperty({ example: false })
  isOnline!: boolean;

  @ApiProperty({ example: '2026-10-06T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-06T00:00:00.000Z' })
  updatedAt!: string;
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
