import { generateSecret, generateURI, verifySync } from 'otplib';
import { randomBytes } from 'crypto';

export interface TotpServicePort {
  generateSecret(): string;
  generateOtpauthUrl(email: string, secret: string, issuer?: string): string;
  verifyToken(token: string, secret: string): boolean;
  generateBackupCodes(count?: number): string[];
}

export const TOTP_SERVICE_PORT = Symbol('TOTP_SERVICE_PORT');

export class OtplibTotpService implements TotpServicePort {
  generateSecret(): string {
    return generateSecret();
  }

  generateOtpauthUrl(email: string, secret: string, issuer = 'Guardian Mobile'): string {
    return generateURI({
      label: email,
      issuer,
      secret,
    });
  }

  verifyToken(token: string, secret: string): boolean {
    const cleanToken = token.trim().replace(/\s+/g, '');
    try {
      const result = verifySync({
        token: cleanToken,
        secret,
      });
      return !!(result && (result as any).valid);
    } catch {
      return false;
    }
  }

  generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // 8 hex characters formatted as XXXX-XXXX
      const hex = randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
    }
    return codes;
  }
}
