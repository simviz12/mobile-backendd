import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DeviceTokenGenerator } from '../domain/device-token.generator.js';

@Injectable()
export class CryptoDeviceTokenGenerator implements DeviceTokenGenerator {
  generateToken(): string {
    // 256-bit high-entropy random token hex encoded (32 bytes = 64 hex characters)
    return randomBytes(32).toString('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
