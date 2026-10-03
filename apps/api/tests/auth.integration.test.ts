import { AUTH_COPY } from "@sprachpilot/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { type AuthOverrides, createContainer } from "../src/container.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { hashIp } from "../src/modules/auth/ip-hash.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import type { OutboundMail } from "../src/modules/auth/mailer.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createValidApiEnv } from "./helpers/env.js";

const IP_HASH_SECRET = "integration-ip-hash-secret";

function createFakeHasher(): PasswordHasher {
  return {
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
}

function createAuthApp(env: NodeJS.ProcessEnv = {}) {
  const users = createMemoryUserRepository();
  const sent: OutboundMail[] = [];
  const metrics = createAuthMetrics();
  const auth: AuthOverrides = {
    users,
    throttle: createMemoryLoginThrottle(),
    metrics,
    hasher: createFakeHasher(),
    clock: () => new Date("2026-10-03T07:00:00.000Z"),
    mailer: {
      async send(message) {
        sent.push(message);
      },
    },
  };
  const config = loadConfig(
    createValidApiEnv({
      IP_HASH_SECRET,
      ...env,
    }),
  );
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth,
  });
  return { app: createApp(container), users, sent, metrics };
}

const validBody = {
  email: "Learner@Example.com",
  password: "correct-horse-battery",
  displayName: "Ada",
  acceptedTerms: true,
};

describe("auth routes", () => {
  it("registers an account and stores a normalized email plus consent", async () => {
    const { app, users } = createAuthApp();

    const response = await request(app).post("/v1/auth/register").send(validBody);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      status: "accepted",
      message: AUTH_COPY.registerAccepted,
    });
    const user = users.records()[0];
    expect(user?.email).toBe("learner@example.com");
    expect(user?.passwordHash).not.toBe(validBody.password);
    expect(user?.consents.map((consent) => consent.policy)).toEqual(["terms", "privacy"]);
    expect([
      hashIp("127.0.0.1", IP_HASH_SECRET),
      hashIp("::ffff:127.0.0.1", IP_HASH_SECRET),
    ]).toContain(user?.consents[0]?.ipHash);
  });

  it("looks the same when the email already exists and does not create a second account", async () => {
    const { app, users, sent } = createAuthApp();

    const first = await request(app).post("/v1/auth/register").send(validBody);
    const second = await request(app)
      .post("/v1/auth/register")
      .send({
        ...validBody,
        displayName: "Other",
        password: "another-strong-passphrase",
      });

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(users.records()).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("learner@example.com");
  });

  it("rejects password123 as too common", async () => {
    const { app, users } = createAuthApp();

    const response = await request(app)
      .post("/v1/auth/register")
      .send({ ...validBody, password: "password123" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password", code: "password_too_common" }),
      ]),
    );
    expect(users.records()).toHaveLength(0);
  });

  it("logs in with a generic error for a wrong password", async () => {
    const { app } = createAuthApp();
    await request(app).post("/v1/auth/register").send(validBody);

    const response = await request(app).post("/v1/auth/login").send({
      email: "learner@example.com",
      password: "not-the-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.detail).toBe(AUTH_COPY.invalidCredentials);
  });

  it("returns 429 with Retry-After on the sixth failure", async () => {
    const { app } = createAuthApp();
    await request(app).post("/v1/auth/register").send(validBody);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await request(app).post("/v1/auth/login").send({
        email: "learner@example.com",
        password: "not-the-password",
      });
      expect(failed.status).toBe(401);
    }

    const blocked = await request(app).post("/v1/auth/login").send({
      email: "learner@example.com",
      password: "not-the-password",
    });

    expect(blocked.status).toBe(429);
    expect(Number(blocked.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("exposes auth metrics and accepts logout", async () => {
    const { app } = createAuthApp();
    await request(app).post("/v1/auth/register").send(validBody);
    await request(app).post("/v1/auth/login").send({
      email: "learner@example.com",
      password: validBody.password,
    });

    const metrics = await request(app).get("/metrics");
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('auth_register_total{result="created"} 1');
    expect(metrics.text).toContain('auth_login_total{result="success"} 1');

    const logout = await request(app).post("/v1/auth/logout");
    expect(logout.status).toBe(204);
    expect(logout.text).toBe("");
  });

  it("refuses registration when the feature flag is off", async () => {
    const { app, users } = createAuthApp({ FEATURE_REGISTRATION_ENABLED: "false" });

    const response = await request(app).post("/v1/auth/register").send(validBody);

    expect(response.status).toBe(403);
    expect(users.records()).toHaveLength(0);
  });
});
