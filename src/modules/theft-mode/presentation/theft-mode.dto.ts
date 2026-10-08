import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivateTheftModeDto {
  @ApiProperty({
    example: 'Este teléfono fue reportado como robado. Por favor devolverlo al dueño.',
    description: 'Message shown on lockscreen (1..200 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  message!: string;

  @ApiPropertyOptional({
    example: '+573001234567',
    description: 'Contact phone number (5..20 digits, optional leading +)',
  })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  @Matches(/^\+?[0-9]+$/, {
    message: 'contactPhone must contain only digits and an optional leading "+"',
  })
  contactPhone?: string;

  @ApiProperty({
    example: 60,
    description: 'Location report interval in seconds (60..900)',
    minimum: 60,
    maximum: 900,
  })
  @IsInt()
  @Min(60)
  @Max(900)
  locationIntervalSeconds!: number;

  @ApiProperty({
    example: true,
    description: 'Trigger loud alarm on the device',
  })
  @IsBoolean()
  alarm!: boolean;

  @ApiProperty({
    example: true,
    description: 'Lock device screen using Device Admin',
  })
  @IsBoolean()
  lock!: boolean;
}

export class DeactivateTheftModeDto {
  @ApiProperty({
    example: 'SecretPassword123!',
    description: 'Account password required to confirm deactivation',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class TheftModeResponseDto {
  @ApiProperty({ example: '8cf41f87-a2f0-4592-886b-31d79e5fa47c' })
  id!: string;

  @ApiProperty({ example: '2690fc16-f30c-43f6-95ff-43bc919e1e23' })
  deviceId!: string;

  @ApiProperty({ example: '6942c7aa-00b8-4c12-9c17-eb71887e2b10' })
  activatedById!: string;

  @ApiProperty({ example: '2026-10-07T20:45:00.000Z' })
  activatedAt!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  deactivatedAt?: string | null;

  @ApiProperty({ example: 'Este teléfono fue reportado como robado.' })
  message!: string;

  @ApiPropertyOptional({ example: '+573001234567', nullable: true })
  contactPhone?: string | null;

  @ApiProperty({ example: 60 })
  locationIntervalSeconds!: number;

  @ApiProperty({ example: true })
  alarm!: boolean;

  @ApiProperty({ example: true })
  lock!: boolean;
}

export class ActivateTheftModeResponseDto {
  @ApiProperty({ type: TheftModeResponseDto })
  theftMode!: TheftModeResponseDto;

  @ApiProperty({ description: 'Created THEFT_MODE_ON command' })
  command!: any;
}

export class DeactivateTheftModeResponseDto {
  @ApiProperty({ type: TheftModeResponseDto })
  theftMode!: TheftModeResponseDto;

  @ApiProperty({ description: 'Created THEFT_MODE_OFF command' })
  command!: any;

  @ApiProperty({ example: false })
  forced!: boolean;
}
