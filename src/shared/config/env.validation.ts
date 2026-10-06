import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
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
  @IsNotEmpty({ message: 'JWT_ACCESS_SECRET is required' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_SECRET is required' })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_ACCESS_TTL is required' })
  JWT_ACCESS_TTL!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_TTL is required' })
  JWT_REFRESH_TTL!: string;

  @IsNumber()
  HEARTBEAT_TIMEOUT_SECONDS: number = 300;

  @IsString()
  @IsNotEmpty({ message: 'FIREBASE_SERVICE_ACCOUNT_PATH is required' })
  FIREBASE_SERVICE_ACCOUNT_PATH!: string;

  @IsNumber()
  COMMAND_TTL_SECONDS: number = 120;

  @IsNumber()
  LOCK_COMMAND_TTL_SECONDS: number = 60;

  @IsNumber()
  LOCATION_RETENTION_DAYS: number = 30;
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
