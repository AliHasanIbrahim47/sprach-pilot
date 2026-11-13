import { type Prisma, prisma, type PrismaClient } from "@sprachpilot/db";
import {
  type CityPoint,
  defaultNotificationPreferences,
  isUiLocale,
  LEARNING_GOALS,
  type LearningGoal,
  NATIVE_LANGUAGE_CODES,
  type NativeLanguage,
  NotFoundError,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationPreferences,
  type PlacementLevel,
  type QuietHoursWindow,
  type UiLocale,
} from "@sprachpilot/shared";

export interface SettingsProfileRecord {
  userId: string;
  uiLocale: UiLocale;
  nativeLanguages: NativeLanguage[];
  cefrLevel: PlacementLevel | null;
  goals: LearningGoal[];
  city: CityPoint | null;
  timezone: string;
  avatarUrl: string | null;
}

export interface PendingEmailRecord {
  email: string;
  expiresAt: Date;
}

export interface SettingsRepository {
  getProfile(userId: string): Promise<SettingsProfileRecord | null>;
  saveProfile(profile: SettingsProfileRecord): Promise<void>;
  getNotifications(userId: string): Promise<NotificationPreferences | null>;
  saveNotifications(userId: string, preferences: NotificationPreferences): Promise<void>;
  getQuietHours(userId: string): Promise<QuietHoursWindow | null>;
  saveQuietHours(userId: string, quietHours: QuietHoursWindow): Promise<void>;
  getPendingEmail(userId: string): Promise<PendingEmailRecord | null>;
  /** Replaces this learner's pending address. `taken` when another account holds it. */
  setPendingEmail(input: {
    userId: string;
    email: string;
    expiresAt: Date;
  }): Promise<"saved" | "taken">;
  clearPendingEmail(userId: string): Promise<void>;
}

export function createSettingsRepository(client: PrismaClient = prisma): SettingsRepository {
  return {
    async getProfile(userId) {
      const row = await client.profile.findUnique({ where: { userId } });
      if (!row || row.deletedAt) return null;
      return fromProfile(row);
    },

    async saveProfile(profile) {
      const data = profileData(profile);
      const existing = await client.profile.findUnique({ where: { userId: profile.userId } });
      if (existing?.deletedAt) throw new NotFoundError("Profile not found");
      if (!existing) {
        await client.profile.create({ data: { userId: profile.userId, ...data } });
        return;
      }
      await client.profile.update({ where: { userId: profile.userId }, data });
    },

    async getNotifications(userId) {
      const rows = await client.notificationPreference.findMany({ where: { userId } });
      if (rows.length === 0) return null;
      return preferencesFromRows(rows);
    },

    async saveNotifications(userId, preferences) {
      const data = NOTIFICATION_CHANNELS.flatMap((channel) =>
        NOTIFICATION_CATEGORIES.map((category) => ({
          userId,
          channel,
          category,
          enabled: categoryFlag(preferences, channel, category),
        })),
      );
      await client.$transaction([
        client.notificationPreference.deleteMany({ where: { userId } }),
        client.notificationPreference.createMany({ data }),
      ]);
    },

    async getQuietHours(userId) {
      const row = await client.quietHours.findUnique({ where: { userId } });
      if (!row) return null;
      return { enabled: row.enabled, startMinute: row.startMinute, endMinute: row.endMinute };
    },

    async saveQuietHours(userId, quietHours) {
      await client.quietHours.upsert({
        where: { userId },
        create: { userId, ...quietHours },
        update: quietHours,
      });
    },

    async getPendingEmail(userId) {
      const row = await client.pendingEmail.findUnique({ where: { userId } });
      return row ? { email: row.email, expiresAt: row.expiresAt } : null;
    },

    async setPendingEmail(input) {
      const holder = await client.pendingEmail.findUnique({ where: { email: input.email } });
      if (holder && holder.userId !== input.userId) {
        if (holder.expiresAt.getTime() > Date.now()) return "taken";
        await client.pendingEmail.delete({ where: { userId: holder.userId } });
      }
      await client.pendingEmail.upsert({
        where: { userId: input.userId },
        create: input,
        update: { email: input.email, expiresAt: input.expiresAt },
      });
      return "saved";
    },

    async clearPendingEmail(userId) {
      await client.pendingEmail.deleteMany({ where: { userId } });
    },
  };
}

export function createMemorySettingsRepository(
  now: () => Date = () => new Date(),
): SettingsRepository {
  const profiles = new Map<string, SettingsProfileRecord>();
  const notifications = new Map<string, NotificationPreferences>();
  const quietHours = new Map<string, QuietHoursWindow>();
  const pending = new Map<string, PendingEmailRecord & { userId: string }>();

  return {
    async getProfile(userId) {
      const row = profiles.get(userId);
      return row
        ? {
            ...row,
            nativeLanguages: [...row.nativeLanguages],
            goals: [...row.goals],
            city: row.city ? { ...row.city } : null,
          }
        : null;
    },

    async saveProfile(profile) {
      profiles.set(profile.userId, {
        ...profile,
        nativeLanguages: [...profile.nativeLanguages],
        goals: [...profile.goals],
        city: profile.city ? { ...profile.city } : null,
      });
    },

    async getNotifications(userId) {
      const row = notifications.get(userId);
      return row ? structuredClone(row) : null;
    },

    async saveNotifications(userId, preferences) {
      notifications.set(userId, structuredClone(preferences));
    },

    async getQuietHours(userId) {
      const row = quietHours.get(userId);
      return row ? { ...row } : null;
    },

    async saveQuietHours(userId, window) {
      quietHours.set(userId, { ...window });
    },

    async getPendingEmail(userId) {
      const row = pending.get(userId);
      return row ? { email: row.email, expiresAt: row.expiresAt } : null;
    },

    async setPendingEmail(input) {
      for (const row of pending.values()) {
        if (row.email !== input.email || row.userId === input.userId) continue;
        if (row.expiresAt.getTime() > now().getTime()) return "taken";
        pending.delete(row.userId);
      }
      pending.set(input.userId, { ...input });
      return "saved";
    },

    async clearPendingEmail(userId) {
      pending.delete(userId);
    },
  };
}

function fromProfile(row: {
  userId: string;
  uiLocale: string;
  nativeLanguages: string[];
  cefrLevel: string | null;
  goals: string[];
  cityId: string | null;
  cityName: string | null;
  cityLatitude: Prisma.Decimal | null;
  cityLongitude: Prisma.Decimal | null;
  timezone: string;
  avatarUrl: string | null;
}): SettingsProfileRecord {
  const latitude = row.cityLatitude === null ? null : row.cityLatitude.toNumber();
  const longitude = row.cityLongitude === null ? null : row.cityLongitude.toNumber();
  const city =
    row.cityId && row.cityName && latitude !== null && longitude !== null
      ? { id: row.cityId, name: row.cityName, latitude, longitude }
      : null;
  return {
    userId: row.userId,
    uiLocale: isUiLocale(row.uiLocale) ? row.uiLocale : "en",
    nativeLanguages: row.nativeLanguages.filter((value): value is NativeLanguage =>
      (NATIVE_LANGUAGE_CODES as readonly string[]).includes(value),
    ),
    cefrLevel: readLevel(row.cefrLevel),
    goals: row.goals.filter((value): value is LearningGoal =>
      (LEARNING_GOALS as readonly string[]).includes(value),
    ),
    city,
    timezone: row.timezone,
    avatarUrl: row.avatarUrl,
  };
}

function readLevel(value: string | null): PlacementLevel | null {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2" || value === "C1") {
    return value;
  }
  return null;
}

function profileData(profile: SettingsProfileRecord) {
  return {
    uiLocale: profile.uiLocale,
    nativeLanguages: profile.nativeLanguages,
    cefrLevel: profile.cefrLevel,
    goals: profile.goals,
    cityId: profile.city?.id ?? null,
    cityName: profile.city?.name ?? null,
    cityLatitude: profile.city?.latitude ?? null,
    cityLongitude: profile.city?.longitude ?? null,
    timezone: profile.timezone,
    avatarUrl: profile.avatarUrl,
  };
}

function preferencesFromRows(
  rows: readonly { channel: string; category: string; enabled: boolean }[],
): NotificationPreferences {
  const preferences = defaultNotificationPreferences();
  for (const row of rows) {
    if (!isChannel(row.channel) || !isCategory(row.category)) continue;
    categoryFlag(preferences, row.channel, row.category, row.enabled);
  }
  return preferences;
}

function categoryFlag(
  preferences: NotificationPreferences,
  channel: "email" | "push",
  category: "review_reminders" | "event_reminders" | "match_requests" | "product_news",
  enabled?: boolean,
): boolean {
  const group = channel === "email" ? preferences.email : preferences.push;
  if (category === "review_reminders") {
    if (enabled !== undefined) group.review_reminders = enabled;
    return group.review_reminders;
  }
  if (category === "event_reminders") {
    if (enabled !== undefined) group.event_reminders = enabled;
    return group.event_reminders;
  }
  if (category === "match_requests") {
    if (enabled !== undefined) group.match_requests = enabled;
    return group.match_requests;
  }
  if (enabled !== undefined) group.product_news = enabled;
  return group.product_news;
}

function isChannel(value: string): value is "email" | "push" {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

function isCategory(
  value: string,
): value is "review_reminders" | "event_reminders" | "match_requests" | "product_news" {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}
