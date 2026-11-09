type Entry = {
  value: string | Map<string, string>;
  expiresAt?: number;
  timer?: NodeJS.Timeout;
};

// In-process stand-in for the subset of Redis that RedisService exposes,
// used when no Redis is configured. Same semantics for TTLs (ttl() returns
// -2 for missing keys, -1 for keys without expiry) and fires an "expired"
// callback like Redis keyspace notifications. State lives in this process
// only, so it is not shared between replicas.
export class MemoryStore {
  private readonly entries = new Map<string, Entry>();
  private readonly expiryListeners: ((key: string) => void)[] = [];

  onExpired(listener: (key: string) => void): void {
    this.expiryListeners.push(listener);
  }

  set(key: string, value: string, ttlSeconds?: number): void {
    this.clearTimer(key);
    this.entries.set(key, { value });
    if (ttlSeconds) this.expire(key, ttlSeconds);
  }

  get(key: string): string | null {
    const entry = this.live(key);
    return typeof entry?.value === 'string' ? entry.value : null;
  }

  del(key: string): void {
    this.clearTimer(key);
    this.entries.delete(key);
  }

  expire(key: string, ttlSeconds: number): void {
    const entry = this.live(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    entry.timer = setTimeout(() => this.evict(key), ttlSeconds * 1000);
    entry.timer.unref(); // never keep the process alive for a TTL
  }

  ttl(key: string): number {
    const entry = this.live(key);
    if (!entry) return -2;
    if (entry.expiresAt === undefined) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  exists(key: string): boolean {
    return this.live(key) !== undefined;
  }

  incr(key: string): number {
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) || 0 : 0) + 1;
    if (entry) entry.value = String(next);
    else this.entries.set(key, { value: String(next) });
    return next;
  }

  hsetnx(key: string, field: string, value: string): boolean {
    const hash = this.hash(key, true);
    if (hash.has(field)) return false;
    hash.set(field, value);
    return true;
  }

  hgetall(key: string): Record<string, string> {
    return Object.fromEntries(this.hash(key) ?? []);
  }

  hlen(key: string): number {
    return this.hash(key)?.size ?? 0;
  }

  hexists(key: string, field: string): boolean {
    return this.hash(key)?.has(field) ?? false;
  }

  clear(): void {
    for (const key of [...this.entries.keys()]) this.del(key);
  }

  private hash(key: string, create: true): Map<string, string>;
  private hash(key: string, create?: false): Map<string, string> | undefined;
  private hash(key: string, create = false) {
    const entry = this.live(key);
    if (entry && entry.value instanceof Map) return entry.value;
    if (!create) return undefined;
    const hash = new Map<string, string>();
    this.entries.set(key, { value: hash });
    return hash;
  }

  // Returns the entry if present and not past its TTL (timers can lag).
  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.evict(key);
      return undefined;
    }
    return entry;
  }

  private evict(key: string): void {
    if (!this.entries.has(key)) return;
    this.del(key);
    for (const listener of this.expiryListeners) listener(key);
  }

  private clearTimer(key: string): void {
    clearTimeout(this.entries.get(key)?.timer);
  }
}
