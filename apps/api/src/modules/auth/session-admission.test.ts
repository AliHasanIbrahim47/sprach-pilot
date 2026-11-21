import { describe, expect, it } from "vitest";

import { createMemoryUserRepository } from "./auth.repository.js";
import { createMemorySessionRepository } from "./session.repository.js";
import { createSessionAdmission, type SessionAdmissionDependencies } from "./session-admission.js";
import type { TokenService } from "./token.service.js";

const NOW = new Date("2026-10-03T07:00:00.000Z");
const LATER = new Date("2026-10-11T07:00:00.000Z");

function createFakeTokens(): TokenService {
  return {
    accessTtlSeconds: 60,
    refreshTtlSeconds: 120,
    async signAccessToken(claims) {
      return `access:${claims.sub}:${claims.sid}`;
    },
    async verifyAccessToken() {
      throw new Error("unused");
    },
    createRefreshToken() {
      return "refresh-token";
    },
    hashRefreshToken(token) {
      return `hash:${token}`;
    },
    publicJwks() {
      return { keys: [] };
    },
  };
}

function createHarness(overrides: Partial<SessionAdmissionDependencies> = {}) {
  const users = createMemoryUserRepository();
  const sessions = createMemorySessionRepository();
  let cancellations = 0;
  const admission = createSessionAdmission({
    users,
    sessions,
    tokens: createFakeTokens(),
    clock: () => NOW,
    ipHashSecret: "test-ip-hash-secret",
    onDeletionCancelled() {
      cancellations += 1;
    },
    ...overrides,
  });
  return { admission, users, sessions, cancellations: () => cancellations };
}

async function addUser(users: ReturnType<typeof createMemoryUserRepository>) {
  const created = await users.createWithConsent({
    email: "ada@example.com",
    passwordHash: "hashed:secret",
    displayName: "Ada",
    uiLocale: "en",
    consents: [],
  });
  if (created.status !== "created") throw new Error("user was not created");
  const user = await users.findById(created.id);
  if (!user) throw new Error("user missing");
  return user;
}

describe("session admission", () => {
  it("classifies missing, deleted, purge-due, grace, and clear accounts", async () => {
    const { admission, users } = createHarness();
    const user = await addUser(users);

    expect(admission.classify(null)).toBe("blocked");
    expect(admission.classify(user)).toBe("clear");

    await users.scheduleDeletion(user.id, NOW, LATER);
    const grace = await users.findById(user.id);
    expect(admission.classify(grace)).toBe("grace");
    expect(grace?.deletionRequestedAt).toEqual(NOW);

    await users.scheduleDeletion(user.id, NOW, NOW);
    expect(admission.classify(await users.findById(user.id))).toBe("blocked");

    users.markDeleted(user.email);
    expect(admission.classify(await users.findById(user.id))).toBe("blocked");
  });

  it("opens a grace-window account by cancelling the deletion and minting a session", async () => {
    const { admission, users, sessions, cancellations } = createHarness();
    const user = await addUser(users);
    await users.scheduleDeletion(user.id, NOW, LATER);

    const opened = await admission.open((await users.findById(user.id)) ?? user, {
      ip: "203.0.113.10",
      userAgent: `  ${"a".repeat(300)}\u0000`,
    });

    expect(opened.status).toBe("opened");
    expect(cancellations()).toBe(1);
    expect((await users.findById(user.id))?.purgeAfter).toBeNull();
    const [session] = sessions.records();
    expect(session?.userId).toBe(user.id);
    expect(session?.userAgent).toHaveLength(256);
    if (opened.status === "opened") {
      expect(opened.credentials.refreshToken).toBe("refresh-token");
      expect(opened.credentials.accessToken).toContain(user.id);
    }
  });

  it("refuses a blocked account and a lost grace race without minting", async () => {
    const { admission, users, sessions, cancellations } = createHarness();
    const user = await addUser(users);
    await users.scheduleDeletion(user.id, NOW, NOW);
    const purgeDue = await users.findById(user.id);
    if (!purgeDue) throw new Error("user missing");

    expect(await admission.open(purgeDue, { ip: "203.0.113.10" })).toEqual({ status: "refused" });
    expect(cancellations()).toBe(0);
    expect(sessions.records()).toHaveLength(0);

    await users.scheduleDeletion(user.id, NOW, LATER);
    users.clearDeletion = async () => false;
    const grace = await users.findById(user.id);
    if (!grace) throw new Error("user missing");
    expect(await admission.open(grace, { ip: "203.0.113.10" })).toEqual({ status: "refused" });
    expect(cancellations()).toBe(0);
    expect(sessions.records()).toHaveLength(0);
    expect(grace.deletionRequestedAt).toEqual(NOW);
  });

  it("lets a clear account continue and refuses grace, deletion, and a purge", async () => {
    const { admission, users } = createHarness();
    const user = await addUser(users);

    expect(admission.continue(user)).toBe("allowed");
    expect(admission.continue(null)).toBe("refused");

    await users.scheduleDeletion(user.id, NOW, LATER);
    const grace = await users.findById(user.id);
    expect(admission.continue(grace)).toBe("refused");
    expect(grace?.purgeAfter).toEqual(LATER);

    await users.scheduleDeletion(user.id, NOW, NOW);
    expect(admission.continue(await users.findById(user.id))).toBe("refused");

    users.markDeleted(user.email);
    expect(admission.continue(await users.findById(user.id))).toBe("refused");
  });
});
