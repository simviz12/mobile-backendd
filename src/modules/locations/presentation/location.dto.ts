import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationSource } from '../domain/location.entity.js';

export class SingleLocationDto {
  @ApiProperty({ example: 4.60971, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90, { message: 'latitude must be between -90 and 90' })
  @Max(90, { message: 'latitude must be between -90 and 90' })
  latitude!: number;

  @ApiProperty({ example: -74.08175, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180, { message: 'longitude must be between -180 and 180' })
  @Max(180, { message: 'longitude must be between -180 and 180' })
  longitude!: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: 1.2 })
  @IsOptional()
  @IsNumber()
  speedMps?: number;

  @ApiProperty({ example: '2026-10-06T12:00:00.000Z' })
  @IsDateString({}, { message: 'recordedAt must be a valid ISO 8601 date string' })
  recordedAt!: string;

  @ApiProperty({ enum: LocationSource, example: LocationSource.LOCATE_COMMAND })
  @IsEnum(LocationSource, { message: 'source must be LOCATE_COMMAND, PERIODIC or THEFT_MODE' })
  source!: LocationSource;
}

export class PostLocationDto {
  @ApiPropertyOptional({ example: 4.60971 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -74.08175 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: 1.2 })
  @IsOptional()
  @IsNumber()
  speedMps?: number;

  @ApiPropertyOptional({ example: '2026-10-06T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional({ enum: LocationSource, example: LocationSource.LOCATE_COMMAND })
  @IsOptional()
  @IsEnum(LocationSource)
  source?: LocationSource;

  @ApiPropertyOptional({ type: [SingleLocationDto], description: 'Batch array up to 50 locations' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleLocationDto)
  locations?: SingleLocationDto[];
}

export class QueryLocationsDto {
  @ApiPropertyOptional({ example: '2026-10-06T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-06T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 500, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}

export class LocationResponseDto {
  @ApiProperty({ example: 'loc-uuid' })
  id!: string;

  @ApiProperty({ example: 'dev-uuid' })
  deviceId!: string;

  @ApiProperty({ example: 4.60971 })
  latitude!: number;

  @ApiProperty({ example: -74.08175 })
  longitude!: number;

  @ApiPropertyOptional({ example: 12.5, nullable: true })
  accuracyMeters?: number | null;

  @ApiPropertyOptional({ example: 1.2, nullable: true })
  speedMps?: number | null;

  @ApiProperty({ example: '2026-10-06T12:00:00.000Z' })
  recordedAt!: string;

  @ApiProperty({ example: '2026-10-06T12:00:01.000Z' })
  receivedAt!: string;

  @ApiProperty({ enum: LocationSource, example: LocationSource.LOCATE_COMMAND })
  source!: LocationSource;
}
