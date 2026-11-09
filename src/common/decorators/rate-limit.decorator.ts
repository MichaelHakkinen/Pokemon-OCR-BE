import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  route: string;
}

export const RateLimit = (
  route: string,
  limit: number,
  windowSeconds: number,
): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, { route, limit, windowSeconds });
