export interface DeviceTokenGenerator {
  generateToken(): string;
  hashToken(token: string): string;
}

export const DEVICE_TOKEN_GENERATOR = Symbol('DEVICE_TOKEN_GENERATOR');
