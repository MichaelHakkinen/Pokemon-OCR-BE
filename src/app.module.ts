import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig } from './common/config/logger.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './common/services/storage.module';
import { RedisModule } from './common/services/redis.module';
import { RateLimitGuard } from './guards/RateLimit.guard';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { AppConfig, validateEnv } from './common/config/env.validation';
import { CronModule } from './core/cron/cron.module';
import { MaintenanceGuard, MaintenanceService } from './common/maintenance';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { PrismaModule } from './prisma/prisma.module';
import { ModelsModule } from './models';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ErrorLogService } from './common/services/error-log.service';

// Admin
import { AdminAuthModule } from './core/admin/auth/auth.module';
import { ResponseModule } from './response/response.module';
import { AdminModule } from './core/admin/admin-account/admin.module';
import { AdminGroupModule } from './core/admin/admin-group/admin-group.module';
import { OptionModule } from './core/admin/option/option.module';
import { UserModule } from './core/admin/user-account/user.module';
import { ModuleModule } from './core/admin/module/module.module';
import { ModuleRuleModule } from './core/admin/module-rule/module-rule.module';
import { BannerModule } from './core/admin/banner/banner.module';
import { FAQModule } from './core/admin/faq/faq.module';
import { GlobalConfigModule } from './core/admin/global-config/global-config.module';
import { HealthModule } from './health/health.module';

// Maintenance mode: mark user-facing controllers/routes with
// @UnderMaintenance() (src/common/maintenance). MaintenanceGuard then answers
// 503 while IS_MOBILE_MAINTENANCE / IS_WEBSITE_MAINTENANCE is on for the
// caller's X-Client-Platform. Unmarked routes — all admin routes — always work.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    // Async so APP_ENV is read after ConfigModule has loaded .env
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildLoggerConfig(config.get('APP_ENV')),
    }),
    // Scheduled jobs only on the replica with EXECUTE_CRON=true. Conditional
    // so the flag is evaluated after .env is loaded, not at import time.
    ConditionalModule.registerWhen(
      CronModule,
      (env) => env.EXECUTE_CRON?.trim().toLowerCase() === 'true',
    ),
    StorageModule,
    PrismaModule,
    ModelsModule,
    RedisModule,
    AuthCoreModule,

    // Admin
    AdminAuthModule,
    ResponseModule,
    AdminModule,
    AdminGroupModule,
    ModuleModule,
    ModuleRuleModule,
    FAQModule,
    BannerModule,
    OptionModule,
    MailModule,
    UserModule,
    GlobalConfigModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ErrorLogService,
    MaintenanceService,
    // Guards run in this order: rate limit first, then maintenance.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
