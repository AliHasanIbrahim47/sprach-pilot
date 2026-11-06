import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { type AuthOverrides, createContainer } from "../src/container.js";
import { createMemoryRoleRepository } from "../src/modules/access/role.repository.js";
import { createMemoryAccountRepository } from "../src/modules/auth/account.repository.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

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

function createAuthApp() {
  const users = createMemoryUserRepository();
  const roles = createMemoryRoleRepository(users);
  const email = createTestEmailPorts();
  const auth: AuthOverrides = {
    users,
    roles,
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
  });
  return { app: createApp(container), users, roles };
}

async function register(app: ReturnType<typeof createApp>, email: string, displayName: string) {
  await request(app).post("/v1/auth/register").send({
    email,
    password: "correct-horse-battery",
    displayName,
    acceptedTerms: true,
  });
}

function login(app: ReturnType<typeof createApp>, email: string) {
  return request(app).post("/v1/auth/login").send({
    email,
    password: "correct-horse-battery",
  });
}

function cookieHeader(response: request.Response, name: string): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const header = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  const value = header?.split(";")[0]?.slice(name.length + 1);
  if (!value) throw new Error(`missing ${name}`);
  return `${name}=${value}`;
}

describe("role assignment", () => {
  it("lets an admin grant moderator, refuses a learner, and keeps the old token role until refresh", async () => {
    const { app, users, roles } = createAuthApp();
    await register(app, "learner@example.com", "Ada");
    await register(app, "admin@example.com", "Admin");
    users.arrangeRole("admin@example.com", "admin");
    const learner = await login(app, "learner@example.com");
    const admin = await login(app, "admin@example.com");

    const learnerId = learner.body.user.id as string;
    const adminId = admin.body.user.id as string;
    const learnerAccess = cookieHeader(learner, ACCESS_TOKEN_COOKIE);

    const denied = await request(app)
      .patch(`/v1/admin/users/${adminId}`)
      .set("Cookie", learnerAccess)
      .send({ role: "moderator" });
    expect(denied.status).toBe(403);

    const granted = await request(app)
      .patch(`/v1/admin/users/${learnerId}`)
      .set("Cookie", cookieHeader(admin, ACCESS_TOKEN_COOKIE))
      .send({ role: "moderator" });
    expect(granted.status).toBe(200);
    expect(granted.body).toEqual({ id: learnerId, role: "moderator" });
    expect(roles.audits()).toEqual([
      {
        actorId: adminId,
        action: "role.assigned",
        entityType: "user",
        entityId: learnerId,
        metadata: { oldRole: "learner", newRole: "moderator" },
      },
    ]);

    const beforeRefresh = await request(app).get("/v1/auth/me").set("Cookie", learnerAccess);
    expect(beforeRefresh.status).toBe(200);
    expect(beforeRefresh.body.role).toBe("learner");

    const refreshed = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", cookieHeader(learner, REFRESH_TOKEN_COOKIE));
    expect(refreshed.status).toBe(200);
    const afterRefresh = await request(app)
      .get("/v1/auth/me")
      .set("Cookie", cookieHeader(refreshed, ACCESS_TOKEN_COOKIE));
    expect(afterRefresh.body.role).toBe("moderator");

    const repeat = await request(app)
      .patch(`/v1/admin/users/${learnerId}`)
      .set("Cookie", cookieHeader(admin, ACCESS_TOKEN_COOKIE))
      .send({ role: "moderator" });
    expect(repeat.status).toBe(200);
    expect(roles.audits()).toHaveLength(1);
  });

  it("refuses to remove the only admin", async () => {
    const { app, users } = createAuthApp();
    await register(app, "admin@example.com", "Admin");
    users.arrangeRole("admin@example.com", "admin");
    const admin = await login(app, "admin@example.com");
    const adminId = admin.body.user.id as string;

    const response = await request(app)
      .patch(`/v1/admin/users/${adminId}`)
      .set("Cookie", cookieHeader(admin, ACCESS_TOKEN_COOKIE))
      .send({ role: "learner" });

    expect(response.status).toBe(409);
    expect(users.records().find((user) => user.id === adminId)?.role).toBe("admin");
  });

  it("rejects a demoted admin's token and a missing user", async () => {
    const { app, users } = createAuthApp();
    await register(app, "kept@example.com", "Kept");
    await register(app, "demoted@example.com", "Demoted");
    users.arrangeRole("kept@example.com", "admin");
    users.arrangeRole("demoted@example.com", "admin");
    const kept = await login(app, "kept@example.com");
    const demoted = await login(app, "demoted@example.com");

    const demotedId = demoted.body.user.id as string;
    const demotedAccess = cookieHeader(demoted, ACCESS_TOKEN_COOKIE);

    const change = await request(app)
      .patch(`/v1/admin/users/${demotedId}`)
      .set("Cookie", cookieHeader(kept, ACCESS_TOKEN_COOKIE))
      .send({ role: "learner" });
    expect(change.status).toBe(200);

    const undone = await request(app)
      .patch(`/v1/admin/users/${demotedId}`)
      .set("Cookie", demotedAccess)
      .send({ role: "admin" });
    expect(undone.status).toBe(403);
    expect(users.records().find((user) => user.id === demotedId)?.role).toBe("learner");

    const missing = await request(app)
      .patch("/v1/admin/users/00000000-0000-7000-8000-000000000099")
      .set("Cookie", cookieHeader(kept, ACCESS_TOKEN_COOKIE))
      .send({ role: "learner" });
    expect(missing.status).toBe(404);
  });

  it("returns 404 for a soft-deleted user", async () => {
    const { app, users } = createAuthApp();
    await register(app, "gone@example.com", "Gone");
    await register(app, "admin@example.com", "Admin");
    users.arrangeRole("admin@example.com", "admin");
    const learner = await login(app, "gone@example.com");
    users.markDeleted("gone@example.com");
    const admin = await login(app, "admin@example.com");

    const response = await request(app)
      .patch(`/v1/admin/users/${learner.body.user.id}`)
      .set("Cookie", cookieHeader(admin, ACCESS_TOKEN_COOKIE))
      .send({ role: "volunteer" });

    expect(response.status).toBe(404);
    expect(users.records().find((user) => user.email === "gone@example.com")?.role).toBe("learner");
  });
});
