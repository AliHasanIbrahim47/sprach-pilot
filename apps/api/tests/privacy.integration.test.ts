import { unzipStore } from "@sprachpilot/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createContainer } from "../src/container.js";
import { createMemoryAccountRepository } from "../src/modules/auth/account.repository.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createMemoryPrivacyStore } from "../src/modules/privacy/privacy.store.js";
import { createMemoryObjectStorage } from "../src/modules/settings/object-storage.js";
import { createMemorySettingsRepository } from "../src/modules/settings/settings.repository.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

const PASSWORD = "correct-horse-battery";
const SECRET = "integration-ip-hash-secret";

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

function createPrivacyApp() {
  const users = createMemoryUserRepository();
  const email = createTestEmailPorts();
  const storage = createMemoryObjectStorage();
  const store = createMemoryPrivacyStore();
  let now = new Date();
  const clock = () => now;
  const config = loadConfig(
    createValidApiEnv({ IP_HASH_SECRET: SECRET, WEB_PUBLIC_URL: "http://localhost:3000" }),
  );
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth: {
      users,
      accounts: createMemoryAccountRepository(),
      sessions: createMemorySessionRepository(),
      throttle: createMemoryLoginThrottle(),
      metrics: createAuthMetrics(),
      hasher: createFakeHasher(),
      clock,
      emailTokens: email.emailTokens,
      emailSends: email.emailSends,
      emailQueue: email.emailQueue,
    },
    settings: { storage, store: createMemorySettingsRepository(), clock },
    privacy: { store, clock },
  });
  return {
    app: createApp(container),
    email,
    users,
    store,
    storage,
    container,
    advance(next: Date) {
      now = next;
    },
    now: () => now,
  };
}

async function registerAndLogin(app: ReturnType<typeof createApp>, address: string) {
  const registered = await request(app).post("/v1/auth/register").send({
    email: address,
    password: PASSWORD,
    displayName: "Ada",
    acceptedTerms: true,
  });
  expect(registered.status).toBe(202);
  const session = await request(app).post("/v1/auth/login").send({
    email: address,
    password: PASSWORD,
  });
  expect(session.status).toBe(200);
  return cookieHeader(session);
}

function cookieHeader(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

describe("privacy http", () => {
  it("emails a signed link to a zip of the learner data", async () => {
    const harness = createPrivacyApp();
    const cookie = await registerAndLogin(harness.app, "ada@example.com");
    const user = harness.users.records()[0];
    if (!user) throw new Error("missing user");
    await harness.storage.put({
      key: `avatars/${user.id}/photo.webp`,
      body: Buffer.from("avatar-bytes"),
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000",
    });

    const queued = await request(harness.app)
      .post("/v1/privacy/export")
      .set("cookie", cookie)
      .send();
    expect(queued.status).toBe(202);
    expect(queued.body.status).toBe("queued");

    await harness.container.processPrivacyJobs();
    const message = harness.email.emailQueue.jobs().at(-1);
    expect(message?.template).toBe("export-ready");
    expect(message?.to).toBe("ada@example.com");
    const link = new URL(message?.url ?? "");
    const token = link.searchParams.get("token");
    const exportId = link.searchParams.get("exportId");
    expect(token).toBeTruthy();
    expect(exportId).toBe(queued.body.id);

    const download = await request(harness.app)
      .get(`/v1/privacy/exports/${exportId}/download?token=${encodeURIComponent(token ?? "")}`)
      .set("accept-encoding", "identity")
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    const files = unzipStore(download.body as Buffer);
    const profile = JSON.parse(files.get("profile.json")?.toString("utf8") ?? "{}") as {
      email?: string;
      displayName?: string;
    };
    expect(profile.email).toBe("ada@example.com");
    expect(profile.displayName).toBe("Ada");
    expect(files.get("files/photo.webp")?.toString("utf8")).toBe("avatar-bytes");
    expect(download.body.toString("utf8")).not.toContain("hashed:");

    const expired = new Date(harness.now().getTime() + 8 * 24 * 60 * 60 * 1000);
    harness.advance(expired);
    const rejected = await request(harness.app)
      .get(`/v1/privacy/exports/${exportId}/download?token=${encodeURIComponent(token ?? "")}`)
      .set("accept-encoding", "identity");
    expect(rejected.status).toBe(401);
  });

  it("signs the learner out, lets login cancel deletion, and refuses login after the grace", async () => {
    const harness = createPrivacyApp();
    const cookie = await registerAndLogin(harness.app, "ada@example.com");
    const deletion = await request(harness.app)
      .post("/v1/privacy/deletion")
      .set("cookie", cookie)
      .send();
    expect(deletion.status).toBe(202);
    expect(deletion.headers["set-cookie"]?.join(";") ?? "").toContain("Max-Age=0");

    const blocked = await request(harness.app).get("/v1/privacy");
    expect(blocked.status).toBe(401);

    const cancelled = await request(harness.app).post("/v1/auth/login").send({
      email: "ada@example.com",
      password: PASSWORD,
    });
    expect(cancelled.status).toBe(200);
    expect((await harness.users.findByEmail("ada@example.com"))?.purgeAfter).toBeNull();

    const again = await registerAndLogin(harness.app, "bea@example.com");
    await request(harness.app).post("/v1/privacy/deletion").set("cookie", again).send();
    harness.advance(new Date(harness.now().getTime() + 8 * 24 * 60 * 60 * 1000));
    const refused = await request(harness.app).post("/v1/auth/login").send({
      email: "bea@example.com",
      password: PASSWORD,
    });
    expect(refused.status).toBe(401);
  });

  it("records a withdrawn recording consent and deletes stored recordings", async () => {
    const harness = createPrivacyApp();
    const cookie = await registerAndLogin(harness.app, "ada@example.com");
    const user = harness.users.records()[0];
    if (!user) throw new Error("missing user");
    await harness.store.addRecording(user.id, {
      path: "files/clip.webm",
      body: Buffer.from("audio"),
    });

    const withdrawn = await request(harness.app)
      .put("/v1/privacy/consents")
      .set("cookie", cookie)
      .send({ policy: "recording_storage", granted: false });
    expect(withdrawn.status).toBe(200);
    const recording = withdrawn.body.consents.find(
      (consent: { policy: string }) => consent.policy === "recording_storage",
    );
    expect(recording.decision).toBe("withdrawn");
    expect(recording.version).toBe("2026-11-14");
    expect(await harness.store.recordings(user.id)).toEqual([]);
    expect((await harness.users.findById(user.id))?.recordingStorageTransient).toBe(true);

    const required = await request(harness.app)
      .put("/v1/privacy/consents")
      .set("cookie", cookie)
      .send({ policy: "terms", granted: false });
    expect(required.status).toBe(400);
  });
});
