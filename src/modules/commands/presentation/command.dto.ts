import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommandStatus, CommandType } from '../domain/command.entity.js';

export class RingPayloadDto {
  @ApiPropertyOptional({ example: 30, minimum: 5, maximum: 60, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5, { message: 'durationSeconds must be at least 5' })
  @Max(60, { message: 'durationSeconds must not exceed 60' })
  durationSeconds?: number = 30;
}

export class CreateCommandDto {
  @ApiProperty({ enum: CommandType, example: CommandType.RING })
  @IsEnum(CommandType, { message: 'type must be a valid CommandType (RING)' })
  type!: CommandType;

  @ApiPropertyOptional({ type: RingPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RingPayloadDto)
  payload?: RingPayloadDto;
}

export class AckCommandDto {
  @ApiProperty({
    enum: ['DELIVERED', 'EXECUTED', 'FAILED'],
    example: 'DELIVERED',
  })
  @IsIn(['DELIVERED', 'EXECUTED', 'FAILED'], {
    message: 'status must be DELIVERED, EXECUTED or FAILED',
  })
  status!: 'DELIVERED' | 'EXECUTED' | 'FAILED';

  @ApiPropertyOptional({ example: 'Sound played successfully' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CommandResponseDto {
  @ApiProperty({ example: 'c123...' })
  id!: string;

  @ApiProperty({ example: 'd123...' })
  deviceId!: string;

  @ApiProperty({ example: 'u123...' })
  issuedById!: string;

  @ApiProperty({ enum: CommandType, example: CommandType.RING })
  type!: CommandType;

  @ApiPropertyOptional({ example: { durationSeconds: 30 } })
  payload?: Record<string, any> | null;

  @ApiProperty({ enum: CommandStatus, example: CommandStatus.SENT })
  status!: CommandStatus;

  @ApiPropertyOptional({ example: null })
  failureReason?: string | null;

  @ApiProperty({ example: '2026-10-06T12:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-10-06T12:00:01.000Z' })
  sentAt?: string | null;

  @ApiPropertyOptional({ example: null })
  deliveredAt?: string | null;

  @ApiPropertyOptional({ example: null })
  executedAt?: string | null;

  @ApiProperty({ example: '2026-10-06T12:02:00.000Z' })
  expiresAt!: string;
}
