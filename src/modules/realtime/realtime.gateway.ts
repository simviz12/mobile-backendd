import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  EventPublisherPort,
  DeviceStatusEventPayload,
  DeviceLifecycleEventPayload,
  CommandUpdatedEventPayload,
  LocationUpdatedEventPayload,
} from '../../shared/events/event-publisher.port.js';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: '*',
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, EventPublisherPort
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth or query or headers
      const rawToken =
        client.handshake?.auth?.token ??
        client.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '') ??
        client.handshake?.query?.token;

      if (!rawToken || typeof rawToken !== 'string') {
        this.logger.warn(`Rejected WebSocket connection: missing token from client ${client.id}`);
        client.disconnect(true);
        return;
      }

      const token = rawToken.replace(/^Bearer\s+/i, '').trim();
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');

      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = payload.sub || payload.userId;

      if (!userId) {
        this.logger.warn(`Rejected WebSocket connection: missing user ID in JWT payload`);
        client.disconnect(true);
        return;
      }

      // Attach userId to client socket and join private user room
      (client as any).userId = userId;
      const room = `user:${userId}`;
      await client.join(room);

      this.logger.log(`Client ${client.id} authenticated as user ${userId} and joined room ${room}`);
    } catch (err: any) {
      this.logger.warn(`Rejected WebSocket connection: invalid token (${err.message}) from client ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    this.logger.log(`Client ${client.id} disconnected (user: ${userId ?? 'unauthenticated'})`);
  }

  publishToUser(userId: string, eventName: 'device.status', payload: DeviceStatusEventPayload): void;
  publishToUser(userId: string, eventName: 'device.linked', payload: DeviceLifecycleEventPayload): void;
  publishToUser(userId: string, eventName: 'device.unlinked', payload: DeviceLifecycleEventPayload): void;
  publishToUser(userId: string, eventName: 'command.updated', payload: CommandUpdatedEventPayload): void;
  publishToUser(userId: string, eventName: 'location.updated', payload: LocationUpdatedEventPayload): void;
  publishToUser(userId: string, eventName: string, payload: any): void {
    if (!this.server) {
      this.logger.warn(`WebSocket server not ready; skipping emit for event ${eventName} to user:${userId}`);
      return;
    }
    const room = `user:${userId}`;
    this.server.to(room).emit(eventName, payload);
    this.logger.log(`Dispatched event "${eventName}" to room "${room}"`);
  }
}
