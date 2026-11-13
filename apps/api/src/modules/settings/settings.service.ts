import { randomUUID } from "node:crypto";

import {
  AUTH_COPY,
  type AvatarJob,
  type CityPoint,
  clockToMinute,
  ConflictError,
  DEFAULT_QUIET_HOURS,
  defaultNotificationPreferences,
  type EmailChangeBody,
  ExternalServiceError,
  isUiLocale,
  MAX_AVATAR_BYTES,
  minuteToClock,
  type NotificationPreferences,
  type PasswordChangeBody,
  RateLimitedError,
  SETTINGS_COPY,
  type SettingsResponse,
  type UiLocale,
  UnauthorizedError,
  type UpdateProfileBody,
  ValidationError,
} from "@sprachpilot/shared";

import type { UserRepository } from "../auth/auth.repository.js";
import type { EmailTokenRepository } from "../auth/email-token.repository.js";
import type { EmailTokenCodec } from "../auth/email-token-codec.js";
import {
  emailTokenExpired,
  emailTokenInvalid,
  emailTokenUsed,
} from "../auth/email-token-errors.js";
import type { PasswordHasher } from "../auth/password-hasher.js";
import { isCommonPassword } from "../auth/password-policy.js";
import type { SessionRepository } from "../auth/session.repository.js";
import type { EmailQueue } from "../email/email-queue.js";
import type { EmailSendLimiter } from "../email/email-rate-limit.js";
import { findCity, toCityPoint } from "../onboarding/cities.js";
import type { AvatarQueue } from "./avatar-queue.js";
import { invalidAvatar, isAvatarImage } from "./image-type.js";
import type { ObjectStorage } from "./object-storage.js";
import type { SettingsRepository } from "./settings.repository.js";

const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SettingsLogger {
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface SettingsServiceDependencies {
  users: UserRepository;
  sessions: SessionRepository;
  store: SettingsRepository;
  hasher: PasswordHasher;
  emailTokens: EmailTokenRepository;
  emailCodec: EmailTokenCodec;
  emailSends: EmailSendLimiter;
  emailQueue: EmailQueue;
  storage: ObjectStorage;
  avatars: AvatarQueue;
  webPublicUrl: string;
  clock: () => Date;
  logger: SettingsLogger;
}

export interface SettingsService {
  get(userId: string): Promise<SettingsResponse>;
  updateProfile(userId: string, body: UpdateProfileBody): Promise<SettingsResponse>;
  updateNotifications(userId: string, body: NotificationPreferences): Promise<SettingsResponse>;
  updateQuietHours(userId: string, body: SettingsResponse["quietHours"]): Promise<SettingsResponse>;
  requestEmailChange(
    userId: string,
    body: EmailChangeBody,
    locale: string | undefined,
  ): Promise<{ status: "pending"; message: string }>;
  confirmEmailChange(token: string): Promise<{ status: "confirmed"; message: string }>;
  changePassword(
    userId: string,
    familyId: string,
    body: PasswordChangeBody,
  ): Promise<{ status: "updated"; message: string }>;
  acceptAvatar(userId: string, bytes: Buffer): Promise<{ status: "accepted"; message: string }>;
}

/**
 * Profile, account, and notification settings (SP-018).
 * The login email changes only after the new address is confirmed.
 */
export function createSettingsService(dependencies: SettingsServiceDependencies): SettingsService {
  const {
    users,
    sessions,
    store,
    hasher,
    emailTokens,
    emailCodec,
    emailSends,
    emailQueue,
    storage,
    avatars,
    webPublicUrl,
    clock,
    logger,
  } = dependencies;

  async function requireUser(userId: string) {
    const user = await users.findById(userId);
    if (!user || user.deletedAt) throw new UnauthorizedError();
    return user;
  }

  async function current(userId: string): Promise<SettingsResponse> {
    const user = await requireUser(userId);
    const stored = await store.getProfile(userId);
    const savedNotifications = await store.getNotifications(userId);
    const quiet = await store.getQuietHours(userId);
    const pending = await store.getPendingEmail(userId);
    const now = clock();
    const pendingEmail =
      pending && pending.expiresAt.getTime() > now.getTime() ? pending.email : null;

    return {
      profile: {
        displayName: user.displayName,
        email: user.email,
        pendingEmail,
        avatarUrl: stored?.avatarUrl ?? null,
        uiLocale: stored?.uiLocale ?? user.uiLocale,
        nativeLanguages: stored?.nativeLanguages ?? [],
        cefrLevel: stored?.cefrLevel ?? null,
        goals: stored?.goals ?? [],
        city: stored?.city ?? null,
        timezone: stored?.timezone ?? "Europe/Berlin",
      },
      notifications: savedNotifications ?? defaultNotificationPreferences(),
      quietHours: quiet
        ? {
            enabled: quiet.enabled,
            start: minuteToClock(quiet.startMinute),
            end: minuteToClock(quiet.endMinute),
          }
        : { ...DEFAULT_QUIET_HOURS },
    };
  }

  return {
    get(userId) {
      return current(userId);
    },

    async updateProfile(userId, body) {
      const snapshot = await current(userId);
      if (body.displayName !== undefined) {
        await users.updateDisplayName(userId, body.displayName);
      }
      if (!hasProfileField(body)) return current(userId);

      const city = resolveCity(snapshot.profile.city, body.cityId);
      await store.saveProfile({
        userId,
        uiLocale: body.uiLocale ?? snapshot.profile.uiLocale,
        nativeLanguages: body.nativeLanguages ?? snapshot.profile.nativeLanguages,
        cefrLevel: body.cefrLevel === undefined ? snapshot.profile.cefrLevel : body.cefrLevel,
        goals: body.goals ?? snapshot.profile.goals,
        city,
        timezone: body.timezone ?? snapshot.profile.timezone,
        avatarUrl: snapshot.profile.avatarUrl,
      });
      return current(userId);
    },

    async updateNotifications(userId, body) {
      await requireUser(userId);
      await store.saveNotifications(userId, body);
      return current(userId);
    },

    async updateQuietHours(userId, body) {
      await requireUser(userId);
      await store.saveQuietHours(userId, {
        enabled: body.enabled,
        startMinute: clockToMinute(body.start),
        endMinute: clockToMinute(body.end),
      });
      return current(userId);
    },

    async requestEmailChange(userId, body, locale) {
      const user = await requireUser(userId);
      await assertCurrentPassword(user, body.currentPassword);
      if (body.email === user.email) {
        throw new ValidationError({
          errors: [{ field: "email", code: "same_email", message: SETTINGS_COPY.sameEmail }],
        });
      }
      const existing = await users.findByEmail(body.email);
      if (existing && existing.id !== userId) {
        throw new ConflictError(SETTINGS_COPY.emailTaken, {
          errors: [{ field: "email", code: "email_taken", message: SETTINGS_COPY.emailTaken }],
        });
      }

      const allowed = await emailSends.consume(body.email, "email_change");
      if (!allowed) {
        throw new RateLimitedError("Too many confirmation emails. Try again later.");
      }

      const now = clock();
      const claimed = await store.setPendingEmail({
        userId,
        email: body.email,
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS),
      });
      if (claimed === "taken") {
        throw new ConflictError(SETTINGS_COPY.emailTaken, {
          errors: [{ field: "email", code: "email_taken", message: SETTINGS_COPY.emailTaken }],
        });
      }

      const token = emailCodec.create();
      await emailTokens.insert({
        userId,
        purpose: "email_change",
        tokenHash: emailCodec.hash(token),
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS),
        now,
      });
      const uiLocale = resolveLocale(locale, user.uiLocale);
      try {
        await emailQueue.enqueue({
          to: body.email,
          locale: uiLocale,
          template: "verify-email",
          url: buildConfirmLink(webPublicUrl, uiLocale, token),
        });
      } catch (error) {
        logger.error("email change enqueue failed", {
          reason: error instanceof Error ? error.name : "Error",
        });
        throw new ExternalServiceError("The confirmation email could not be queued.");
      }

      return { status: "pending", message: SETTINGS_COPY.emailPending };
    },

    async confirmEmailChange(token) {
      const now = clock();
      const tokenHash = emailCodec.hash(token);
      const preview = await emailTokens.peek({
        tokenHash,
        now,
        purpose: "email_change",
      });
      if (preview.status === "used") throw emailTokenUsed();
      if (preview.status === "expired") throw emailTokenExpired();
      if (preview.status === "invalid") throw emailTokenInvalid();

      const pending = await store.getPendingEmail(preview.userId);
      if (!pending || pending.expiresAt.getTime() <= now.getTime()) {
        throw emailTokenExpired();
      }

      const result = await users.changeEmail(preview.userId, pending.email, now);
      if (result === "taken") throw new ConflictError(SETTINGS_COPY.emailTaken);
      if (result === "missing") throw new UnauthorizedError();

      await emailTokens.consume({ tokenHash, now, purpose: "email_change" });
      await store.clearPendingEmail(preview.userId);
      return { status: "confirmed", message: SETTINGS_COPY.emailConfirmed };
    },

    async changePassword(userId, familyId, body) {
      const user = await requireUser(userId);
      await assertCurrentPassword(user, body.currentPassword);
      if (isCommonPassword(body.password)) {
        throw new ValidationError({
          errors: [
            {
              field: "password",
              code: "password_too_common",
              message: AUTH_COPY.passwordTooCommon,
            },
          ],
        });
      }
      await users.updatePassword(userId, await hasher.hash(body.password));
      await sessions.revokeOtherSessions({
        userId,
        keepFamilyId: familyId,
        reason: "password_change",
        now: clock(),
      });
      return { status: "updated", message: SETTINGS_COPY.passwordUpdated };
    },

    async acceptAvatar(userId, bytes) {
      await requireUser(userId);
      if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES || !isAvatarImage(bytes)) {
        throw invalidAvatar();
      }
      const sourceKey = `private/avatars/${userId}/${randomUUID()}`;
      await storage.put({
        key: sourceKey,
        body: bytes,
        contentType: "application/octet-stream",
        cacheControl: "private, no-store",
      });
      const job: AvatarJob = { userId, sourceKey };
      try {
        await avatars.enqueue(job);
      } catch (error) {
        await storage.delete(sourceKey);
        logger.error("avatar enqueue failed", {
          reason: error instanceof Error ? error.name : "Error",
        });
        throw new ExternalServiceError("The photo could not be stored.");
      }
      return { status: "accepted", message: SETTINGS_COPY.avatarAccepted };
    },
  };

  async function assertCurrentPassword(
    user: { passwordHash: string | null },
    currentPassword: string,
  ): Promise<void> {
    if (!user.passwordHash) {
      throw new ValidationError({
        errors: [
          {
            field: "currentPassword",
            code: "password_required",
            message: SETTINGS_COPY.passwordRequired,
          },
        ],
      });
    }
    const matches = await hasher.verify(user.passwordHash, currentPassword);
    if (!matches) {
      throw new ValidationError({
        errors: [
          {
            field: "currentPassword",
            code: "invalid_password",
            message: SETTINGS_COPY.invalidPassword,
          },
        ],
      });
    }
  }
}

function hasProfileField(body: UpdateProfileBody): boolean {
  return (
    body.uiLocale !== undefined ||
    body.nativeLanguages !== undefined ||
    body.cefrLevel !== undefined ||
    body.goals !== undefined ||
    body.cityId !== undefined ||
    body.timezone !== undefined
  );
}

function resolveCity(
  current: CityPoint | null,
  cityId: string | null | undefined,
): CityPoint | null {
  if (cityId === undefined) return current;
  if (cityId === null) return null;
  const city = findCity(cityId);
  if (!city) {
    throw new ValidationError({
      errors: [{ field: "cityId", code: "unknown_city", message: SETTINGS_COPY.unknownCity }],
    });
  }
  return toCityPoint(city);
}

function resolveLocale(requested: string | undefined, fallback: UiLocale): UiLocale {
  if (requested && isUiLocale(requested)) return requested;
  return fallback;
}

function buildConfirmLink(origin: string, locale: UiLocale, token: string): string {
  const url = new URL(`${origin.replace(/\/$/, "")}/${locale}/confirm-email`);
  url.searchParams.set("token", token);
  return url.toString();
}
