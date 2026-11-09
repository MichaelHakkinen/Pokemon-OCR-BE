import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

const DURATION_REGEX = /^\d+(s|m|h|d)$/;

// Env values arrive as strings. These transforms treat an empty value like a
// missing one (falling back to the default) and convert to the real type.
// A missing key keeps the property default; a present one goes through here.
type Raw = { value: unknown };
const blank = (v: unknown) => v === undefined || v === null || v === '';
const int =
  (fallback?: number) =>
  ({ value }: Raw) =>
    blank(value) ? fallback : Number(value);
// Only "true" (any case) is on — matching the old `=== 'true'` checks.
const flag =
  (fallback = false) =>
  ({ value }: Raw) =>
    blank(value) ? fallback : String(value).trim().toLowerCase() === 'true';
const str =
  (fallback?: string) =>
  ({ value }: Raw) =>
    blank(value) ? fallback : String(value).trim();

const usesStorage = (provider: string) => (env: AppConfig) =>
  env.DISK_STORAGE === provider;

const isDeployed = (env: AppConfig) =>
  env.APP_ENV === 'staging' || env.APP_ENV === 'production';

const needsMailRelay = (env: AppConfig) =>
  env.MAIL_SERVICE_ENABLED && isDeployed(env);

/**
 * Every environment variable the app reads, with its type and default.
 * Validated once at boot (ConfigModule), so a missing or malformed value
 * fails the deploy instead of surfacing later as NaN/undefined. Read values
 * through `ConfigService<AppConfig, true>`, e.g. `config.get('OTP_LENGTH')`.
 */
export class AppConfig {
  // ── App ──
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @Transform(str('development'))
  @IsIn(['development', 'staging', 'production', 'test'])
  APP_ENV: 'development' | 'staging' | 'production' | 'test' = 'development';

  @Transform(int(3000))
  @IsInt()
  APP_PORT: number = 3000;

  // Base URL used to build local file URLs (DISK_STORAGE=local).
  @Transform(str('http://localhost:3000'))
  @IsString()
  APP_URL: string = 'http://localhost:3000';

  @Transform(str('Asia/Jakarta'))
  @IsString()
  APP_TIMEZONE: string = 'Asia/Jakarta';

  // Default country calling code (no "+") for phone normalisation.
  @Transform(str('62'))
  @Matches(/^\d{1,4}$/, {
    message: 'APP_PHONE_COUNTRY_CODE must be 1-4 digits, e.g. 62',
  })
  APP_PHONE_COUNTRY_CODE: string = '62';

  // Comma-separated web origins allowed by CORS.
  @Transform(str(''))
  @IsString()
  ALLOWED_ORIGINS: string = '';

  // Express "trust proxy": number of reverse-proxy hops in front of the app
  // (e.g. 1 behind a single nginx), or false when exposed directly.
  // Determines which address request.ip — and so rate limiting — uses.
  @Transform(str('false'))
  @Matches(/^(false|true|\d+)$/, {
    message: 'TRUST_PROXY must be false, true, or a hop count like 1',
  })
  TRUST_PROXY: string = 'false';

  // ── Auth ──
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET_KEY must be at least 32 characters',
  })
  JWT_SECRET_KEY: string;

  @Transform(str('30m'))
  @Matches(DURATION_REGEX, {
    message: 'JWT_EXPIRATION_TIME must look like 15m, 1h, 1d',
  })
  JWT_EXPIRATION_TIME: string = '30m';

  @Transform(str('3d'))
  @Matches(DURATION_REGEX, {
    message: 'REFRESH_TOKEN_EXPIRATION_TIME must look like 3d, 12h, 30m',
  })
  REFRESH_TOKEN_EXPIRATION_TIME: string = '3d';

  // 32-byte hex key for encryptPayload/decryptPayload (crypto.helper.ts).
  // Generate with: openssl rand -hex 32
  @Transform(str())
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: 'ENCRYPT_SECRET_KEY must be 64 hex characters (32 bytes)',
  })
  ENCRYPT_SECRET_KEY?: string;

  // Number of digits in password-reset OTPs.
  @Transform(int(6))
  @IsInt()
  @Min(4)
  @Max(10)
  OTP_LENGTH: number = 6;

  @Transform(int(5))
  @IsInt()
  @Min(1)
  OTP_EXPIRE_MINUTES: number = 5;

  @Transform(int(60))
  @IsInt()
  @Min(0)
  OTP_RESEND_DELAY_SECONDS: number = 60;

  // Wrong guesses allowed per OTP before it is invalidated.
  @Transform(int(5))
  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPTS: number = 5;

  // ── Feature switches ──
  @Transform(flag())
  @IsBoolean({ message: 'SYSTEM_LOG must be true or false' })
  SYSTEM_LOG: boolean = false;

  @Transform(flag())
  @IsBoolean({ message: 'ERROR_LOG must be true or false' })
  ERROR_LOG: boolean = false;

  @Transform(flag())
  @IsBoolean({ message: 'DISABLE_RATE_LIMIT must be true or false' })
  DISABLE_RATE_LIMIT: boolean = false;

  // Run scheduled jobs on this instance (one replica only).
  @Transform(flag())
  @IsBoolean({ message: 'EXECUTE_CRON must be true or false' })
  EXECUTE_CRON: boolean = false;

  // ── Redis (optional: empty REDIS_HOST and REDIS_HOSTS = in-memory store) ──
  @Transform(str(''))
  @IsString()
  REDIS_HOST: string = '';

  // Cluster mode: comma-separated host:port pairs.
  @Transform(str(''))
  @IsString()
  REDIS_HOSTS: string = '';

  @Transform(int(6379))
  @IsInt()
  REDIS_PORT: number = 6379;

  @Transform(int(0))
  @IsInt()
  @Min(0)
  REDIS_DB: number = 0;

  @Transform(str())
  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  // ── Email (SMTP) ──
  @Transform(str())
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @Transform(int(587))
  @IsInt()
  SMTP_PORT: number = 587;

  @Transform(flag())
  @IsBoolean({ message: 'SMTP_SECURE must be true or false' })
  SMTP_SECURE: boolean = false;

  @Transform(str())
  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  SMTP_FROM?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  SMTP_FROM_NAME?: string;

  // ── Email (Marley HTTP mail relay, used by MailRelayService) ──
  // On by default. false = projects without Marley: the app starts without the
  // settings below and MailRelayService skips every send.
  @Transform(flag(true))
  @IsBoolean({ message: 'MAIL_SERVICE_ENABLED must be true or false' })
  MAIL_SERVICE_ENABLED: boolean = true;

  // No default: a guessed URL like localhost:4000 is the app itself inside the
  // Docker image. Required on deployed environments while the relay is on.
  @Transform(str())
  @ValidateIf(needsMailRelay)
  @IsNotEmpty({
    message:
      'MAIL_SERVICE_URL is required when MAIL_SERVICE_ENABLED=true and APP_ENV is staging or production',
  })
  MAIL_SERVICE_URL?: string;

  @Transform(str())
  @ValidateIf(needsMailRelay)
  @IsNotEmpty({
    message:
      'MAIL_VAULT_TOKEN is required when MAIL_SERVICE_ENABLED=true and APP_ENV is staging or production',
  })
  MAIL_VAULT_TOKEN?: string;

  // ── File storage ──
  @Transform(str('local'))
  @IsIn(['local', 's3', 'obs'])
  DISK_STORAGE: 'local' | 's3' | 'obs' = 'local';

  // AWS S3 — required when DISK_STORAGE=s3
  @Transform(str())
  @ValidateIf(usesStorage('s3'))
  @IsNotEmpty({ message: 'AWS_REGION is required when DISK_STORAGE=s3' })
  AWS_REGION?: string;

  @Transform(str())
  @ValidateIf(usesStorage('s3'))
  @IsNotEmpty({ message: 'AWS_ACCESS_KEY_ID is required when DISK_STORAGE=s3' })
  AWS_ACCESS_KEY_ID?: string;

  @Transform(str())
  @ValidateIf(usesStorage('s3'))
  @IsNotEmpty({
    message: 'AWS_SECRET_ACCESS_KEY is required when DISK_STORAGE=s3',
  })
  AWS_SECRET_ACCESS_KEY?: string;

  @Transform(str())
  @ValidateIf(usesStorage('s3'))
  @IsNotEmpty({
    message: 'AWS_S3_BUCKET_NAME is required when DISK_STORAGE=s3',
  })
  AWS_S3_BUCKET_NAME?: string;

  // Huawei OBS — required when DISK_STORAGE=obs
  @Transform(str())
  @ValidateIf(usesStorage('obs'))
  @IsNotEmpty({
    message: 'OBS_ACCESS_KEY_ID is required when DISK_STORAGE=obs',
  })
  OBS_ACCESS_KEY_ID?: string;

  @Transform(str())
  @ValidateIf(usesStorage('obs'))
  @IsNotEmpty({
    message: 'OBS_SECRET_ACCESS_KEY is required when DISK_STORAGE=obs',
  })
  OBS_SECRET_ACCESS_KEY?: string;

  @Transform(str())
  @ValidateIf(usesStorage('obs'))
  @IsNotEmpty({ message: 'OBS_ENDPOINT is required when DISK_STORAGE=obs' })
  OBS_ENDPOINT?: string;

  @Transform(str())
  @ValidateIf(usesStorage('obs'))
  @IsNotEmpty({ message: 'OBS_BUCKET_NAME is required when DISK_STORAGE=obs' })
  OBS_BUCKET_NAME?: string;

  // Public/CDN domain used to build OBS file URLs.
  @Transform(str())
  @IsOptional()
  @IsString()
  OBS_DOMAIN_NAME?: string;

  @Transform(int(300))
  @IsInt()
  @Min(1)
  OBS_SIGNED_URL_EXPIRES: number = 300;

  // Huawei CDN token auth (optional). Kept as raw strings: ObsService parses
  // the lists (comma/semicolon separated) and the enabled flag (true/1/yes).
  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_TOKEN_AUTH_ENABLED?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_TOKEN_AUTH_KEY?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_TOKEN_AUTH_PARAM?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_TOKEN_AUTH_ALGORITHM?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_TOKEN_PROTECTED_PREFIXES?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_TOKEN_PROTECTED_EXTENSIONS?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  CDN_UNSIGNED_PUBLIC_PREFIXES?: string;

  // ── Firebase push notifications (optional) ──
  @Transform(str())
  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  FIREBASE_CLIENT_EMAIL?: string;

  @Transform(str())
  @IsOptional()
  @IsString()
  FIREBASE_PRIVATE_KEY?: string;
}

/** Parses and validates raw env values into an AppConfig. No side effects. */
export function parseEnv(raw: Record<string, unknown>): AppConfig {
  const config = plainToInstance(AppConfig, raw, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .map((msg) => `  - ${msg}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return config;
}

/**
 * ConfigModule `validate` hook. Besides validating, it publishes defaults to
 * process.env for the few places that can't use DI and read it directly: DTO
 * validators (OTP length), ConditionalModule (EXECUTE_CRON), and separate
 * processes spawned from the app. Everything else uses ConfigService.
 */
export function validateEnv(raw: Record<string, unknown>) {
  const config = parseEnv(raw);
  for (const [key, value] of Object.entries(config)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = String(value);
    }
  }
  return { ...raw, ...config };
}
