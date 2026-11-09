import { ConfigService } from '@nestjs/config';
import { AppConfig, parseEnv } from './env.validation';

/**
 * A ConfigService for unit tests, built from the real schema so defaults and
 * types match the app. Pass raw env-style overrides, e.g. { OTP_LENGTH: '4' }.
 */
export function testConfig(
  overrides: Partial<Record<keyof AppConfig, unknown>> = {},
): ConfigService<AppConfig, true> {
  const values = parseEnv({
    DATABASE_URL: 'postgresql://test:test@localhost:5432/unit_test',
    JWT_SECRET_KEY: 'unit-test-secret-of-at-least-32-chars',
    ...overrides,
  });
  const get = (key: keyof AppConfig) => values[key];
  return { get, getOrThrow: get } as unknown as ConfigService<AppConfig, true>;
}
