import { notificationIsAllowed } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

const quiet = { enabled: true, startMinute: 22 * 60, endMinute: 7 * 60 };

describe("quiet hours", () => {
  it("holds non-critical notices inside the learner's local window, including overnight", () => {
    expect(
      notificationIsAllowed({
        category: "review_reminders",
        enabled: true,
        productEmailsGranted: true,
        quietHours: quiet,
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T21:30:00.000Z"),
      }),
    ).toBe(false);
    expect(
      notificationIsAllowed({
        category: "review_reminders",
        enabled: true,
        productEmailsGranted: true,
        quietHours: quiet,
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T23:30:00.000Z"),
      }),
    ).toBe(false);
    expect(
      notificationIsAllowed({
        category: "review_reminders",
        enabled: true,
        productEmailsGranted: true,
        quietHours: quiet,
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T10:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      notificationIsAllowed({
        category: "review_reminders",
        enabled: true,
        productEmailsGranted: true,
        quietHours: quiet,
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-16T06:30:00.000Z"),
      }),
    ).toBe(true);
  });

  it("keeps product news off even outside quiet hours", () => {
    expect(
      notificationIsAllowed({
        category: "product_news",
        enabled: false,
        productEmailsGranted: true,
        quietHours: { enabled: false, startMinute: 22 * 60, endMinute: 7 * 60 },
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T10:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("holds product news when product-email consent is withdrawn", () => {
    expect(
      notificationIsAllowed({
        category: "product_news",
        enabled: true,
        productEmailsGranted: false,
        quietHours: { enabled: false, startMinute: 22 * 60, endMinute: 7 * 60 },
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T10:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("lets product news leave when consent is granted and quiet hours are off", () => {
    expect(
      notificationIsAllowed({
        category: "product_news",
        enabled: true,
        productEmailsGranted: true,
        quietHours: { enabled: false, startMinute: 22 * 60, endMinute: 7 * 60 },
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T10:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("lets a review reminder leave when product-email consent is withdrawn", () => {
    expect(
      notificationIsAllowed({
        category: "review_reminders",
        enabled: true,
        productEmailsGranted: false,
        quietHours: { enabled: false, startMinute: 22 * 60, endMinute: 7 * 60 },
        timeZone: "Europe/Berlin",
        now: new Date("2026-01-15T10:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
