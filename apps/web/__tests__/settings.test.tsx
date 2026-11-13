import { defaultNotificationPreferences } from "@sprachpilot/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { NotificationPreferencesForm } from "@/components/settings/notification-preferences";
import {
  clearRememberedSettingsStep,
  SettingsStepper,
} from "@/components/settings/settings-stepper";
import { UnsavedChangesProvider } from "@/components/unsaved-changes";

import en from "../messages/en.json";

afterEach(() => {
  clearRememberedSettingsStep();
  cleanup();
});

function renderWithMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UnsavedChangesProvider>{ui}</UnsavedChangesProvider>
    </NextIntlClientProvider>,
  );
}

describe("notification settings", () => {
  it("names each switch and starts with product news off and review reminders on", () => {
    renderWithMessages(
      <NotificationPreferencesForm
        preferences={defaultNotificationPreferences()}
        onSave={async () => ({ ok: true })}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Email product news" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Push product news" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Email review reminders" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Push review reminders" })).toBeChecked();
  });

  it("shows the mapped conflict message when a save is rejected", async () => {
    const user = userEvent.setup();
    renderWithMessages(
      <NotificationPreferencesForm
        preferences={defaultNotificationPreferences()}
        onSave={async () => ({ ok: false, errorKey: "Errors.conflict" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save notifications" }));
    expect(await screen.findByText("That conflicts with an existing record.")).toBeInTheDocument();
  });
});

describe("settings stepper", () => {
  it("shows one section at a time", async () => {
    const user = userEvent.setup();
    renderWithMessages(
      <SettingsStepper
        steps={[
          { id: "profile", title: "Profile", content: <p>Profile fields</p> },
          { id: "account", title: "Account", content: <p>Account fields</p> },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("asks to save or discard before leaving a step with unsaved changes", async () => {
    const user = userEvent.setup();
    let saves = 0;
    renderWithMessages(
      <SettingsStepper
        steps={[
          {
            id: "notifications",
            title: "Notifications",
            content: (
              <NotificationPreferencesForm
                preferences={defaultNotificationPreferences()}
                onSave={async () => {
                  saves += 1;
                  return { ok: true };
                }}
              />
            ),
          },
          { id: "quiet-hours", title: "Quiet hours", content: <p>Quiet fields</p> },
        ]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Email product news" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Quiet hours" })).toBeInTheDocument();
    expect(saves).toBe(0);

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("checkbox", { name: "Email product news" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("heading", { name: "Quiet hours" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(saves).toBe(1);
  });

  it("goes to the next step after save changes even when the save is rejected", async () => {
    const user = userEvent.setup();
    renderWithMessages(
      <SettingsStepper
        steps={[
          {
            id: "notifications",
            title: "Notifications",
            content: (
              <NotificationPreferencesForm
                preferences={defaultNotificationPreferences()}
                onSave={async () => ({ ok: false, errorKey: "Errors.conflict" })}
              />
            ),
          },
          { id: "quiet-hours", title: "Quiet hours", content: <p>Quiet fields</p> },
        ]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Email product news" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Quiet hours" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
