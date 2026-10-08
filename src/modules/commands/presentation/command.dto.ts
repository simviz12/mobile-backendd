import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommandStatus, CommandType } from '../domain/command.entity.js';

export class CreateCommandDto {
  @ApiProperty({
    enum: CommandType,
    example: CommandType.RING,
    description: 'Type of remote command (RING, VIBRATE, MESSAGE, LOCK, LOCATE, THEFT_MODE_ON, THEFT_MODE_OFF)',
  })
  @IsEnum(CommandType, {
    message: 'type must be a valid CommandType (RING, VIBRATE, MESSAGE, LOCK, LOCATE, THEFT_MODE_ON, THEFT_MODE_OFF)',
  })
  type!: CommandType;

  @ApiPropertyOptional({
    description:
      'Payload specific to the command type. RING: {durationSeconds: 5..60}. VIBRATE: {durationSeconds: 1..30}. MESSAGE: {text: 1..200, contactPhone?: string}. THEFT_MODE_ON: {message, contactPhone?, locationIntervalSeconds, alarm, lock}. LOCK/LOCATE/THEFT_MODE_OFF: no payload allowed.',
    example: { durationSeconds: 30 },
  })
  @IsOptional()
  payload?: any;
}

export class ListCommandsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 50,
    default: 20,
    description: 'Number of items to return (1..50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'eyJpZCI6IjEyMyJ9',
    description: 'Opaque cursor for pagination',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    enum: CommandStatus,
    description: 'Filter by command status',
  })
  @IsOptional()
  @IsEnum(CommandStatus)
  status?: CommandStatus;

  @ApiPropertyOptional({
    enum: CommandType,
    description: 'Filter by command type',
  })
  @IsOptional()
  @IsEnum(CommandType)
  type?: CommandType;
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

export class PaginatedCommandsResponseDto {
  @ApiProperty({ type: [CommandResponseDto] })
  items!: CommandResponseDto[];

  @ApiPropertyOptional({
    example: 'c123...',
    nullable: true,
    description: 'Opaque cursor for the next page, or null if no further pages',
  })
  nextCursor!: string | null;
}
