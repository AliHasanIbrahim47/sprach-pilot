import { UI_LOCALES } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { renderEmail } from "./render-email.js";

const VERIFY_URL = "http://localhost:3000/en/verify-email?token=abc";

describe("email templates", () => {
  it("renders every locale in html and plain text, including dark mode", async () => {
    for (const locale of UI_LOCALES) {
      const message = await renderEmail({
        to: "learner@example.com",
        locale,
        template: "verify-email",
        url: VERIFY_URL,
      });

      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.html).toContain(`lang="${locale}"`);
      expect(message.html).toContain('name="color-scheme" content="light dark"');
      expect(message.html).toContain("prefers-color-scheme: dark");
      expect(message.html).toContain(VERIFY_URL);
      expect(message.text).toContain(VERIFY_URL);
      expect(message.html).toContain(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"');
    }
  });

  it("keeps the English registration notice and reset copy readable without a password", async () => {
    const notice = await renderEmail({
      to: "learner@example.com",
      locale: "en",
      template: "registration-notice",
    });
    expect(notice.subject).toContain("register");
    expect(notice.text).toContain("No new account was created");
    expect(notice.html).toContain("prefers-color-scheme: dark");

    const reset = await renderEmail({
      to: "learner@example.com",
      locale: "en",
      template: "reset-password",
      url: "http://localhost:3000/en/reset-password?token=abc",
    });
    expect(reset.subject).toContain("password");
    expect(reset.text).toContain("one hour");
  });
});
