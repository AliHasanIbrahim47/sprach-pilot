import { describe, expect, it } from "vitest";

import { createReadyRedisCommands, type LazyRedisConnection } from "./ready-redis.js";

describe("createReadyRedisCommands", () => {
  it("waits for the lazy connection before the first command", async () => {
    let status = "wait";
    let connects = 0;
    const redis: LazyRedisConnection = {
      get status() {
        return status;
      },
      connect() {
        connects += 1;
        return new Promise((resolve) => {
          setTimeout(() => {
            status = "ready";
            resolve(undefined);
          }, 5);
        });
      },
      async get() {
        if (status !== "ready") throw new Error("stream not writable");
        return "1";
      },
      async incr() {
        return 1;
      },
      async expire() {
        return 1;
      },
      async ttl() {
        return 10;
      },
      async del() {
        return 1;
      },
      async set() {
        return "OK";
      },
    };
    const commands = createReadyRedisCommands(redis);

    const [first, second] = await Promise.all([commands.get("a"), commands.get("b")]);

    expect(first).toBe("1");
    expect(second).toBe("1");
    expect(connects).toBe(1);
  });
});
