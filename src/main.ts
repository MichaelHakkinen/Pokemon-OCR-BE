import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);

  configureApp(app);

  // Run the lifecycle hooks on SIGTERM/SIGINT (docker stop, blue/green
  // switch), so queued OTP emails finish and connections close cleanly
  // instead of the process dying mid-request.
  app.enableShutdownHooks();

  // Get port from environment variables
  const port = configService.get<number>('APP_PORT', 3000);

  // API docs are only exposed outside production — this is an internal admin API
  const appEnv = configService.get<string>('APP_ENV', 'development');
  if (appEnv !== 'production') {
    const documentBuilder = new DocumentBuilder()
      .setTitle('NestJS Admin API')
      .setDescription(
        'Admin API for authentication, RBAC (admin groups/modules/rules), ' +
          'user & admin account management, banners, FAQs, and global config. ' +
          'All routes except /auth and /response require a Bearer token obtained from POST /auth.',
      )
      .setVersion(process.env.npm_package_version ?? '0.0.1')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by POST /auth',
      })
      // Sidebar order mirrors the folder order in the legacy Postman
      // collection, so switching between the two isn't confusing.
      .addTag('Auth')
      .addTag('Admin Account')
      .addTag('Admin Group')
      .addTag('Banner')
      .addTag('FAQ')
      .addTag('Module')
      .addTag('Module Rule')
      .addTag('Global Config')
      .addTag('User Account')
      .addTag('Option')
      .addTag('Healthz')
      .addTag('Response')
      .addTag('Root')
      .build();

    const document = SwaggerModule.createDocument(app, documentBuilder);
    SwaggerModule.setup('docs-json', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerUiEnabled: false,
    });

    app.use(
      '/docs',
      apiReference({
        url: '/docs-json',
        metaData: { title: 'NestJS Admin API — Reference' },
      }),
    );
  }

  await app.listen(port, () => {
    app.get(Logger).log(`Application is running on port ${port}`);
  });
}
bootstrap();
