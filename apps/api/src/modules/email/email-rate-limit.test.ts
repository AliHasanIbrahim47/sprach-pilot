import { describe, expect, it } from "vitest";

import {
  createMemoryEmailSendLimiter,
  createRedisEmailSendLimiter,
  type EmailRateRedis,
} from "./email-rate-limit.js";

function createFakeRedis(): EmailRateRedis & { keys(): string[] } {
  const values = new Map<string, { count: number; ttl: number }>();

  return {
    keys() {
      return [...values.keys()];
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
  };
}

describe("email send limiter", () => {
  it("allows three sends per purpose per hour and blocks the fourth", async () => {
    const limiter = createMemoryEmailSendLimiter();

    const results = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      results.push(await limiter.consume("learner@example.com", "password_reset"));
    }

    expect(results).toEqual([true, true, true, false]);
    expect(await limiter.consume("learner@example.com", "verification")).toBe(true);
  });

  it("stores an HMAC instead of the email address", async () => {
    const redis = createFakeRedis();
    const limiter = createRedisEmailSendLimiter(redis, { pepper: "email-rate-pepper" });

    expect(await limiter.consume("learner@example.com", "password_reset")).toBe(true);
    expect(await limiter.consume("learner@example.com", "password_reset")).toBe(true);
    expect(redis.keys().join(" ")).not.toContain("learner@example.com");
    expect(redis.keys()[0]).toMatch(/^auth:email-send:[a-f0-9]{64}$/);
  });
});
