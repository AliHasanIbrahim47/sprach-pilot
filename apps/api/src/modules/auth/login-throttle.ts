/** Failures allowed before the next attempt is blocked. The 6th attempt in the window returns 429. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export interface LoginThrottle {
  /** Seconds until retry when the subject is blocked; null when another attempt is allowed. */
  getBlock(subjectKey: string): Promise<number | null>;
  recordFailure(subjectKey: string): Promise<void>;
  reset(subjectKey: string): Promise<void>;
}

export interface RedisCounterClient {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

const KEY_PREFIX = "auth:login-fail:";

/**
 * In-memory window used by tests and as the reference for the Redis adapter.
 * Sleeping the HTTP request is intentionally not done: a delay holds a worker
 * and is itself a denial-of-service. The progressive control is the counter
 * that becomes a temporary block.
 */
export function createMemoryLoginThrottle(options?: {
  now?: () => number;
  windowMs?: number;
  maxFailures?: number;
}): LoginThrottle {
  const now = options?.now ?? Date.now;
  const windowMs = options?.windowMs ?? LOGIN_WINDOW_SECONDS * 1000;
  const maxFailures = options?.maxFailures ?? LOGIN_MAX_FAILURES;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function read(key: string): { count: number; resetAt: number } | undefined {
    const bucket = buckets.get(key);
    if (!bucket) return undefined;
    if (bucket.resetAt <= now()) {
      buckets.delete(key);
      return undefined;
    }
    return bucket;
  }

  return {
    async getBlock(subjectKey) {
      const bucket = read(subjectKey);
      if (!bucket || bucket.count < maxFailures) return null;
      return Math.max(1, Math.ceil((bucket.resetAt - now()) / 1000));
    },

    async recordFailure(subjectKey) {
      const existing = read(subjectKey);
      if (!existing) {
        buckets.set(subjectKey, { count: 1, resetAt: now() + windowMs });
        return;
      }
      existing.count += 1;
    },

    async reset(subjectKey) {
      buckets.delete(subjectKey);
    },
  };
}

export function createRedisLoginThrottle(
  redis: RedisCounterClient,
  options?: { windowSeconds?: number; maxFailures?: number },
): LoginThrottle {
  const windowSeconds = options?.windowSeconds ?? LOGIN_WINDOW_SECONDS;
  const maxFailures = options?.maxFailures ?? LOGIN_MAX_FAILURES;

  function keyFor(subjectKey: string): string {
    return `${KEY_PREFIX}${subjectKey}`;
  }

  return {
    async getBlock(subjectKey) {
      const raw = await redis.get(keyFor(subjectKey));
      const count = raw === null ? 0 : Number(raw);
      if (!Number.isFinite(count) || count < maxFailures) return null;
      const ttl = await redis.ttl(keyFor(subjectKey));
      return ttl > 0 ? ttl : windowSeconds;
    },

    async recordFailure(subjectKey) {
      const key = keyFor(subjectKey);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
        return;
      }
      const ttl = await redis.ttl(key);
      if (ttl < 0) await redis.expire(key, windowSeconds);
    },

    async reset(subjectKey) {
      await redis.del(keyFor(subjectKey));
    },
  };
}
