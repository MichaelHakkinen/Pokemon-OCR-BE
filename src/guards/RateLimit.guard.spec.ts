import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitGuard } from './RateLimit.guard';
import { testConfig } from 'src/common/config/config.testing';

describe('RateLimitGuard', () => {
  let redis: any;
  let guard: RateLimitGuard;
  let response: any;

  const contextFor = (request: any): any => ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => () => undefined,
  });

  beforeEach(() => {
    redis = {
      checkRateLimit: jest
        .fn()
        .mockResolvedValue({ limited: false, retryAfter: 0 }),
    };
    response = { setHeader: jest.fn() };
    const reflector: any = { get: jest.fn().mockReturnValue(undefined) };
    guard = new RateLimitGuard(reflector, redis, testConfig());
  });

  it('keys on request.ip, ignoring a client-supplied X-Forwarded-For', async () => {
    await guard.canActivate(
      contextFor({
        path: '/auth',
        ip: '203.0.113.7',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    );
    expect(redis.checkRateLimit.mock.calls[0][0]).toBe('203.0.113.7');
  });

  it('throws 429 with Retry-After when the limit is hit', async () => {
    redis.checkRateLimit.mockResolvedValue({ limited: true, retryAfter: 42 });

    const result = guard.canActivate(
      contextFor({ path: '/auth', ip: '203.0.113.7', headers: {} }),
    );

    await expect(result).rejects.toBeInstanceOf(HttpException);
    await result.catch((e: HttpException) =>
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS),
    );
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('lets everything through when DISABLE_RATE_LIMIT=true', async () => {
    const reflector: any = { get: jest.fn() };
    const disabled = new RateLimitGuard(
      reflector,
      redis,
      testConfig({ DISABLE_RATE_LIMIT: 'true' }),
    );
    await expect(
      disabled.canActivate(
        contextFor({ path: '/auth', ip: '1.1.1.1', headers: {} }),
      ),
    ).resolves.toBe(true);
    expect(redis.checkRateLimit).not.toHaveBeenCalled();
  });
});
