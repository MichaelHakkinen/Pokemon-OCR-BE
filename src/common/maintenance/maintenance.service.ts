import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/services/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';

export type ClientPlatform = 'mobile' | 'web' | 'unknown';

export const MAINTENANCE_FLAGS = {
  mobile: 'IS_MOBILE_MAINTENANCE',
  web: 'IS_WEBSITE_MAINTENANCE',
} as const;

// Seconds a flag is cached. GlobalConfigService drops the cache entry when a
// flag is created, updated or deleted, so changes apply immediately.
const CACHE_TTL_SECONDS = 60;

// Reads the maintenance flags from global_configs (cached under the same
// `global_config:<KEY>` keys GlobalConfigService invalidates).
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async isBlocked(platform: ClientPlatform): Promise<boolean> {
    if (platform === 'mobile') return this.flag(MAINTENANCE_FLAGS.mobile);
    if (platform === 'web') return this.flag(MAINTENANCE_FLAGS.web);
    // Unknown client: only a full maintenance (both flags) applies.
    const [mobile, web] = await Promise.all([
      this.flag(MAINTENANCE_FLAGS.mobile),
      this.flag(MAINTENANCE_FLAGS.web),
    ]);
    return mobile && web;
  }

  private async flag(key: string): Promise<boolean> {
    const cacheKey = `global_config:${key}`;
    const cached = await this.redis.getJSON<{
      key: string;
      value: string | null;
    }>(cacheKey);
    let value = cached ? cached.value : undefined;

    if (value === undefined) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { key },
        select: { value: true },
      });
      value = config?.value ?? null;
      // Missing rows are cached too (as null), so a missing flag doesn't
      // cost a query per request.
      await this.redis.setJSON(cacheKey, { key, value }, CACHE_TTL_SECONDS);
    }

    // Same rule as the env on/off settings: "true" in any case is on.
    return value?.trim().toLowerCase() === 'true';
  }
}

export function parsePlatform(header: unknown): ClientPlatform {
  const value = (Array.isArray(header) ? header[0] : header)
    ?.toString()
    .trim()
    .toLowerCase();
  return value === 'mobile' || value === 'web' ? value : 'unknown';
}
