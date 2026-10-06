import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: string;

  @ApiProperty({ example: 'guardian-api' })
  service!: string;

  @ApiProperty({ example: '0.0.1' })
  version!: string;

  @ApiProperty({ example: '2026-10-05T23:50:00.000Z' })
  time!: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database!: string;
}
