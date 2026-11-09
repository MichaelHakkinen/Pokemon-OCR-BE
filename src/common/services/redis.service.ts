import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster } from 'ioredis';
import { MemoryStore } from './memory-store';
import { AppConfig } from '../config/env.validation';

// Redis is optional: with REDIS_HOST and REDIS_HOSTS both empty, every
// method runs against an in-process MemoryStore instead. Callers don't need
// to know which backend is active.
export function isRedisConfigured(config: ConfigService<AppConfig, true>) {
  return Boolean(config.get('REDIS_HOSTS') || config.get('REDIS_HOST'));
}

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: Redis | Cluster;
  private readonly memory?: MemoryStore;
  private readonly db: number;
  private subscribers: Redis[] = [];

  // Built in the constructor (not onModuleInit) so services that use Redis
  // from their own onModuleInit always find it ready.
  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.db = config.get('REDIS_DB');
    if (isRedisConfigured(config)) {
      this.client = this.buildClient();
      this.client.on('error', (err) =>
        this.logger.error(`Redis error: ${err.message}`),
      );
    } else {
      this.memory = new MemoryStore();
      this.logger.warn(
        'Redis not configured (REDIS_HOST/REDIS_HOSTS empty): using an in-memory ' +
          'store. Rate limits and caches are per process — fine for a single ' +
          'instance, not for several replicas.',
      );
    }
  }

  get mode(): 'cluster' | 'single' | 'memory' {
    if (!this.client) return 'memory';
    return this.client instanceof Cluster ? 'cluster' : 'single';
  }

  // Last shutdown phase, after onModuleDestroy hooks that may still use it.
  onApplicationShutdown() {
    this.subscribers.forEach((sub) => sub.disconnect());
    this.client?.disconnect();
    this.memory?.clear();
  }

  private parseNodes(): { host: string; port: number }[] {
    return this.config
      .get('REDIS_HOSTS')
      .split(',')
      .map((entry) => {
        const [host, portStr] = entry.trim().split(':');
        const port = parseInt(portStr ?? '', 10);
        return {
          host: host || 'localhost',
          port: Number.isInteger(port) ? port : 6379,
        };
      });
  }

  private buildClient(): Redis | Cluster {
    // Cluster mode: set REDIS_HOSTS as a comma-separated list of host:port pairs
    const password = this.config.get('REDIS_PASSWORD');
    if (this.config.get('REDIS_HOSTS')) {
      this.logger.log('Redis mode: Cluster');
      return new Redis.Cluster(this.parseNodes(), {
        redisOptions: { password },
      });
    }
    // Single mode: use REDIS_HOST / REDIS_PORT / REDIS_DB
    this.logger.log('Redis mode: Single');
    return new Redis({
      host: this.config.get('REDIS_HOST'),
      port: this.config.get('REDIS_PORT'),
      password,
      db: this.db,
    });
  }

  async ping(): Promise<void> {
    if (this.client) await this.client.ping();
  }

  // ── Generic key/value ──

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.memory) return this.memory.set(key, value, ttlSeconds);
    if (ttlSeconds) {
      await this.client!.setex(key, ttlSeconds, value);
    } else {
      await this.client!.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.memory) return this.memory.get(key);
    return this.client!.get(key);
  }

  async del(key: string): Promise<void> {
    if (this.memory) return this.memory.del(key);
    await this.client!.del(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.memory) return this.memory.expire(key, ttlSeconds);
    await this.client!.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    if (this.memory) return this.memory.ttl(key);
    return this.client!.ttl(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.memory) return this.memory.exists(key);
    return (await this.client!.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    if (this.memory) return this.memory.incr(key);
    return this.client!.incr(key);
  }

  // ── JSON helpers ──

  async setJSON(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  // ── Hash operations ──

  async hsetnx(key: string, field: string, value: string): Promise<boolean> {
    if (this.memory) return this.memory.hsetnx(key, field, value);
    return (await this.client!.hsetnx(key, field, value)) === 1;
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result = this.memory
      ? this.memory.hgetall(key)
      : await this.client!.hgetall(key);
    return result && Object.keys(result).length > 0 ? result : null;
  }

  async hlen(key: string): Promise<number> {
    if (this.memory) return this.memory.hlen(key);
    return this.client!.hlen(key);
  }

  async hexists(key: string, field: string): Promise<boolean> {
    if (this.memory) return this.memory.hexists(key, field);
    return (await this.client!.hexists(key, field)) === 1;
  }

  // ── IP-based rate limiting ──

  async checkRateLimit(
    ip: string,
    route: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ limited: boolean; retryAfter: number }> {
    const key = `rl:${route}:${ip}`;
    const count = await this.incr(key);
    if (count === 1) {
      await this.expire(key, windowSeconds);
    }
    if (count > limit) {
      const remaining = await this.ttl(key);
      return {
        limited: true,
        retryAfter: remaining > 0 ? remaining : windowSeconds,
      };
    }
    return { limited: false, retryAfter: 0 };
  }

  // ── Key expiry events ──

  /**
   * Calls `listener` with the name of every key that expires.
   * Redis: subscribes to keyspace notifications on every master (enabling them
   * when the server allows CONFIG SET). Memory: fired by the store's TTL timers.
   * Throws if the Redis subscription can't be set up.
   */
  async onKeyExpired(listener: (key: string) => void): Promise<void> {
    if (this.memory) {
      this.memory.onExpired(listener);
      return;
    }

    try {
      await this.enableKeyspaceNotifications();
    } catch {
      this.logger.warn(
        'CONFIG SET notify-keyspace-events failed (likely restricted on this server). ' +
          'Subscribing anyway — this works if notifications were enabled manually.',
      );
    }

    // In a cluster, keyspace events fire on the node that owns the key, so
    // subscribe to every master. The channel is per logical database.
    const subscribers = this.createSubscriberClients();
    try {
      await Promise.all(
        subscribers.map((sub) =>
          sub.subscribe(`__keyevent@${this.db}__:expired`),
        ),
      );
    } catch (err) {
      subscribers.forEach((sub) => sub.disconnect());
      throw err;
    }
    for (const sub of subscribers) {
      sub.on('message', (_channel: string, key: string) => listener(key));
    }
    this.subscribers.push(...subscribers);
  }

  private createSubscriberClients(): Redis[] {
    const client = this.client!;
    const subs =
      client instanceof Cluster
        ? client.nodes('master').map((node) => node.duplicate())
        : [client.duplicate()];
    for (const sub of subs) {
      sub.on('error', (err) =>
        this.logger.error(`Redis subscriber error: ${err.message}`),
      );
    }
    return subs;
  }

  private async enableKeyspaceNotifications(): Promise<void> {
    const client = this.client!;
    if (client instanceof Cluster) {
      await Promise.all(
        client
          .nodes('master')
          .map((node) => node.config('SET', 'notify-keyspace-events', 'Ex')),
      );
    } else {
      await client.config('SET', 'notify-keyspace-events', 'Ex');
    }
  }
}
