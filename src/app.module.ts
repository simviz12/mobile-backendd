import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './shared/config/env.validation.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { DevicesModule } from './modules/devices/devices.module.js';
import { CommandsModule } from './modules/commands/commands.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { TheftModeModule } from './modules/theft-mode/theft-mode.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    RealtimeModule,
    HealthModule,
    UsersModule,
    AuthModule,
    DevicesModule,
    CommandsModule,
    LocationsModule,
    TheftModeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
