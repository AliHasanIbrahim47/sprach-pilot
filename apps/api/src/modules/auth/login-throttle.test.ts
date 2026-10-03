import { describe, expect, it } from "vitest";

import {
  createMemoryLoginThrottle,
  createRedisLoginThrottle,
  type RedisCounterClient,
} from "./login-throttle.js";

function createFakeRedis(): RedisCounterClient {
  const values = new Map<string, { count: number; ttl: number }>();

  return {
    async get(key) {
      const entry = values.get(key);
      return entry ? String(entry.count) : null;
    },
    async incr(key) {
      const entry = values.get(key);
      if (!entry) {
        values.set(key, { count: 1, ttl: -1 });
        return 1;
      }
      entry.count += 1;
      return entry.count;
    },
    async expire(key, seconds) {
      const entry = values.get(key);
      if (!entry) return 0;
      entry.ttl = seconds;
      return 1;
    },
    async ttl(key) {
      return values.get(key)?.ttl ?? -2;
    },
    async del(key) {
      return values.delete(key) ? 1 : 0;
    },
  };
}

describe("login throttle", () => {
  it("blocks in memory after five failures inside the window", async () => {
    let nowMs = 1_000;
    const throttle = createMemoryLoginThrottle({
      now: () => nowMs,
      windowMs: 60_000,
      maxFailures: 5,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await throttle.getBlock("subject")).toBeNull();
      await throttle.recordFailure("subject");
    }

    expect(await throttle.getBlock("subject")).toBe(60);
    nowMs += 61_000;
    expect(await throttle.getBlock("subject")).toBeNull();
  });

  it("stores Redis failures with a ttl and clears them on reset", async () => {
    const throttle = createRedisLoginThrottle(createFakeRedis(), {
      windowSeconds: 90,
      maxFailures: 2,
    });

    expect(await throttle.getBlock("subject")).toBeNull();
    await throttle.recordFailure("subject");
    expect(await throttle.getBlock("subject")).toBeNull();
    await throttle.recordFailure("subject");
    expect(await throttle.getBlock("subject")).toBe(90);
    await throttle.reset("subject");
    expect(await throttle.getBlock("subject")).toBeNull();
  });
});
