import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsNumber()
  PORT: number = 3000;

  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET: string = 'guardian_default_jwt_access_secret_prod_key_2026';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'guardian_default_jwt_refresh_secret_prod_key_2026';

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL: string = '30d';

  @IsNumber()
  HEARTBEAT_TIMEOUT_SECONDS: number = 300;

  @IsOptional()
  @IsString()
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;

  @IsNumber()
  COMMAND_TTL_SECONDS: number = 120;

  @IsNumber()
  LOCK_COMMAND_TTL_SECONDS: number = 60;

  @IsNumber()
  WIPE_COMMAND_TTL_SECONDS: number = 600;

  @IsNumber()
  LOCATION_RETENTION_DAYS: number = 30;

  @Transform(({ value }) => value === 'true' || value === true || value === 1 || value === '1')
  @IsBoolean()
  ALLOW_REMOTE_WIPE: boolean = false;

  @IsString()
  ALLOWED_ORIGINS: string = '*';

  @IsString()
  TWO_FACTOR_ENCRYPTION_KEY: string = 'guardian-default-two-factor-encryption-key-32bytes!';
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorDetails = errors
      .map((err) => {
        const constraints = Object.values(err.constraints || {}).join(', ');
        return `  - ${err.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `\n❌ Configuration validation error. Missing or invalid environment variables:\n${errorDetails}\nPlease check your .env file against .env.example.\n`,
    );
  }

  return validatedConfig;
}
