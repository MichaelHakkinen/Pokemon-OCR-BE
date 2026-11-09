import {
  durationToMs,
  generateOtp,
  getOtpLength,
  hashSecret,
  secretMatchesHash,
} from './token.helper';

describe('token.helper', () => {
  const originalLength = process.env.OTP_LENGTH;

  afterEach(() => {
    if (originalLength === undefined) delete process.env.OTP_LENGTH;
    else process.env.OTP_LENGTH = originalLength;
  });

  describe('generateOtp', () => {
    it.each([4, 6, 8])('produces %i numeric digits', (length) => {
      const otp = generateOtp(length);
      expect(otp).toMatch(new RegExp(`^\\d{${length}}$`));
    });

    it('keeps leading zeros', () => {
      const otps = Array.from({ length: 500 }, () => generateOtp(4));
      expect(otps.every((otp) => otp.length === 4)).toBe(true);
    });
  });

  describe('getOtpLength (for DTO validation)', () => {
    it('follows OTP_LENGTH', () => {
      process.env.OTP_LENGTH = '8';
      expect(getOtpLength()).toBe(8);
    });

    it('defaults to 6 when OTP_LENGTH is unset', () => {
      delete process.env.OTP_LENGTH;
      expect(getOtpLength()).toBe(6);
    });
  });

  describe('hashSecret / secretMatchesHash', () => {
    it('never returns the plaintext', () => {
      expect(hashSecret('123456')).not.toContain('123456');
      expect(hashSecret('123456')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('matches only the original value', () => {
      const hash = hashSecret('123456');
      expect(secretMatchesHash('123456', hash)).toBe(true);
      expect(secretMatchesHash('123457', hash)).toBe(false);
    });

    it('rejects malformed hashes without throwing', () => {
      expect(secretMatchesHash('123456', 'not-a-hash')).toBe(false);
    });
  });

  describe('durationToMs', () => {
    it.each([
      ['30s', 30_000],
      ['15m', 900_000],
      ['24h', 86_400_000],
      ['3d', 259_200_000],
    ])('parses %s', (input, expected) => {
      expect(durationToMs(input)).toBe(expected);
    });

    it.each(['', '3', '3w', 'abc'])('rejects %p', (input) => {
      expect(() => durationToMs(input)).toThrow();
    });
  });
});
