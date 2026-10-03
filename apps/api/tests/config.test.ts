import { describe, expect, it } from "vitest";

import { formatConfigForLog, loadConfig } from "../src/config.js";
import { createValidApiEnv } from "./helpers/env.js";

describe("loadConfig", () => {
  it("throws naming DATABASE_URL when it is missing", () => {
    const env = createValidApiEnv();
    delete env["DATABASE_URL"];

    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
  });

  it("lists every invalid field at once", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        PORT: "not-a-number",
      }),
    ).toThrow(/DATABASE_URL[\s\S]*REDIS_URL|REDIS_URL[\s\S]*DATABASE_URL/);
  });

  it("returns a frozen config object", () => {
    const config = loadConfig(createValidApiEnv());

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.s3)).toBe(true);
    expect(() => {
      (config as { port: number }).port = 9999;
    }).toThrow();
  });

  it("redacts secrets in formatConfigForLog", () => {
    const env = createValidApiEnv();
    const config = loadConfig(env);
    const logged = formatConfigForLog(config);
    const serialized = JSON.stringify(logged);

    expect(logged.databaseUrl).toBe("[REDACTED]");
    expect(logged.redisUrl).toBe("[REDACTED]");
    expect((logged.s3 as { secretAccessKey: string }).secretAccessKey).toBe("[REDACTED]");
    expect((logged.s3 as { accessKeyId: string }).accessKeyId).toBe("[REDACTED]");
    expect((logged.smtp as { pass: string }).pass).toBe("[REDACTED]");
    expect((logged.jwt as { accessSecret: string }).accessSecret).toBe("[REDACTED]");

    expect(serialized).not.toContain("secret@localhost");
    expect(serialized).not.toContain("redis-secret");
    expect(serialized).not.toContain("s3-secret-key");
    expect(serialized).not.toContain("smtp-password");
    expect(serialized).not.toContain("jwt-access-secret-value");
    expect(serialized).not.toContain("ip-hash-secret-value");
    expect(serialized).not.toContain("internal-api-secret-value");
    expect(logged.ipHashSecret).toBe("[REDACTED]");
    expect(logged.internalApiSecret).toBe("[REDACTED]");
    expect(serialized).toContain("[REDACTED]");
    expect(logged.port).toBe(0);
    expect((logged.s3 as { bucket: string }).bucket).toBe("sprachpilot-dev");
  });
});
