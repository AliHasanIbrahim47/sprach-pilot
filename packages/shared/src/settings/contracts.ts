import { z } from "zod";

import { uiLocaleSchema } from "../locale.js";
import {
  cityPointSchema,
  learningGoalSchema,
  MAX_NATIVE_LANGUAGES,
  nativeLanguageSchema,
  PLACEMENT_LEVELS,
} from "../onboarding/contracts.js";

/** Channels a learner can turn on or off. Push delivery itself is SP-056. */
export const NOTIFICATION_CHANNELS = ["email", "push"] as const;

/**
 * Product news is marketing and stays off until the learner opts in.
 * The other categories are on so reminders work before anyone opens settings.
 */
export const NOTIFICATION_CATEGORIES = [
  "review_reminders",
  "event_reminders",
  "match_requests",
  "product_news",
] as const;

export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS).meta({
  id: "NotificationChannel",
});

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES).meta({
  id: "NotificationCategory",
});

const categoryPreferencesSchema = z.object({
  review_reminders: z.boolean(),
  event_reminders: z.boolean(),
  match_requests: z.boolean(),
  product_news: z.boolean(),
});

export const notificationPreferencesSchema = z
  .object({
    email: categoryPreferencesSchema,
    push: categoryPreferencesSchema,
  })
  .meta({
    id: "NotificationPreferences",
    description: "Per-channel switches. Product news is off until the learner opts in.",
  });

export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .meta({ description: "Local time HH:MM in the profile timezone", example: "22:00" });

export const quietHoursSchema = z
  .object({
    enabled: z.boolean(),
    start: clockTimeSchema,
    end: clockTimeSchema,
  })
  .refine((value) => value.start !== value.end, {
    path: ["end"],
    message: "Choose an end time that differs from the start.",
  })
  .meta({
    id: "QuietHours",
    description: "Local window in which non-critical notifications are held.",
  });

export const DEFAULT_QUIET_HOURS = {
  enabled: false,
  start: "22:00",
  end: "07:00",
} as const;

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, { message: "Choose a valid timezone." });

export const settingsProfileSchema = z
  .object({
    displayName: z.string().min(1).max(100),
    email: z.string().email(),
    pendingEmail: z.string().email().nullable(),
    avatarUrl: z.string().url().nullable(),
    uiLocale: uiLocaleSchema,
    nativeLanguages: z.array(nativeLanguageSchema).max(MAX_NATIVE_LANGUAGES),
    cefrLevel: z.enum(PLACEMENT_LEVELS).nullable(),
    goals: z.array(learningGoalSchema).max(6),
    city: cityPointSchema.nullable(),
    timezone: z.string().min(1).max(64),
  })
  .meta({ id: "SettingsProfile" });

export const settingsResponseSchema = z
  .object({
    profile: settingsProfileSchema,
    notifications: notificationPreferencesSchema,
    quietHours: quietHoursSchema,
  })
  .meta({ id: "SettingsResponse" });

export const updateProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    uiLocale: uiLocaleSchema.optional(),
    nativeLanguages: z.array(nativeLanguageSchema).min(1).max(MAX_NATIVE_LANGUAGES).optional(),
    cefrLevel: z.enum(PLACEMENT_LEVELS).nullable().optional(),
    goals: z.array(learningGoalSchema).min(1).max(6).optional(),
    cityId: z.string().trim().min(1).max(64).nullable().optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Choose a field to update.",
  })
  .meta({ id: "UpdateProfileBody" });

export const emailChangeBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    email: z.string().trim().toLowerCase().email().max(320),
  })
  .meta({ id: "EmailChangeBody" });

export const emailChangeConfirmBodySchema = z
  .object({
    token: z.string().min(32).max(256),
  })
  .meta({ id: "EmailChangeConfirmBody" });

export const passwordChangeBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    password: z.string().min(10).max(128),
  })
  .meta({ id: "PasswordChangeBody" });

export const emailChangeAcceptedSchema = z
  .object({
    status: z.literal("pending"),
    message: z.string().max(500),
  })
  .meta({ id: "EmailChangeAccepted" });

export const emailChangeConfirmedSchema = z
  .object({
    status: z.literal("confirmed"),
    message: z.string().max(500),
  })
  .meta({ id: "EmailChangeConfirmed" });

export const passwordChangeResponseSchema = z
  .object({
    status: z.literal("updated"),
    message: z.string().max(500),
  })
  .meta({ id: "PasswordChangeResponse" });

export const avatarAcceptedSchema = z
  .object({
    status: z.literal("accepted"),
    message: z.string().max(500),
  })
  .meta({ id: "AvatarAccepted" });

export const SETTINGS_COPY = {
  emailPending:
    "Check the new address to confirm this change. Sign-in still uses your current email.",
  emailConfirmed: "Your email address is updated.",
  passwordUpdated: "Your password is updated. Other devices have been signed out.",
  emailTaken: "That email is already in use.",
  sameEmail: "That is already your email address.",
  passwordRequired: "Set a password before changing this.",
  invalidPassword: "Current password is incorrect",
  avatarRejected: "Upload a JPEG, PNG, WEBP, or GIF image of 5 MB or less.",
  avatarAccepted: "Your photo is being prepared.",
  unknownCity: "Choose a city from the list.",
} as const;

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type QuietHours = z.infer<typeof quietHoursSchema>;
export type SettingsProfile = z.infer<typeof settingsProfileSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type EmailChangeBody = z.infer<typeof emailChangeBodySchema>;
export type EmailChangeConfirmBody = z.infer<typeof emailChangeConfirmBodySchema>;
export type PasswordChangeBody = z.infer<typeof passwordChangeBodySchema>;

/**
 * Product news starts off. Review, event, and match notices start on.
 */
export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    email: {
      review_reminders: true,
      event_reminders: true,
      match_requests: true,
      product_news: false,
    },
    push: {
      review_reminders: true,
      event_reminders: true,
      match_requests: true,
      product_news: false,
    },
  };
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
