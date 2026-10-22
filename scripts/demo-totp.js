import { generateSecret, generateSync, verifySync } from 'otplib';

// Sample helper to generate a current TOTP code for testing
const secret = process.argv[2] || generateSecret();
const token = generateSync({ secret });
const verification = verifySync({ token, secret });

console.log('Secret:', secret);
console.log('Current TOTP Token (6 digits):', token);
console.log('Verification check:', verification.valid ? 'VALID' : 'INVALID');
console.log('Valid for approximately:', 30 - (Math.floor(Date.now() / 1000) % 30), 'seconds');
