import { ACCESS_TOKEN_COOKIE, AUTH_COPY, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
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
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
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

function createAuthApp(env: NodeJS.ProcessEnv = {}, options: { clock?: () => Date } = {}) {
  const users = createMemoryUserRepository();
  const sent: OutboundMail[] = [];
  const metrics = createAuthMetrics();
  const auth: AuthOverrides = {
    users,
    sessions: createMemorySessionRepository(),
    throttle: createMemoryLoginThrottle(),
    metrics,
    hasher: createFakeHasher(),
    clock: options.clock ?? (() => new Date("2026-10-03T07:00:00.000Z")),
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

function readSetCookies(headers: request.Response["headers"]): string[] {
  const raw = headers["set-cookie"];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return [raw];
  return [];
}

function cookieValue(setCookies: readonly string[], name: string): string | undefined {
  const header = setCookies.find((cookie) => cookie.startsWith(`${name}=`));
  return header?.split(";")[0]?.slice(name.length + 1);
}

function decodeAccessPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("missing access token payload");
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
}

describe("session cookies", () => {
  const currentClock = () => new Date();

  it("sets httpOnly cookies on login and keeps tokens out of the JSON body", async () => {
    const { app } = createAuthApp({}, { clock: currentClock });
    await request(app).post("/v1/auth/register").send(validBody);

    const response = await request(app)
      .post("/v1/auth/login")
      .set("User-Agent", "DeviceA")
      .send({ email: validBody.email, password: validBody.password });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "authenticated",
      user: { id: expect.any(String), displayName: "Ada" },
    });
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();

    const cookies = readSetCookies(response.headers);
    const serialized = cookies.join("\n");
    expect(serialized).toContain("HttpOnly");
    expect(serialized).toContain("Secure");
    expect(serialized).toContain("SameSite=Lax");
    expect(serialized).toContain("Max-Age=900");
    expect(serialized).toContain("Max-Age=2592000");

    const accessToken = cookieValue(cookies, ACCESS_TOKEN_COOKIE);
    expect(accessToken).toBeTruthy();
    expect(Object.keys(decodeAccessPayload(accessToken ?? "")).sort()).toEqual([
      "exp",
      "iat",
      "role",
      "sid",
      "sub",
    ]);
    expect(decodeAccessPayload(accessToken ?? "")).not.toHaveProperty("email");
  });

  it("rotates a refresh token and revokes the family when that token is presented again", async () => {
    const { app } = createAuthApp({}, { clock: currentClock });
    await request(app).post("/v1/auth/register").send(validBody);
    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: validBody.email, password: validBody.password });
    const loginCookies = readSetCookies(login.headers);
    const refreshToken = cookieValue(loginCookies, REFRESH_TOKEN_COOKIE);
    expect(refreshToken).toBeTruthy();

    const rotated = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
    expect(rotated.status).toBe(200);
    expect(rotated.body).toEqual({ status: "refreshed" });
    const nextRefresh = cookieValue(readSetCookies(rotated.headers), REFRESH_TOKEN_COOKIE);
    expect(nextRefresh).toBeTruthy();
    expect(nextRefresh).not.toBe(refreshToken);

    const reused = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
    expect(reused.status).toBe(401);

    const afterReuse = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${nextRefresh}`);
    expect(afterReuse.status).toBe(401);

    const metrics = await request(app).get("/metrics");
    expect(metrics.text).toContain('auth_refresh_total{result="reuse"} 1');
    expect(metrics.text).toContain("auth_token_reuse_detected_total 1");
  });

  it("revokes one device so its next refresh fails while the other device stays signed in", async () => {
    const { app } = createAuthApp({}, { clock: currentClock });
    await request(app).post("/v1/auth/register").send(validBody);

    const deviceA = await request(app)
      .post("/v1/auth/login")
      .set("User-Agent", "DeviceA")
      .send({ email: validBody.email, password: validBody.password });
    const deviceB = await request(app)
      .post("/v1/auth/login")
      .set("User-Agent", "DeviceB")
      .send({ email: validBody.email, password: validBody.password });

    const accessA = cookieValue(readSetCookies(deviceA.headers), ACCESS_TOKEN_COOKIE);
    const refreshA = cookieValue(readSetCookies(deviceA.headers), REFRESH_TOKEN_COOKIE);
    const refreshB = cookieValue(readSetCookies(deviceB.headers), REFRESH_TOKEN_COOKIE);
    const sidB = decodeAccessPayload(
      cookieValue(readSetCookies(deviceB.headers), ACCESS_TOKEN_COOKIE) ?? "",
    ).sid;
    expect(typeof sidB).toBe("string");

    const listed = await request(app)
      .get("/v1/auth/sessions")
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${accessA}`);
    expect(listed.status).toBe(200);
    expect(listed.body.sessions).toHaveLength(2);

    const revoked = await request(app)
      .delete(`/v1/auth/sessions/${sidB}`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${accessA}`);
    expect(revoked.status).toBe(204);

    const deviceBRefresh = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshB}`);
    expect(deviceBRefresh.status).toBe(401);

    const deviceARefresh = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshA}`);
    expect(deviceARefresh.status).toBe(200);
  });

  it("clears cookies and revokes the session on logout", async () => {
    const { app } = createAuthApp({}, { clock: currentClock });
    await request(app).post("/v1/auth/register").send(validBody);
    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: validBody.email, password: validBody.password });
    const cookies = readSetCookies(login.headers);
    const accessToken = cookieValue(cookies, ACCESS_TOKEN_COOKIE);
    const refreshToken = cookieValue(cookies, REFRESH_TOKEN_COOKIE);

    const logout = await request(app)
      .post("/v1/auth/logout")
      .set(
        "Cookie",
        `${ACCESS_TOKEN_COOKIE}=${accessToken}; ${REFRESH_TOKEN_COOKIE}=${refreshToken}`,
      );
    expect(logout.status).toBe(204);
    const cleared = readSetCookies(logout.headers).join("\n");
    expect(cleared).toContain(`${ACCESS_TOKEN_COOKIE}=;`);
    expect(cleared).toContain(`${REFRESH_TOKEN_COOKIE}=;`);
    expect(cleared).toContain("Max-Age=0");

    const refresh = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
    expect(refresh.status).toBe(401);
  });

  it("publishes the public JWKS without private key material", async () => {
    const { app } = createAuthApp({}, { clock: currentClock });
    const response = await request(app).get("/.well-known/jwks.json");

    expect(response.status).toBe(200);
    expect(response.body.keys).toEqual([
      expect.objectContaining({ kid: "test-key", alg: "EdDSA", crv: "Ed25519", kty: "OKP" }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain("PRIVATE");
    expect(JSON.stringify(response.body)).not.toContain("MC4CAQAwBQYDK2VwBCIEILeSL");
  });
});
