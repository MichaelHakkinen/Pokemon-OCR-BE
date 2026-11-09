import { MemoryStore } from './memory-store';
import { RedisService, isRedisConfigured } from './redis.service';
import { testConfig } from '../config/config.testing';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new MemoryStore();
  });
  afterEach(() => {
    store.clear();
    jest.useRealTimers();
  });

  it('stores and deletes values', () => {
    store.set('k', 'v');
    expect(store.get('k')).toBe('v');
    expect(store.exists('k')).toBe(true);
    store.del('k');
    expect(store.get('k')).toBeNull();
  });

  it('follows Redis ttl semantics', () => {
    expect(store.ttl('missing')).toBe(-2);
    store.set('forever', 'v');
    expect(store.ttl('forever')).toBe(-1);
    store.set('short', 'v', 10);
    expect(store.ttl('short')).toBe(10);
    jest.advanceTimersByTime(4_000);
    expect(store.ttl('short')).toBe(6);
  });

  it('expires keys and fires expiry listeners', () => {
    const expired: string[] = [];
    store.onExpired((key) => expired.push(key));
    store.set('session:1', 'v', 5);

    jest.advanceTimersByTime(4_999);
    expect(store.get('session:1')).toBe('v');
    jest.advanceTimersByTime(1);
    expect(store.get('session:1')).toBeNull();
    expect(expired).toEqual(['session:1']);
  });

  it('does not fire listeners for deleted or overwritten keys', () => {
    const listener = jest.fn();
    store.onExpired(listener);
    store.set('a', '1', 5);
    store.del('a');
    store.set('b', '1', 5);
    store.set('b', '2'); // overwrite without TTL clears the old timer
    jest.advanceTimersByTime(10_000);
    expect(listener).not.toHaveBeenCalled();
    expect(store.get('b')).toBe('2');
  });

  it('increments counters and keeps their TTL', () => {
    expect(store.incr('c')).toBe(1);
    store.expire('c', 60);
    expect(store.incr('c')).toBe(2);
    expect(store.ttl('c')).toBe(60);
  });

  it('supports hashes', () => {
    expect(store.hsetnx('h', 'f1', 'a')).toBe(true);
    expect(store.hsetnx('h', 'f1', 'b')).toBe(false);
    store.hsetnx('h', 'f2', 'c');
    expect(store.hgetall('h')).toEqual({ f1: 'a', f2: 'c' });
    expect(store.hlen('h')).toBe(2);
    expect(store.hexists('h', 'f2')).toBe(true);
    expect(store.hgetall('none')).toEqual({});
  });
});

describe('RedisService without Redis configured', () => {
  const config = testConfig({ REDIS_HOST: '', REDIS_HOSTS: '' });
  let redis: RedisService;

  beforeEach(() => {
    jest.spyOn(RedisService.prototype as any, 'buildClient');
    redis = new RedisService(config);
    jest
      .spyOn((redis as any).logger, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    redis.onApplicationShutdown();
    jest.restoreAllMocks();
  });

  it('treats an empty REDIS_HOST as "not configured"', () => {
    expect(isRedisConfigured(config)).toBe(false);
    expect(isRedisConfigured(testConfig({ REDIS_HOST: 'localhost' }))).toBe(
      true,
    );
    expect(
      isRedisConfigured(testConfig({ REDIS_HOSTS: 'a:6379,b:6379' })),
    ).toBe(true);
    expect(redis.mode).toBe('memory');
    expect((RedisService.prototype as any).buildClient).not.toHaveBeenCalled();
  });

  it('serves the same API from memory', async () => {
    await expect(redis.ping()).resolves.toBeUndefined();
    await redis.setJSON('cfg', { a: 1 }, 60);
    await expect(redis.getJSON('cfg')).resolves.toEqual({ a: 1 });
    await expect(redis.hgetall('nothing')).resolves.toBeNull();
  });

  it('rate-limits per key within the window', async () => {
    const hit = () => redis.checkRateLimit('1.2.3.4', 'login', 2, 300);
    await expect(hit()).resolves.toEqual({ limited: false, retryAfter: 0 });
    await expect(hit()).resolves.toEqual({ limited: false, retryAfter: 0 });
    const third = await hit();
    expect(third.limited).toBe(true);
    expect(third.retryAfter).toBeGreaterThan(0);
    await expect(
      redis.checkRateLimit('5.6.7.8', 'login', 2, 300),
    ).resolves.toEqual({ limited: false, retryAfter: 0 });
  });

  it('delivers expiry events through onKeyExpired', async () => {
    jest.useFakeTimers();
    const expired: string[] = [];
    await redis.onKeyExpired((key) => expired.push(key));
    await redis.set('upload:abc', 'x', 1);
    jest.advanceTimersByTime(1_000);
    expect(expired).toEqual(['upload:abc']);
    jest.useRealTimers();
  });
});
