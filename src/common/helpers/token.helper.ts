import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

const DEFAULT_OTP_LENGTH = 6;

// OTP_LENGTH for class-validator decorators (VerifyOtpDto), which run outside
// DI: reads the value ConfigModule validated and published to process.env.
// Everywhere else, use ConfigService.
export function getOtpLength(): number {
  const length = Number(process.env.OTP_LENGTH);
  return Number.isInteger(length) && length > 0 ? length : DEFAULT_OTP_LENGTH;
}

// Numeric OTP from a CSPRNG. Zero-padded so every code has the same length
// and every value in the space is equally likely.
export function generateOtp(length: number): string {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += randomInt(0, 10).toString();
  }
  return otp;
}

// Opaque random token for refresh/reset flows.
export function generateToken(bytes = 64): string {
  return randomBytes(bytes).toString('hex');
}

// SHA-256 hex digest used to store OTPs and tokens at rest. These are
// high-entropy (or short-lived and attempt-limited) secrets, so a fast hash
// is enough — it only has to stop a DB leak from yielding usable values.
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function secretMatchesHash(value: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(value), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Parses "30s" / "15m" / "24h" / "3d" into milliseconds.
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value?.trim() ?? '');
  if (!match) {
    throw new Error(
      `Invalid duration: ${value}. Use a format like "15m", "24h" or "3d".`,
    );
  }
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * unitMs[match[2] as keyof typeof unitMs];
}
