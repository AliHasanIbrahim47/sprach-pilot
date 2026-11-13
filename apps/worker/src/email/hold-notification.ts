import { prisma } from "@sprachpilot/db";
import {
  defaultNotificationPreferences,
  type NotificationCategory,
  notificationIsAllowed,
} from "@sprachpilot/shared";

const DEFAULT_QUIET = { enabled: false, startMinute: 22 * 60, endMinute: 7 * 60 };

/**
 * True when this email notice should leave the worker.
 * Quiet hours and the saved switch are read at send time.
 */
export async function emailNotificationAllowed(
  input: { userId: string; category: NotificationCategory },
  now = new Date(),
): Promise<boolean> {
  const [profile, quietHours, preference] = await Promise.all([
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
  ]);
  const enabled = preference?.enabled ?? defaultNotificationPreferences().email[input.category];
  return notificationIsAllowed({
    category: input.category,
    enabled,
    quietHours: quietHours
      ? {
          enabled: quietHours.enabled,
          startMinute: quietHours.startMinute,
          endMinute: quietHours.endMinute,
        }
      : DEFAULT_QUIET,
    timeZone: profile?.timezone ?? "Europe/Berlin",
    now,
  });
}
