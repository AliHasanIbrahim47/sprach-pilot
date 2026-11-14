import { anonymizedEmail, DELETED_USER_LABEL } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { createMemoryAccountRepository } from "../src/modules/auth/account.repository.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createMemoryEmailQueue } from "../src/modules/email/email-queue.js";
import { createMemoryGdprQueue } from "../src/modules/privacy/gdpr-queue.js";
import { createPrivacyMetrics } from "../src/modules/privacy/privacy.metrics.js";
import { createPrivacyService } from "../src/modules/privacy/privacy.service.js";
import { createMemoryPrivacyStore } from "../src/modules/privacy/privacy.store.js";
import { createMemoryObjectStorage } from "../src/modules/settings/object-storage.js";
import { createMemorySettingsRepository } from "../src/modules/settings/settings.repository.js";

const START = new Date("2026-11-01T00:00:00.000Z");

describe("gdpr deletion verification", () => {
  it("removes personal data after the grace period and keeps tandem messages as Deleted user", async () => {
    const users = createMemoryUserRepository();
    const store = createMemoryPrivacyStore();
    const storage = createMemoryObjectStorage();
    let now = START;
    const created = await users.createWithConsent({
      email: "ada@example.com",
      passwordHash: "hashed:secret",
      displayName: "Ada",
      uiLocale: "en",
      consents: [],
    });
    if (created.status !== "created") throw new Error("expected a user");
    await store.addMessage({
      id: "message-1",
      authorId: created.id,
      authorLabel: "Ada",
      body: "Hallo, ich suche eine Wohnung.",
    });
    await store.addMessage({
      id: "message-2",
      authorId: "partner",
      authorLabel: "Bea",
      body: "Gerne.",
    });
    await store.addRecording(created.id, {
      path: "files/clip.webm",
      body: Buffer.from("audio"),
    });
    await store.rememberAuditIp(created.id, "ip-hash");
    await storage.put({
      key: `avatars/${created.id}/photo.webp`,
      body: Buffer.from("image"),
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000",
    });

    const privacy = createPrivacyService({
      users,
      accounts: createMemoryAccountRepository(),
      sessions: createMemorySessionRepository(),
      settings: createMemorySettingsRepository(),
      store,
      storage,
      emailQueue: createMemoryEmailQueue(),
      gdprQueue: createMemoryGdprQueue(),
      metrics: createPrivacyMetrics(),
      clock: () => now,
      ipHashSecret: "integration-ip-hash-secret",
      webPublicUrl: "http://localhost:3000",
    });

    await privacy.requestDeletion(created.id);
    now = new Date(START.getTime() + 6 * 24 * 60 * 60 * 1000);
    await privacy.processDuePurges();
    const stillThere = await users.findById(created.id);
    expect(stillThere?.email).toBe("ada@example.com");
    expect(stillThere?.displayName).toBe("Ada");

    now = new Date(START.getTime() + 8 * 24 * 60 * 60 * 1000);
    await privacy.processDuePurges();
    await privacy.processPurgeJob(created.id);

    const purged = await users.findById(created.id);
    expect(purged?.email).toBe(anonymizedEmail(created.id));
    expect(purged?.displayName).toBe(DELETED_USER_LABEL);
    expect(purged?.passwordHash).toBeNull();
    expect(purged?.deletedAt).toEqual(now);
    expect(await store.recordings(created.id)).toEqual([]);
    expect(await store.auditIps(created.id)).toEqual([]);
    expect(await storage.list(`avatars/${created.id}/`)).toEqual([]);
    expect(await store.messages()).toEqual([
      {
        id: "message-1",
        authorId: created.id,
        authorLabel: DELETED_USER_LABEL,
        body: "Hallo, ich suche eine Wohnung.",
      },
      {
        id: "message-2",
        authorId: "partner",
        authorLabel: "Bea",
        body: "Gerne.",
      },
    ]);
  });
});
