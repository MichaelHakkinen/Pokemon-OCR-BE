import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AppConfig } from 'src/common/config/env.validation';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { RedisService } from 'src/common/services/redis.service';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from 'src/common/decorators/rate-limit.decorator';

const GLOBAL_RATE_LIMIT: RateLimitOptions = {
  route: 'global',
  limit: 200,
  windowSeconds: 60,
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get('DISABLE_RATE_LIMIT')) return true;

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const path = (request.path || request.url || '').split('?')[0];

    if (path === '/healthz') return true;

    const options =
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_KEY,
        context.getHandler(),
      ) ?? GLOBAL_RATE_LIMIT;

    // request.ip honours the "trust proxy" setting (TRUST_PROXY), so it is
    // the real client address behind nginx yet can't be spoofed by a client
    // sending its own X-Forwarded-For header.
    const ip = request.ip || 'unknown';

    const { limited, retryAfter } = await this.redisService.checkRateLimit(
      ip,
      options.route,
      options.limit,
      options.windowSeconds,
    );

    if (limited) {
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        ErrorMessageHelper.getMultiLanguageMessage('TOO_MANY_REQUESTS'),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
