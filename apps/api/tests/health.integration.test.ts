import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createContainer } from "../src/container.js";
import { REQUEST_ID_HEADER } from "../src/middleware/request-id.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import type { DependencyHealthPort } from "../src/modules/health/health.schemas.js";
import { createValidApiEnv } from "./helpers/env.js";

function createAppWithChecks(checks: DependencyHealthPort[]) {
  const config = loadConfig(createValidApiEnv());
  const container = createContainer(config, {
    dependencyChecks: checks,
    auth: { throttle: createMemoryLoginThrottle() },
  });
  return createApp(container);
}

describe("health HTTP endpoints", () => {
  it("GET /healthz returns 200 with status ok", async () => {
    const app = createAppWithChecks([]);

    const response = await request(app).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it("GET /readyz returns 503 and names database when it is down", async () => {
    const app = createAppWithChecks([
      { name: "database", check: async () => false },
      { name: "redis", check: async () => true },
    ]);

    const response = await request(app).get("/readyz");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("not_ready");
    expect(response.body.failing).toContain("database");
    expect(response.body.checks.database).toBe("fail");
  });

  it("propagates X-Request-Id from the request to the response", async () => {
    const app = createAppWithChecks([]);

    const response = await request(app).get("/healthz").set(REQUEST_ID_HEADER, "abc");

    expect(response.get(REQUEST_ID_HEADER)).toBe("abc");
  });

  it("GET /readyz returns 200 when all dependencies are up", async () => {
    const app = createAppWithChecks([
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ]);

    const response = await request(app).get("/readyz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      checks: { database: "ok", redis: "ok" },
      failing: [],
    });
  });
});
