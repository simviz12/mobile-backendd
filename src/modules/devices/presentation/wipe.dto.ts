import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WipeDeviceDto {
  @ApiProperty({
    example: 'AccountPassword123!',
    description: 'Account password of the device owner',
  })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password!: string;

  @ApiProperty({
    example: 'BORRAR',
    description: 'Case-sensitive confirmation text that must equal exactly "BORRAR"',
  })
  @IsString()
  @IsNotEmpty({ message: 'confirmationText is required' })
  confirmationText!: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'TOTP or backup code (required if 2FA is enabled on user account)',
  })
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}

export class WipeResponseDto {
  @ApiProperty({ description: 'Created WIPE command details' })
  command!: any;
}
