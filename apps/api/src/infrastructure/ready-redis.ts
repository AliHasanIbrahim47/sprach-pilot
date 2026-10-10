import type { RedisCounterClient } from "../modules/auth/login-throttle.js";

export interface LazyRedisConnection {
  status: string;
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

/**
 * `lazyConnect` plus `enableOfflineQueue: false` rejects a command sent while
 * the socket is still opening. The connection attempt continues, so the next
 * request succeeds. Wait for that first connect before issuing a command.
 */
export function createReadyRedisCommands(redis: LazyRedisConnection): RedisCounterClient {
  let opening: Promise<void> | undefined;

  async function ready(): Promise<void> {
    if (redis.status === "ready") return;
    if (redis.status === "wait" || redis.status === "end") {
      opening ??= redis.connect().then(
        () => undefined,
        (error: unknown) => {
          opening = undefined;
          throw error;
        },
      );
    }
    if (opening) await opening;
  }

  return {
    async get(key) {
      await ready();
      return redis.get(key);
    },
    async incr(key) {
      await ready();
      return redis.incr(key);
    },
    async expire(key, seconds) {
      await ready();
      return redis.expire(key, seconds);
    },
    async ttl(key) {
      await ready();
      return redis.ttl(key);
    },
    async del(key) {
      await ready();
      return redis.del(key);
    },
  };
}
