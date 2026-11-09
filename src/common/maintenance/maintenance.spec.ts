import { ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { testConfig } from 'src/common/config/config.testing';
import { RedisService } from 'src/common/services/redis.service';
import { MaintenanceGuard } from './maintenance.guard';
import { MaintenanceService, parsePlatform } from './maintenance.service';
import { UNDER_MAINTENANCE_KEY } from './under-maintenance.decorator';

describe('maintenance mode', () => {
  let flags: Record<string, string | null>;
  let prisma: any;
  let redis: RedisService;
  let service: MaintenanceService;

  beforeEach(() => {
    flags = { IS_MOBILE_MAINTENANCE: 'false', IS_WEBSITE_MAINTENANCE: 'false' };
    prisma = {
      globalConfig: {
        findFirst: jest.fn(async ({ where }) =>
          where.key in flags && flags[where.key] !== null
            ? { value: flags[where.key] }
            : null,
        ),
      },
    };
    redis = new RedisService(testConfig({ REDIS_HOST: '' }));
    jest
      .spyOn((redis as any).logger, 'warn')
      .mockImplementation(() => undefined);
    service = new MaintenanceService(redis, prisma);
  });
  afterEach(() => redis.onApplicationShutdown());

  describe('parsePlatform', () => {
    it.each([
      ['mobile', 'mobile'],
      [' Mobile ', 'mobile'],
      ['WEB', 'web'],
      ['ios', 'unknown'],
      [undefined, 'unknown'],
      [['web', 'mobile'], 'web'],
    ])('%p → %s', (header, expected) => {
      expect(parsePlatform(header)).toBe(expected);
    });
  });

  describe('MaintenanceService.isBlocked', () => {
    it.each([
      // mobile flag, web flag, platform, blocked?
      ['true', 'false', 'mobile', true],
      ['true', 'false', 'web', false],
      ['false', 'true', 'web', true],
      ['false', 'true', 'mobile', false],
      ['true', 'false', 'unknown', false],
      ['true', 'true', 'unknown', true],
      ['TRUE', 'false', 'mobile', true],
      ['yes', 'false', 'mobile', false],
    ] as const)(
      'mobile=%s web=%s, %s client → blocked %s',
      async (mobile, web, platform, blocked) => {
        flags.IS_MOBILE_MAINTENANCE = mobile;
        flags.IS_WEBSITE_MAINTENANCE = web;
        await expect(service.isBlocked(platform)).resolves.toBe(blocked);
      },
    );

    it('treats a missing flag as off and caches the miss', async () => {
      flags.IS_MOBILE_MAINTENANCE = null;
      await expect(service.isBlocked('mobile')).resolves.toBe(false);
      await expect(service.isBlocked('mobile')).resolves.toBe(false);
      expect(prisma.globalConfig.findFirst).toHaveBeenCalledTimes(1);
    });

    it('uses the cache that GlobalConfigService invalidates', async () => {
      await service.isBlocked('mobile');
      flags.IS_MOBILE_MAINTENANCE = 'true';
      await expect(service.isBlocked('mobile')).resolves.toBe(false); // cached
      await redis.del('global_config:IS_MOBILE_MAINTENANCE');
      await expect(service.isBlocked('mobile')).resolves.toBe(true);
    });
  });

  describe('MaintenanceGuard', () => {
    const contextFor = (marked: boolean, platform?: string): any => {
      const handler = () => undefined;
      if (marked) Reflect.defineMetadata(UNDER_MAINTENANCE_KEY, true, handler);
      return {
        getHandler: () => handler,
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: () => ({
            headers: platform ? { 'x-client-platform': platform } : {},
          }),
        }),
      };
    };

    it('never blocks routes without @UnderMaintenance()', async () => {
      flags.IS_MOBILE_MAINTENANCE = 'true';
      flags.IS_WEBSITE_MAINTENANCE = 'true';
      const guard = new MaintenanceGuard(new Reflector(), service);
      await expect(guard.canActivate(contextFor(false))).resolves.toBe(true);
      expect(prisma.globalConfig.findFirst).not.toHaveBeenCalled();
    });

    it('answers 503 for a marked route when the platform flag is on', async () => {
      flags.IS_MOBILE_MAINTENANCE = 'true';
      const guard = new MaintenanceGuard(new Reflector(), service);
      await expect(
        guard.canActivate(contextFor(true, 'mobile')),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(guard.canActivate(contextFor(true, 'web'))).resolves.toBe(
        true,
      );
    });
  });
});
