import { parseEnv, validateEnv } from './env.validation';

const VALID = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET_KEY: 'x'.repeat(32),
};

describe('validateEnv', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('accepts the minimal required set and applies defaults', () => {
    delete process.env.OTP_LENGTH;
    const env = validateEnv({ ...VALID });

    expect(env.OTP_LENGTH).toBe(6);
    expect(env.OTP_MAX_ATTEMPTS).toBe(5);
    expect(env.JWT_EXPIRATION_TIME).toBe('30m');
  });

  it('publishes defaults to process.env for code that reads it directly', () => {
    delete process.env.OTP_LENGTH;
    validateEnv({ ...VALID });
    expect(process.env.OTP_LENGTH).toBe('6');
  });

  it('does not overwrite values that are already set', () => {
    process.env.OTP_LENGTH = '4';
    validateEnv({ ...VALID, OTP_LENGTH: '4' });
    expect(process.env.OTP_LENGTH).toBe('4');
  });

  it.each([
    ['missing DATABASE_URL', { JWT_SECRET_KEY: 'x'.repeat(32) }],
    ['short JWT secret', { ...VALID, JWT_SECRET_KEY: 'secret' }],
    ['OTP_LENGTH below 4', { ...VALID, OTP_LENGTH: '3' }],
    ['OTP_LENGTH above 10', { ...VALID, OTP_LENGTH: '11' }],
    ['malformed duration', { ...VALID, JWT_EXPIRATION_TIME: '1 day' }],
    ['bad TRUST_PROXY', { ...VALID, TRUST_PROXY: 'nginx' }],
    ['non-hex ENCRYPT_SECRET_KEY', { ...VALID, ENCRYPT_SECRET_KEY: 'abc' }],
  ])('rejects %s', (_label, config) => {
    expect(() => validateEnv(config)).toThrow(
      /Invalid environment configuration/,
    );
  });

  describe('typed values (parseEnv)', () => {
    it('treats empty values as missing and applies defaults', () => {
      const env = parseEnv({
        ...VALID,
        APP_TIMEZONE: '',
        SMTP_PORT: '',
        REDIS_DB: '',
      });
      expect(env.APP_TIMEZONE).toBe('Asia/Jakarta');
      expect(env.SMTP_PORT).toBe(587);
      expect(env.REDIS_DB).toBe(0);
    });

    it('turns switches into booleans; only "true" (any case) is on', () => {
      const env = parseEnv({
        ...VALID,
        SYSTEM_LOG: 'TRUE',
        ERROR_LOG: 'false',
        SMTP_SECURE: '1',
      });
      expect(env.SYSTEM_LOG).toBe(true);
      expect(env.ERROR_LOG).toBe(false);
      expect(env.SMTP_SECURE).toBe(false);
      expect(parseEnv({ ...VALID }).EXECUTE_CRON).toBe(false);
    });

    it('treats an empty REDIS_HOST as "no Redis"', () => {
      expect(parseEnv({ ...VALID, REDIS_HOST: '' }).REDIS_HOST).toBe('');
      expect(parseEnv({ ...VALID }).REDIS_HOST).toBe('');
    });

    it('requires OBS credentials only when DISK_STORAGE=obs', () => {
      expect(() => parseEnv({ ...VALID, DISK_STORAGE: 'local' })).not.toThrow();
      expect(() => parseEnv({ ...VALID, DISK_STORAGE: 'obs' })).toThrow(
        /OBS_BUCKET_NAME is required when DISK_STORAGE=obs/,
      );
      expect(() =>
        parseEnv({
          ...VALID,
          DISK_STORAGE: 'obs',
          OBS_ACCESS_KEY_ID: 'ak',
          OBS_SECRET_ACCESS_KEY: 'sk',
          OBS_ENDPOINT: 'obs.example.com',
          OBS_BUCKET_NAME: 'bucket',
        }),
      ).not.toThrow();
    });

    describe('mail relay', () => {
      const MARLEY = {
        MAIL_SERVICE_URL: 'http://marley:4000',
        MAIL_VAULT_TOKEN: 'token',
      };

      it('is on by default; only "false" turns it off', () => {
        expect(parseEnv({ ...VALID }).MAIL_SERVICE_ENABLED).toBe(true);
        expect(
          parseEnv({ ...VALID, MAIL_SERVICE_ENABLED: '' }).MAIL_SERVICE_ENABLED,
        ).toBe(true);
        expect(
          parseEnv({ ...VALID, MAIL_SERVICE_ENABLED: 'false' })
            .MAIL_SERVICE_ENABLED,
        ).toBe(false);
      });

      it('requires the URL and token on staging and production while on', () => {
        expect(() => parseEnv({ ...VALID })).not.toThrow();
        for (const APP_ENV of ['staging', 'production']) {
          expect(() => parseEnv({ ...VALID, APP_ENV })).toThrow(
            /MAIL_SERVICE_URL is required when MAIL_SERVICE_ENABLED=true/,
          );
          expect(() => parseEnv({ ...VALID, APP_ENV })).toThrow(
            /MAIL_VAULT_TOKEN is required when MAIL_SERVICE_ENABLED=true/,
          );
          expect(() =>
            parseEnv({ ...VALID, APP_ENV, ...MARLEY }),
          ).not.toThrow();
        }
      });

      it('needs neither when MAIL_SERVICE_ENABLED=false', () => {
        for (const APP_ENV of ['staging', 'production']) {
          expect(() =>
            parseEnv({ ...VALID, APP_ENV, MAIL_SERVICE_ENABLED: 'false' }),
          ).not.toThrow();
        }
      });
    });

    it('requires AWS credentials only when DISK_STORAGE=s3', () => {
      expect(() => parseEnv({ ...VALID, DISK_STORAGE: 's3' })).toThrow(
        /AWS_S3_BUCKET_NAME is required when DISK_STORAGE=s3/,
      );
    });

    it('rejects malformed numbers', () => {
      expect(() => parseEnv({ ...VALID, SMTP_PORT: 'abc' })).toThrow(
        /SMTP_PORT/,
      );
    });

    it('has no side effects on process.env', () => {
      delete process.env.APP_TIMEZONE;
      parseEnv({ ...VALID });
      expect(process.env.APP_TIMEZONE).toBeUndefined();
    });
  });
});
