import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway.js';
import { EVENT_PUBLISHER_PORT } from '../../shared/events/event-publisher.port.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [
    RealtimeGateway,
    {
      provide: EVENT_PUBLISHER_PORT,
      useExisting: RealtimeGateway,
    },
  ],
  exports: [RealtimeGateway, EVENT_PUBLISHER_PORT],
})
export class RealtimeModule {}
