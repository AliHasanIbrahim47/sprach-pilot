import { anonymizedEmail, DELETED_USER_LABEL } from "./constants.js";
import { type ZipEntry, zipStore } from "./zip.js";

export interface PrivacyExportData {
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  nativeLanguages: readonly string[];
  cityName: string | null;
  uiLocale: string;
  goals: readonly string[];
  cefrLevel: string | null;
  sessions: readonly {
    id: string;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
    revokedAt: string | null;
    userAgent: string | null;
  }[];
  tandem: { profile: null; messages: readonly TandemMessage[] };
  consents: readonly {
    policy: string;
    version: string;
    decision: string;
    recordedAt: string;
  }[];
  notifications: unknown;
  quietHours: unknown;
  accounts: readonly { provider: string; providerAccountId: string }[];
  files: readonly ZipEntry[];
}

/** JSON sections plus original files. Secrets such as password hashes are not fields here. */
export function exportEntries(data: PrivacyExportData): ZipEntry[] {
  const json = (value: unknown): Uint8Array => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  return [
    {
      path: "profile.json",
      body: json({
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        createdAt: data.createdAt,
        nativeLanguages: data.nativeLanguages,
        cityName: data.cityName,
        uiLocale: data.uiLocale,
        goals: data.goals,
        cefrLevel: data.cefrLevel,
      }),
    },
    { path: "sessions.json", body: json(data.sessions) },
    { path: "consents.json", body: json(data.consents) },
    { path: "notifications.json", body: json(data.notifications) },
    { path: "quiet-hours.json", body: json(data.quietHours) },
    { path: "accounts.json", body: json(data.accounts) },
    { path: "tandem.json", body: json(data.tandem) },
    ...data.files,
  ];
}

export function buildExportZip(data: PrivacyExportData): Buffer {
  return zipStore(exportEntries(data));
}

export interface TandemMessage {
  id: string;
  authorId: string;
  authorLabel: string;
  body: string;
}

/** Keeps the conversation and replaces the erased author's visible name. */
export function anonymizeTandemMessages(
  messages: readonly TandemMessage[],
  userId: string,
): TandemMessage[] {
  return messages.map((message) =>
    message.authorId === userId ? { ...message, authorLabel: DELETED_USER_LABEL } : { ...message },
  );
}

export interface PurgeIdentity {
  email: string;
  displayName: string;
  passwordHash: null;
  deletedAt: Date;
  deletionRequestedAt: null;
  purgeAfter: null;
}

export function purgeIdentity(userId: string, now: Date): PurgeIdentity {
  return {
    email: anonymizedEmail(userId),
    displayName: DELETED_USER_LABEL,
    passwordHash: null,
    deletedAt: now,
    deletionRequestedAt: null,
    purgeAfter: null,
  };
}
