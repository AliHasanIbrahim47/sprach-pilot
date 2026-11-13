import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "./contracts.js";

export interface QuietHoursWindow {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
}

/**
 * True when `now` falls inside the learner's local quiet window.
 * The end minute is exclusive, so 22:00–07:00 includes 22:00 and excludes 07:00.
 * A window that crosses midnight still matches the late and early hours.
 */
export function isWithinQuietHours(input: {
  now: Date;
  timeZone: string;
  startMinute: number;
  endMinute: number;
}): boolean {
  if (input.startMinute === input.endMinute) return false;
  const current = localMinutes(input.now, input.timeZone);
  if (input.startMinute < input.endMinute) {
    return current >= input.startMinute && current < input.endMinute;
  }
  return current >= input.startMinute || current < input.endMinute;
}

/**
 * Review, event, match, and product notices are non-critical.
 * Quiet hours hold every one of them. A switch that is off stays off.
 */
export function notificationIsAllowed(input: {
  category: NotificationCategory;
  enabled: boolean;
  quietHours: QuietHoursWindow;
  timeZone: string;
  now: Date;
}): boolean {
  if (!input.enabled) return false;
  if (!NOTIFICATION_CATEGORIES.includes(input.category)) return false;
  if (!input.quietHours.enabled) return true;
  return !isWithinQuietHours({
    now: input.now,
    timeZone: input.timeZone,
    startMinute: input.quietHours.startMinute,
    endMinute: input.quietHours.endMinute,
  });
}

export function clockToMinute(value: string): number {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour * 60 + minute;
}

export function minuteToClock(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}
