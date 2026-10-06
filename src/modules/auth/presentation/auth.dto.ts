import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email should not be empty' })
  email!: string;

  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @ApiProperty({ example: 'Alex Developer' })
  @IsString()
  @IsNotEmpty({ message: 'displayName should not be empty' })
  displayName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email should not be empty' })
  email!: string;

  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @IsNotEmpty({ message: 'password should not be empty' })
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ example: 'd3f6a2...' })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken should not be empty' })
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ example: 'd3f6a2...' })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken should not be empty' })
  refreshToken!: string;
}

export class UserResponseDto {
  @ApiProperty({ example: '0c72e...' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alex Developer' })
  displayName!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ example: 'eyJhbGciOi...' })
  accessToken!: string;

  @ApiProperty({ example: '8f7d92...' })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class RefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  accessToken!: string;

  @ApiProperty({ example: '8f7d92...' })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class CurrentUserProfileDto {
  @ApiProperty({ example: '0c72e...' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alex Developer' })
  displayName!: string;

  @ApiProperty({ example: '2026-10-06T00:00:00.000Z' })
  createdAt!: Date;
}
