import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createContainer } from "../src/container.js";
import { REQUEST_ID_HEADER } from "../src/middleware/request-id.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

const fakeHasher: PasswordHasher = {
  async hash(password) {
    return `hashed:${password}`;
  },
  async verify(passwordHash, password) {
    return passwordHash === `hashed:${password}`;
  },
  async dummyHash() {
    return "hashed:__dummy__";
  },
};

function createTestApp(env: NodeJS.ProcessEnv = {}) {
  const config = loadConfig(createValidApiEnv(env));
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth: {
      users: createMemoryUserRepository(),
      throttle: createMemoryLoginThrottle(),
      hasher: fakeHasher,
      clock: () => new Date("2026-10-03T07:00:00.000Z"),
      ...createTestEmailPorts(),
    },
  });
  return createApp(container);
}

describe("validateBody middleware", () => {
  it("POST /v1/auth/register with invalid email returns 400 listing email", async () => {
    const app = createTestApp();

    const response = await request(app).post("/v1/auth/register").send({
      email: "not-an-email",
      password: "ChangeMe!Learner1",
      displayName: "Demo",
      acceptedTerms: true,
    });

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
    expect(response.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it("strips unknown body fields before the handler runs", async () => {
    const app = createTestApp();

    const response = await request(app).post("/v1/auth/register").send({
      email: "learner@example.com",
      password: "ChangeMe!Learner1",
      displayName: "Demo",
      acceptedTerms: true,
      extraEvil: "strip-me",
    });

    expect(response.status).toBe(202);
    expect(response.body.status).toBe("accepted");
  });
});

describe("API docs", () => {
  it("serves /docs and /openapi.json outside production", async () => {
    const app = createTestApp({ NODE_ENV: "test", ENABLE_API_DOCS: undefined });

    const spec = await request(app).get("/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths["/v1/auth/register"]).toBeDefined();
    expect(spec.body.paths["/healthz"]).toBeDefined();

    const docs = await request(app).get("/docs");
    expect(docs.status).toBe(200);
  });

  it("disables /docs in production unless ENABLE_API_DOCS=true", async () => {
    const disabled = createTestApp({ NODE_ENV: "production" });
    expect((await request(disabled).get("/docs")).status).toBe(404);
    expect((await request(disabled).get("/openapi.json")).status).toBe(404);

    const enabled = createTestApp({ NODE_ENV: "production", ENABLE_API_DOCS: "true" });
    expect((await request(enabled).get("/openapi.json")).status).toBe(200);
  });
});
