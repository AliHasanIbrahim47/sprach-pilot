import { ACCESS_TOKEN_COOKIE, MAX_AVATAR_BYTES, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { type AuthOverrides, createContainer } from "../src/container.js";
import { createMemoryAccountRepository } from "../src/modules/auth/account.repository.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createMemoryAvatarQueue } from "../src/modules/settings/avatar-queue.js";
import { createMemoryObjectStorage } from "../src/modules/settings/object-storage.js";
import { createMemorySettingsRepository } from "../src/modules/settings/settings.repository.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

const PASSWORD = "correct-horse-battery";

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

function createSettingsApp() {
  const users = createMemoryUserRepository();
  const email = createTestEmailPorts();
  const avatars = createMemoryAvatarQueue();
  const auth: AuthOverrides = {
    users,
    accounts: createMemoryAccountRepository(),
    sessions: createMemorySessionRepository(),
    throttle: createMemoryLoginThrottle(),
    metrics: createAuthMetrics(),
    hasher: createFakeHasher(),
    clock: () => new Date(),
    emailTokens: email.emailTokens,
    emailSends: email.emailSends,
    emailQueue: email.emailQueue,
  };
  const config = loadConfig(createValidApiEnv({ IP_HASH_SECRET: "integration-ip-hash-secret" }));
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth,
    settings: {
      storage: createMemoryObjectStorage(),
      store: createMemorySettingsRepository(),
      avatars,
      clock: () => new Date(),
    },
  });
  return { app: createApp(container), email, avatars, users };
}

async function register(app: ReturnType<typeof createApp>, email: string) {
  const response = await request(app).post("/v1/auth/register").send({
    email,
    password: PASSWORD,
    displayName: "Ada",
    acceptedTerms: true,
  });
  expect(response.status).toBe(202);
}

async function login(app: ReturnType<typeof createApp>, email: string, password = PASSWORD) {
  return request(app).post("/v1/auth/login").send({ email, password });
}

function readCookie(response: request.Response, name: string): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const header = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  const value = header?.split(";")[0]?.slice(name.length + 1);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function cookieHeader(response: request.Response, name: string): string {
  return `${name}=${readCookie(response, name)}`;
}

describe("profile settings", () => {
  it("starts with product news off and review reminders on", async () => {
    const { app } = createSettingsApp();
    await register(app, "ada@example.com");
    const session = await login(app, "ada@example.com");
    const response = await request(app)
      .get("/v1/settings")
      .set("cookie", cookieHeader(session, ACCESS_TOKEN_COOKIE));

    expect(response.status).toBe(200);
    expect(response.body.notifications.email.product_news).toBe(false);
    expect(response.body.notifications.push.product_news).toBe(false);
    expect(response.body.notifications.email.review_reminders).toBe(true);
    expect(response.body.notifications.push.review_reminders).toBe(true);
    expect(response.body.quietHours).toEqual({ enabled: false, start: "22:00", end: "07:00" });
  });

  it("keeps the old email for login until the new address is confirmed", async () => {
    const { app, email } = createSettingsApp();
    await register(app, "ada@example.com");
    const session = await login(app, "ada@example.com");
    const access = cookieHeader(session, ACCESS_TOKEN_COOKIE);

    const change = await request(app)
      .post("/v1/settings/email")
      .set("cookie", access)
      .send({ currentPassword: PASSWORD, email: "ada.new@example.com" });
    expect(change.status).toBe(202);

    const me = await request(app).get("/v1/auth/me").set("cookie", access);
    expect(me.body.email).toBe("ada@example.com");

    const oldLogin = await login(app, "ada@example.com");
    expect(oldLogin.status).toBe(200);
    const newLogin = await login(app, "ada.new@example.com");
    expect(newLogin.status).toBe(401);

    const job = email.emailQueue.jobs().at(-1);
    const token = new URL(job?.url ?? "").searchParams.get("token");
    const confirm = await request(app).post("/v1/settings/email/confirm").send({ token });
    expect(confirm.status).toBe(200);

    expect((await login(app, "ada@example.com")).status).toBe(401);
    expect((await login(app, "ada.new@example.com")).status).toBe(200);
    const renamed = await request(app).get("/v1/auth/me").set("cookie", access);
    expect(renamed.body.email).toBe("ada.new@example.com");
  });

  it("changes the password only with the current one and revokes other sessions", async () => {
    const { app } = createSettingsApp();
    await register(app, "ada@example.com");
    const first = await login(app, "ada@example.com");
    const second = await login(app, "ada@example.com");

    const rejected = await request(app)
      .post("/v1/settings/password")
      .set("cookie", cookieHeader(first, ACCESS_TOKEN_COOKIE))
      .send({ currentPassword: "wrong-password-value", password: "brand-new-passphrase" });
    expect(rejected.status).toBe(400);

    const updated = await request(app)
      .post("/v1/settings/password")
      .set("cookie", cookieHeader(first, ACCESS_TOKEN_COOKIE))
      .send({ currentPassword: PASSWORD, password: "brand-new-passphrase" });
    expect(updated.status).toBe(200);

    const otherDevice = await request(app)
      .post("/v1/auth/refresh")
      .set("cookie", `${REFRESH_TOKEN_COOKIE}=${readCookie(second, REFRESH_TOKEN_COOKIE)}`);
    expect(otherDevice.status).toBe(401);

    const thisDevice = await request(app)
      .post("/v1/auth/refresh")
      .set("cookie", `${REFRESH_TOKEN_COOKIE}=${readCookie(first, REFRESH_TOKEN_COOKIE)}`);
    expect(thisDevice.status).toBe(200);
    expect((await login(app, "ada@example.com", "brand-new-passphrase")).status).toBe(200);
  });

  it("rejects an oversized or non-image avatar and accepts a small jpeg", async () => {
    const { app, avatars } = createSettingsApp();
    await register(app, "ada@example.com");
    const access = cookieHeader(await login(app, "ada@example.com"), ACCESS_TOKEN_COOKIE);

    const text = await request(app)
      .post("/v1/settings/avatar")
      .set("cookie", access)
      .set("content-type", "image/jpeg")
      .send(Buffer.from("not a photo"));
    expect(text.status).toBe(400);

    const oversized = Buffer.alloc(MAX_AVATAR_BYTES + 1);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    const tooBig = await request(app)
      .post("/v1/settings/avatar")
      .set("cookie", access)
      .set("content-type", "image/jpeg")
      .send(oversized);
    expect(tooBig.status).toBe(400);
    expect(avatars.jobs()).toHaveLength(0);

    const truncated = Buffer.alloc(16);
    truncated[0] = 0xff;
    truncated[1] = 0xd8;
    truncated[2] = 0xff;
    const incomplete = await request(app)
      .post("/v1/settings/avatar")
      .set("cookie", access)
      .set("content-type", "image/jpeg")
      .send(truncated);
    expect(incomplete.status).toBe(400);
    expect(avatars.jobs()).toHaveLength(0);

    const jpeg = Buffer.from(
      "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJXAIf/Z",
      "base64",
    );
    const accepted = await request(app)
      .post("/v1/settings/avatar")
      .set("cookie", access)
      .set("content-type", "image/jpeg")
      .send(jpeg);
    expect(accepted.status).toBe(202);
    expect(avatars.jobs()).toHaveLength(1);
  });

  it("saves the profile, quiet hours, and a city centroid", async () => {
    const { app } = createSettingsApp();
    await register(app, "ada@example.com");
    const access = cookieHeader(await login(app, "ada@example.com"), ACCESS_TOKEN_COOKIE);

    const profile = await request(app)
      .patch("/v1/settings/profile")
      .set("cookie", access)
      .send({
        displayName: "Ada Lovelace",
        nativeLanguages: ["en"],
        cefrLevel: "A2",
        goals: ["housing"],
        cityId: "de-berlin",
        timezone: "Europe/Berlin",
      });
    expect(profile.status).toBe(200);
    expect(profile.body.profile.displayName).toBe("Ada Lovelace");
    expect(profile.body.profile.city).toMatchObject({ id: "de-berlin", name: "Berlin" });
    expect(profile.body.profile.city.latitude).toBeCloseTo(52.52, 1);

    const quiet = await request(app)
      .put("/v1/settings/quiet-hours")
      .set("cookie", access)
      .send({ enabled: true, start: "22:00", end: "07:00" });
    expect(quiet.status).toBe(200);
    expect(quiet.body.quietHours).toEqual({ enabled: true, start: "22:00", end: "07:00" });
  });

  it("keeps the confirmation link when the new address is taken", async () => {
    const { app, email, users } = createSettingsApp();
    await register(app, "ada@example.com");
    const access = cookieHeader(await login(app, "ada@example.com"), ACCESS_TOKEN_COOKIE);
    const change = await request(app)
      .post("/v1/settings/email")
      .set("cookie", access)
      .send({ currentPassword: PASSWORD, email: "taken@example.com" });
    expect(change.status).toBe(202);
    const token = new URL(email.emailQueue.jobs().at(-1)?.url ?? "").searchParams.get("token");

    await register(app, "taken@example.com");
    const blocked = await request(app).post("/v1/settings/email/confirm").send({ token });
    expect(blocked.status).toBe(409);

    const holder = await users.findByEmail("taken@example.com");
    expect(holder).not.toBeNull();
    await users.changeEmail(holder?.id ?? "", "freed@example.com", new Date());

    const confirmed = await request(app).post("/v1/settings/email/confirm").send({ token });
    expect(confirmed.status).toBe(200);
    expect((await login(app, "taken@example.com")).status).toBe(200);
  });

  it("saves profile changes inside the 300 ms p95 budget", async () => {
    const { app } = createSettingsApp();
    await register(app, "ada@example.com");
    const access = cookieHeader(await login(app, "ada@example.com"), ACCESS_TOKEN_COOKIE);
    const samples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      const response = await request(app)
        .patch("/v1/settings/profile")
        .set("cookie", access)
        .send({ displayName: `Ada ${index}` });
      samples.push(performance.now() - started);
      expect(response.status).toBe(200);
    }
    samples.sort((left, right) => left - right);
    const p95 = samples[18] ?? 0;
    expect(p95).toBeLessThan(300);

    const metrics = await request(app).get("/metrics");
    expect(metrics.text).toContain("settings_save_duration_ms_count 20");
    expect(metrics.text).toContain('settings_save_duration_ms_bucket{le="300"} 20');
  });
});
