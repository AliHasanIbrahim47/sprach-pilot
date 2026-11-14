import type { PrivacyOverview } from "@sprachpilot/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivacyPanel } from "@/components/settings/privacy-panel";

import en from "../messages/en.json";

afterEach(() => {
  cleanup();
});

const overview: PrivacyOverview = {
  consents: [
    {
      policy: "terms",
      version: "2026-10-03",
      decision: "granted",
      recordedAt: "2026-11-01T00:00:00.000Z",
    },
    {
      policy: "recording_storage",
      version: "2026-11-14",
      decision: "withdrawn",
      recordedAt: "1970-01-01T00:00:00.000Z",
    },
    {
      policy: "product_emails",
      version: "2026-11-14",
      decision: "withdrawn",
      recordedAt: "1970-01-01T00:00:00.000Z",
    },
    {
      policy: "analytics",
      version: "2026-11-14",
      decision: "withdrawn",
      recordedAt: "1970-01-01T00:00:00.000Z",
    },
  ],
  deletion: null,
  export: null,
};

describe("privacy settings", () => {
  it("requests an export and withdraws recording storage from the form", async () => {
    const onExport = vi.fn(async () => ({ ok: true }));
    const onDelete = vi.fn(async () => ({ ok: true }));
    const onConsent = vi.fn(async () => ({ ok: true }));
    const user = userEvent.setup();

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PrivacyPanel
          overview={overview}
          onExport={onExport}
          onDelete={onDelete}
          onConsent={onConsent}
        />
      </NextIntlClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Request my data" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        "We are preparing your archive. The download link arrives by email and expires after 7 days.",
      ),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("checkbox", { name: "Store voice recordings to improve the models" }),
    );
    expect(onConsent).toHaveBeenCalledWith({ policy: "recording_storage", granted: true });

    const confirm = screen.getByRole("checkbox", {
      name: "I understand my account will be deleted after 7 days",
    });
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeDisabled();
    await user.click(confirm);
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
