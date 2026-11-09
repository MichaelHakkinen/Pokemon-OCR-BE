import { Controller, Get } from '@nestjs/common';
import { UnderMaintenance } from 'src/common/maintenance';
import { bearer, createTestApp, login, TestContext } from './helpers';

// Stand-ins for user-facing routes (the skeleton has none yet).
@Controller('e2e-app')
@UnderMaintenance()
class DemoAppController {
  @Get('home')
  home() {
    return { ok: true };
  }
}

@Controller('e2e-mixed')
class DemoMixedController {
  @Get('open')
  open() {
    return { ok: true };
  }

  @Get('guarded')
  @UnderMaintenance()
  guarded() {
    return { ok: true };
  }
}

describe('Maintenance mode (e2e)', () => {
  let ctx: TestContext;
  let rootToken: string;
  let flagIds: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp({
      controllers: [DemoAppController, DemoMixedController],
    });
    rootToken = (await login(ctx)).token;
    const rows = await ctx.prisma.globalConfig.findMany({
      where: {
        key: { in: ['IS_MOBILE_MAINTENANCE', 'IS_WEBSITE_MAINTENANCE'] },
      },
    });
    flagIds = Object.fromEntries(rows.map((r) => [r.key, r.id]));
  });

  // Flags are switched through the admin API, so cache invalidation is real.
  const setFlags = async (mobile: string, web: string) => {
    for (const [key, value] of [
      ['IS_MOBILE_MAINTENANCE', mobile],
      ['IS_WEBSITE_MAINTENANCE', web],
    ]) {
      await ctx
        .http()
        .put(`/admin/global-config/${flagIds[key]}`)
        .set(bearer(rootToken))
        .send({ value })
        .expect(200);
    }
  };
  const asPlatform = (path: string, platform?: string) => {
    const req = ctx.http().get(path);
    return platform ? req.set('X-Client-Platform', platform) : req;
  };

  afterAll(async () => {
    await setFlags('false', 'false');
    await ctx.close();
  });

  it('serves marked routes while maintenance is off', async () => {
    await setFlags('false', 'false');
    await asPlatform('/e2e-app/home', 'mobile').expect(200);
  });

  it('blocks only the platform whose flag is on', async () => {
    await setFlags('true', 'false');
    const res = await asPlatform('/e2e-app/home', 'mobile').expect(503);
    expect(res.body).toMatchObject({ code: 503, status: 'errors', data: null });
    expect(res.body.message.en).toMatch(/maintenance/i);
    await asPlatform('/e2e-app/home', 'web').expect(200);
    await asPlatform('/e2e-app/home').expect(200); // unknown: needs both flags
  });

  it('blocks every client when both flags are on (value case-insensitive)', async () => {
    await setFlags('TRUE', 'true');
    await asPlatform('/e2e-app/home', 'web').expect(503);
    await asPlatform('/e2e-app/home').expect(503);
  });

  it('only affects routes marked @UnderMaintenance()', async () => {
    await setFlags('true', 'true');
    await asPlatform('/e2e-mixed/guarded', 'web').expect(503);
    await asPlatform('/e2e-mixed/open', 'web').expect(200);
    // admin + infrastructure routes keep working, so admins can switch it off
    await ctx.http().get('/faq').set(bearer(rootToken)).expect(200);
    await ctx.http().get('/healthz').expect(200);
  });

  it('switching a flag off applies immediately', async () => {
    await setFlags('true', 'true');
    await asPlatform('/e2e-app/home', 'mobile').expect(503);
    await setFlags('false', 'false');
    await asPlatform('/e2e-app/home', 'mobile').expect(200);
  });
});
