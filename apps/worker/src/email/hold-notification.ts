import { prisma } from "@sprachpilot/db";
import {
  clockToMinute,
  DEFAULT_QUIET_HOURS,
  defaultNotificationPreferences,
  type NotificationCategory,
  notificationIsAllowed,
} from "@sprachpilot/shared";

const DEFAULT_TIME_ZONE = "Europe/Berlin";

/**
 * True when this email notice should leave the worker.
 * Quiet hours, the saved switch, and product-email consent are read at send time.
 */
export async function emailNotificationAllowed(
  input: { userId: string; category: NotificationCategory },
  now = new Date(),
): Promise<boolean> {
  const [profile, quietHours, preference, consents] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: input.userId },
      select: { timezone: true },
    }),
    prisma.quietHours.findUnique({ where: { userId: input.userId } }),
    prisma.notificationPreference.findUnique({
      where: {
        userId_channel_category: {
          userId: input.userId,
          channel: "email",
          category: input.category,
        },
      },
    }),
    prisma.consentRecord.findMany({
      where: { userId: input.userId, policy: "product_emails" },
      orderBy: { acceptedAt: "asc" },
      select: { decision: true },
    }),
  ]);
  const enabled = preference?.enabled ?? defaultNotificationPreferences().email[input.category];
  const productEmailsGranted = consents.at(-1)?.decision === "granted";
  return notificationIsAllowed({
    category: input.category,
    enabled,
    productEmailsGranted,
    quietHours: quietHours
      ? {
          enabled: quietHours.enabled,
          startMinute: quietHours.startMinute,
          endMinute: quietHours.endMinute,
        }
      : {
          enabled: DEFAULT_QUIET_HOURS.enabled,
          startMinute: clockToMinute(DEFAULT_QUIET_HOURS.start),
          endMinute: clockToMinute(DEFAULT_QUIET_HOURS.end),
        },
    timeZone: profile?.timezone ?? DEFAULT_TIME_ZONE,
    now,
  });
}
