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
} from '../domain/device.repository.js';
import {
  DEVICE_TOKEN_GENERATOR,
  type DeviceTokenGenerator,
} from '../domain/device-token.generator.js';
import { AppError } from '../../../shared/errors/app-error.js';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
    @Inject(DEVICE_TOKEN_GENERATOR)
    private readonly tokenGenerator: DeviceTokenGenerator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Device ')) {
      throw new AppError(
        'UNAUTHORIZED',
        'Device authentication required (Authorization: Device <token>)',
        401,
      );
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new AppError(
        'UNAUTHORIZED',
        'Device token is required',
        401,
      );
    }

    const tokenHash = this.tokenGenerator.hashToken(token);
    const device = await this.deviceRepository.findByTokenHash(tokenHash);

    if (!device) {
      throw new AppError(
        'DEVICE_NOT_FOUND',
        'Invalid or revoked device token',
        401,
      );
    }

    // Attach device to request
    (request as any).device = device;
    return true;
  }
}
