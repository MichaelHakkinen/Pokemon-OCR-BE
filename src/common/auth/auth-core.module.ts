import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SignOptions } from 'jsonwebtoken';
import { AppConfig } from 'src/common/config/env.validation';
import { AdminAccessService } from './admin-access.service';

// Single JWT configuration for the whole app. Registered async so the secret
// is read after ConfigModule has loaded and validated the environment.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('JWT_SECRET_KEY'),
        signOptions: {
          expiresIn: config.get(
            'JWT_EXPIRATION_TIME',
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [AdminAccessService],
  exports: [JwtModule, AdminAccessService],
})
export class AuthCoreModule {}
