import { randomBytes } from 'crypto';

// Environment for the e2e suite. Imported by the global setup (DB reset) and
// by every test file (setupFiles) before the app is loaded, so these values
// win over anything in .env — ConfigModule/dotenv never override set vars.

const DEFAULT_E2E_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/app_e2e_test';

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL || DEFAULT_E2E_DATABASE_URL;

// The global setup wipes this database. Refuse anything that doesn't look
// like a throwaway test database, so a misconfigured URL can't hit real data.
const dbName = new URL(E2E_DATABASE_URL).pathname.replace(/^\//, '');
if (!/test/i.test(dbName)) {
  throw new Error(
    `E2E_DATABASE_URL must point to a test database (name containing "test"); got "${dbName}".`,
  );
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  DATABASE_URL: E2E_DATABASE_URL,
  JWT_SECRET_KEY:
    process.env.E2E_JWT_SECRET_KEY || randomBytes(32).toString('hex'),
  JWT_EXPIRATION_TIME: '15m',
  REFRESH_TOKEN_EXPIRATION_TIME: '3d',
  // No Redis: the suite runs on the in-memory store
  REDIS_HOST: '',
  REDIS_HOSTS: '',
  // Each request sends its own X-Forwarded-For, as if behind one nginx
  TRUST_PROXY: '1',
  DISABLE_RATE_LIMIT: 'false',
  DISK_STORAGE: 'local',
  OTP_LENGTH: '6',
  OTP_MAX_ATTEMPTS: '5',
  OTP_EXPIRE_MINUTES: '5',
  OTP_RESEND_DELAY_SECONDS: '60',
  SYSTEM_LOG: 'true',
  ERROR_LOG: 'true',
  EXECUTE_CRON: 'false',
  APP_URL: 'http://localhost',
});
