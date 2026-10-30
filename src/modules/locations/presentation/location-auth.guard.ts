import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import {
  DEVICE_REPOSITORY,
  type DeviceRepository,
} from '../../devices/domain/device.repository.js';
import {
  DEVICE_TOKEN_GENERATOR,
  type DeviceTokenGenerator,
} from '../../devices/domain/device-token.generator.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../../shared/errors/app-error.js';

@Injectable()
export class LocationPostAuthGuard implements CanActivate {
  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
    @Inject(DEVICE_TOKEN_GENERATOR)
    private readonly tokenGenerator: DeviceTokenGenerator,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new AppError(
        'UNAUTHORIZED',
        'Authentication required (Bearer <jwt> or Device <token>)',
        401,
      );
    }

    const trimmed = authHeader.trim();

    // 1. Check Device <token>
    if (trimmed.toLowerCase().startsWith('device ')) {
      const token = trimmed.slice(7).trim();
      if (!token) {
        throw new AppError('UNAUTHORIZED', 'Device token is required', 401);
      }
      const tokenHash = this.tokenGenerator.hashToken(token);
      const device = await this.deviceRepository.findByTokenHash(tokenHash);
      if (!device) {
        throw new AppError('DEVICE_NOT_FOUND', 'Invalid or revoked device token', 401);
      }
      (request as any).device = device;
      return true;
    }

    // 2. Check Bearer <user_jwt>
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      const token = trimmed.slice(7).trim();
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      try {
        const payload = await this.jwtService.verifyAsync(token, { secret });
        const userId = payload.sub || payload.userId;
        const rawDeviceId = request.params.id;
        const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : (rawDeviceId as string);

        const device = await this.deviceRepository.findById(deviceId);
        if (!device) {
          throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
        }

        if (!device.belongsTo(userId)) {
          throw new AppError('FORBIDDEN', 'You do not own this device', 403);
        }

        (request as any).device = device;
        (request as any).user = payload;
        return true;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError('UNAUTHORIZED', `Invalid access token: ${err.message}`, 401);
      }
    }

    throw new AppError(
      'UNAUTHORIZED',
      'Supported authentication schemes: Bearer or Device',
      401,
    );
  }
}
