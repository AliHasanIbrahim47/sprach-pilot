import { randomUUID } from "node:crypto";

import {
  buildExportZip,
  defaultNotificationPreferences,
  GDPR_GRACE_MS,
  isUiLocale,
  NotFoundError,
  OPTIONAL_CONSENT_POLICIES,
  PRIVACY_CONSENT_VERSION,
  purgeIdentity,
  REQUIRED_CONSENT_POLICIES,
  signExportToken,
  type UiLocale,
  UnauthorizedError,
  ValidationError,
  verifyExportToken,
  type ZipEntry,
} from "@sprachpilot/shared";

import type { AccountRepository } from "../auth/account.repository.js";
import type { UserRepository } from "../auth/auth.repository.js";
import { hashIp } from "../auth/ip-hash.js";
import type { SessionRepository } from "../auth/session.repository.js";
import type { EmailQueue } from "../email/email-queue.js";
import { keyFromAvatarUrl, type ObjectStorage } from "../settings/object-storage.js";
import type { SettingsRepository } from "../settings/settings.repository.js";
import type { GdprQueue } from "./gdpr-queue.js";
import type { PrivacyMetrics } from "./privacy.metrics.js";
import type { PrivacyRepository } from "./privacy.repository.js";
import { assertPrivacyDomains } from "./privacy-registry.js";

const STORAGE_PREFIXES = ["avatars/", "private/avatars/", "privacy/exports/"] as const;

export interface PrivacyService {
  overview(userId: string): Promise<{
    consents: {
      policy: string;
      version: string;
      decision: "granted" | "withdrawn";
      recordedAt: string;
    }[];
    deletion: { purgeAfter: string } | null;
    export: {
      id: string;
      status: "queued" | "ready" | "failed";
      downloadUrl: string | null;
    } | null;
  }>;
  requestExport(userId: string): Promise<{ id: string; status: "queued" }>;
  requestDeletion(userId: string): Promise<{ purgeAfter: string }>;
  updateConsent(input: {
    userId: string;
    policy: (typeof OPTIONAL_CONSENT_POLICIES)[number];
    granted: boolean;
    ip: string;
  }): Promise<void>;
  readExport(exportId: string, token: string): Promise<Buffer>;
  processExportJob(job: {
    exportId: string;
    userId: string;
    email: string;
    locale: UiLocale;
  }): Promise<void>;
  processPurgeJob(userId: string): Promise<void>;
  processExports(): Promise<void>;
  processDuePurges(): Promise<void>;
}

export interface PrivacyServiceDependencies {
  users: UserRepository;
  accounts: AccountRepository;
  sessions: SessionRepository;
  settings: SettingsRepository;
  store: PrivacyRepository;
  storage: ObjectStorage;
  emailQueue: EmailQueue;
  gdprQueue: GdprQueue;
  metrics: PrivacyMetrics;
  clock: () => Date;
  ipHashSecret: string;
  webPublicUrl: string;
}

export function createPrivacyService(dependencies: PrivacyServiceDependencies): PrivacyService {
  const {
    users,
    accounts,
    sessions,
    settings,
    store,
    storage,
    emailQueue,
    gdprQueue,
    metrics,
    clock,
    ipHashSecret,
    webPublicUrl,
  } = dependencies;

  const identityDomain = {
    id: "identity",
    async exportUser(userId: string) {
      return {
        user: await users.findById(userId),
        profile: await settings.getProfile(userId),
        notifications:
          (await settings.getNotifications(userId)) ?? defaultNotificationPreferences(),
        quietHours: await settings.getQuietHours(userId),
        sessions: await sessions.listForUser(userId),
        consents: await users.listConsents(userId),
        accounts: await accounts.listLinked(userId),
      };
    },
    async deleteUser(userId: string) {
      await store.clearAuditIps(userId);
      await store.deleteUserRows(userId);
      await users.anonymize(userId, purgeIdentity(userId, clock()));
    },
  };
  const avatarsDomain = {
    id: "avatars",
    async exportUser(userId: string) {
      const profile = await settings.getProfile(userId);
      return storedFiles(userId, profile?.avatarUrl ?? null);
    },
    async deleteUser(userId: string) {
      const profile = await settings.getProfile(userId);
      await deleteStoredObjects(userId, profile?.avatarUrl ?? null);
    },
  };
  const recordingsDomain = {
    id: "recordings",
    async exportUser(userId: string) {
      return store.recordings(userId);
    },
    async deleteUser(userId: string) {
      await store.deleteRecordings(userId);
    },
  };
  const tandemDomain = {
    id: "tandem",
    async exportUser(userId: string) {
      const messages = await store.messages();
      return messages.filter((message) => message.authorId === userId);
    },
    async deleteUser(userId: string) {
      await store.anonymizeMessages(userId);
    },
  };
  assertPrivacyDomains([identityDomain, avatarsDomain, recordingsDomain, tandemDomain]);

  return {
    async overview(userId) {
      const user = await requireActive(users, userId);
      const consents = await currentConsents(users, userId);
      const latest = await store.latestExport(userId);
      return {
        consents,
        deletion: user.purgeAfter ? { purgeAfter: user.purgeAfter.toISOString() } : null,
        export: latest
          ? {
              id: latest.id,
              status: latest.status,
              downloadUrl:
                latest.status === "ready" && latest.expiresAt && latest.expiresAt > clock()
                  ? downloadUrl(
                      webPublicUrl,
                      user.uiLocale,
                      latest.id,
                      latest.userId,
                      latest.expiresAt,
                      ipHashSecret,
                    )
                  : null,
            }
          : null,
      };
    },

    async requestExport(userId) {
      const user = await requireActive(users, userId);
      const id = randomUUID();
      await store.createExport({ id, userId });
      await gdprQueue.enqueueExport({
        exportId: id,
        userId,
        email: user.email,
        locale: user.uiLocale,
      });
      metrics.recordExport();
      return { id, status: "queued" as const };
    },

    async requestDeletion(userId) {
      const user = await requireActive(users, userId);
      const now = clock();
      const purgeAfter = user.purgeAfter ?? new Date(now.getTime() + GDPR_GRACE_MS);
      if (!user.deletionRequestedAt) {
        await users.scheduleDeletion(userId, now, purgeAfter);
        await sessions.revokeAllForUser({ userId, reason: "revoked", now });
        await gdprQueue.enqueuePurge({ userId }, purgeAfter);
        metrics.recordDeletion("requested");
      }
      return { purgeAfter: purgeAfter.toISOString() };
    },

    async updateConsent(input) {
      await requireActive(users, input.userId);
      if ((REQUIRED_CONSENT_POLICIES as readonly string[]).includes(input.policy)) {
        throw new ValidationError({ detail: "That consent is required while the account exists." });
      }
      const now = clock();
      await users.appendConsent(input.userId, {
        policy: input.policy,
        version: PRIVACY_CONSENT_VERSION,
        acceptedAt: now,
        ipHash: hashIp(input.ip, ipHashSecret),
        decision: input.granted ? "granted" : "withdrawn",
      });
      if (input.policy === "recording_storage") {
        await users.setRecordingTransient(input.userId, !input.granted);
        if (!input.granted) await store.deleteRecordings(input.userId);
      }
      if (input.policy === "product_emails" && !input.granted) {
        const current =
          (await settings.getNotifications(input.userId)) ?? defaultNotificationPreferences();
        await settings.saveNotifications(input.userId, {
          email: { ...current.email, product_news: false },
          push: { ...current.push, product_news: false },
        });
      }
    },

    async readExport(exportId, token) {
      const row = await store.findExport(exportId);
      if (!row || row.status !== "ready" || !row.objectKey || !row.expiresAt) {
        throw new NotFoundError("Export is not ready.");
      }
      const valid = verifyExportToken({
        secret: ipHashSecret,
        exportId,
        userId: row.userId,
        token,
        now: clock(),
      });
      if (!valid) throw new UnauthorizedError("Download link is invalid.");
      const object = await storage.get(row.objectKey);
      if (!object) throw new NotFoundError("Export is not ready.");
      return object.body;
    },

    async processExportJob(job) {
      try {
        await writeExport(job);
      } catch {
        await store.markExportFailed(job.exportId);
      }
    },

    async processPurgeJob(userId) {
      await purgeUser(userId, clock());
    },

    async processExports() {
      const jobs = gdprQueue.pullExports();
      for (const job of jobs) {
        try {
          await writeExport(job);
        } catch {
          await store.markExportFailed(job.exportId);
        }
      }
    },

    async processDuePurges() {
      const now = clock();
      metrics.setOverdue(await store.countOverdue(now));
      const queued = gdprQueue.pullDuePurges(now);
      const fromStore = await store.listDueUserIds(now);
      const userIds = [...new Set([...queued, ...fromStore])];
      for (const userId of userIds) {
        await purgeUser(userId, now);
      }
      metrics.setOverdue(await store.countOverdue(now));
    },
  };

  async function writeExport(job: {
    exportId: string;
    userId: string;
    email: string;
    locale: UiLocale;
  }): Promise<void> {
    const existing = await store.findExport(job.exportId);
    if (!existing || existing.status !== "queued") return;
    const identity = await identityDomain.exportUser(job.userId);
    if (!identity?.user || identity.user.deletedAt) {
      await store.markExportFailed(job.exportId);
      return;
    }
    const user = identity.user;
    const profile = identity.profile;
    const recordings = await recordingsDomain.exportUser(user.id);
    const avatarFiles = await avatarsDomain.exportUser(user.id);
    const tandem = await tandemDomain.exportUser(user.id);
    const now = clock();
    const expiresAt = new Date(now.getTime() + GDPR_GRACE_MS);
    const objectKey = `privacy/exports/${user.id}/${job.exportId}.zip`;
    const zip = buildExportZip({
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      nativeLanguages: profile?.nativeLanguages ?? [],
      cityName: profile?.city?.name ?? null,
      uiLocale: user.uiLocale,
      goals: profile?.goals ?? [],
      cefrLevel: profile?.cefrLevel ?? null,
      sessions: identity.sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        userAgent: session.userAgent,
      })),
      consents: identity.consents.map((consent) => ({
        policy: consent.policy,
        version: consent.version,
        decision: consent.decision ?? "granted",
        recordedAt: consent.acceptedAt.toISOString(),
      })),
      notifications: identity.notifications,
      quietHours: identity.quietHours,
      accounts: identity.accounts.map((account) => ({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
      tandem: { profile: null, messages: tandem },
      files: [...recordings, ...avatarFiles],
    });
    await storage.put({
      key: objectKey,
      body: zip,
      contentType: "application/zip",
      cacheControl: "private, no-store",
    });
    await store.markExportReady(job.exportId, objectKey, expiresAt, now);
    const locale = isUiLocale(job.locale) ? job.locale : "en";
    await emailQueue.enqueue({
      to: job.email,
      locale,
      template: "export-ready",
      url: downloadUrl(webPublicUrl, locale, job.exportId, user.id, expiresAt, ipHashSecret),
    });
  }

  async function purgeUser(userId: string, now: Date): Promise<void> {
    const user = await users.findById(userId);
    if (!user) return;
    if (user.deletedAt) {
      await deleteStoredObjects(userId, null);
      return;
    }
    if (!user.purgeAfter || user.purgeAfter.getTime() > now.getTime()) return;
    const overdueMs = now.getTime() - user.purgeAfter.getTime();
    if (overdueMs > 24 * 60 * 60 * 1000) metrics.recordDeletion("overdue");
    await recordingsDomain.deleteUser(userId);
    await tandemDomain.deleteUser(userId);
    await avatarsDomain.deleteUser(userId);
    await identityDomain.deleteUser(userId);
    metrics.recordDeletion("purged");
  }

  async function storedFiles(userId: string, avatarUrl: string | null): Promise<ZipEntry[]> {
    const files: ZipEntry[] = [];
    const keys = await objectKeysFor(userId, avatarUrl);
    for (const key of keys) {
      if (key.startsWith("privacy/exports/")) continue;
      const object = await storage.get(key);
      if (!object) continue;
      const name = key.split("/").pop() ?? "file";
      files.push({ path: `files/${name}`, body: object.body });
    }
    return files;
  }

  async function deleteStoredObjects(userId: string, avatarUrl: string | null): Promise<void> {
    const keys = await objectKeysFor(userId, avatarUrl);
    for (const key of new Set(keys)) {
      await storage.delete(key);
    }
  }

  async function objectKeysFor(userId: string, avatarUrl: string | null): Promise<string[]> {
    const keys: string[] = [];
    for (const prefix of STORAGE_PREFIXES) {
      keys.push(...(await storage.list(`${prefix}${userId}/`)));
    }
    const avatarKey = keyFromAvatarUrl(avatarUrl);
    if (avatarKey) keys.push(avatarKey);
    return keys;
  }
}

async function requireActive(users: UserRepository, userId: string) {
  const user = await users.findById(userId);
  if (!user || user.deletedAt) throw new NotFoundError("Account is not available.");
  return user;
}

async function currentConsents(users: UserRepository, userId: string) {
  const rows = await users.listConsents(userId);
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) latest.set(row.policy, row);
  for (const policy of OPTIONAL_CONSENT_POLICIES) {
    if (!latest.has(policy)) {
      latest.set(policy, {
        policy,
        version: PRIVACY_CONSENT_VERSION,
        acceptedAt: new Date(0),
        ipHash: "",
        decision: "withdrawn",
      });
    }
  }
  return [...latest.values()].map((row) => ({
    policy: row.policy,
    version: row.version,
    decision: row.decision ?? "granted",
    recordedAt: row.acceptedAt.toISOString(),
  }));
}

function downloadUrl(
  webPublicUrl: string,
  locale: string,
  exportId: string,
  userId: string,
  expiresAt: Date,
  secret: string,
): string {
  const token = signExportToken({ secret, exportId, userId, expiresAt });
  const url = new URL(`/${locale}/privacy/download`, webPublicUrl);
  url.searchParams.set("exportId", exportId);
  url.searchParams.set("token", token);
  return url.toString();
}
