import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TranslatedValidationPipe } from './pipes/translated-validation.pipe';

// HTTP-level setup shared by main.ts and the e2e tests, so tests exercise the
// app exactly as it runs in production.
export function configureApp(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);

  // How many reverse proxies sit in front of the app. Express uses this to
  // pick the real client address for request.ip from X-Forwarded-For; with
  // it unset, every request behind nginx would appear to come from nginx.
  const trustProxy = configService.get<string>('TRUST_PROXY', 'false');
  app.set(
    'trust proxy',
    /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true',
  );

  const allowedWebOrigins = configService
    .get<string>('ALLOWED_ORIGINS', '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Mobile apps don't send an Origin header — allow through
      if (!requestOrigin) return callback(null, true);
      // Web clients must be listed in ALLOWED_ORIGINS
      if (allowedWebOrigins.includes(requestOrigin))
        return callback(null, true);
      callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Platform, X-Request-Id',
    credentials: true,
  });

  // Use the TranslatedValidationPipe globally with proper configuration
  app.useGlobalPipes(
    new TranslatedValidationPipe({
      whitelist: true, // Strip properties that do not have decorators
      transform: true, // Transform payloads to be objects typed according to their DTO classes
      forbidNonWhitelisted: true, // Throw errors when properties that are not in the whitelist are present
    }),
  );
}
