import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

export interface TwoFactorCryptoPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  hashBackupCode(code: string): string;
}

export const TWO_FACTOR_CRYPTO_PORT = Symbol('TWO_FACTOR_CRYPTO_PORT');

export class AesTwoFactorCryptoService implements TwoFactorCryptoPort {
  private readonly key: Buffer;

  constructor(secretKey: string) {
    // Derive exactly 32 bytes key using sha256
    this.key = createHash('sha256').update(secretKey).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12); // GCM standard 96-bit IV
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  hashBackupCode(code: string): string {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }
}
