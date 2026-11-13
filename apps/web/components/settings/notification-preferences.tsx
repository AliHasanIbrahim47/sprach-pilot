"use client";

import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
} from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { settingsStatusMessage } from "@/lib/settings-result";

interface NotificationPreferencesFormProps {
  preferences: NotificationPreferences;
  onSave: (preferences: NotificationPreferences) => Promise<{ ok: boolean }>;
}

const CATEGORY_LABEL = {
  review_reminders: "reviewReminders",
  event_reminders: "eventReminders",
  match_requests: "matchRequests",
  product_news: "productNews",
} as const;

/**
 * Channel and category switches. Each control's name includes both, and the checked state is the switch.
 */
export function NotificationPreferencesForm({
  preferences,
  onSave,
}: NotificationPreferencesFormProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [draft, setDraft] = useState(preferences);
  const [saved, setSaved] = useState(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const isDirty = !samePreferences(draft, saved);

  async function persist(): Promise<boolean> {
    setSummary("");
    setIsSaving(true);
    const result = await onSave(draft);
    setIsSaving(false);
    setSummary(settingsStatusMessage(result, t("saved"), tErrors));
    if (result.ok) setSaved(draft);
    return result.ok;
  }

  function discard(): void {
    setDraft(saved);
    setSummary("");
  }

  useUnsavedChanges("notifications", { isDirty, save: persist, discard });

  function toggle(channel: NotificationChannel, category: NotificationCategory): void {
    setDraft((current) => ({
      ...current,
      [channel]: { ...current[channel], [category]: !current[channel][category] },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await persist();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <p className="text-muted-foreground text-sm">{t("notificationsIntro")}</p>
      {NOTIFICATION_CHANNELS.map((channel) => (
        <fieldset key={channel} className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            {channel === "email" ? t("emailChannel") : t("pushChannel")}
          </legend>
          {NOTIFICATION_CATEGORIES.map((category) => {
            const name = `${channel === "email" ? t("emailChannel") : t("pushChannel")} ${t(CATEGORY_LABEL[category])}`;
            return (
              <label key={category} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft[channel][category]}
                  onChange={() => toggle(channel, category)}
                />
                {name}
              </label>
            );
          })}
        </fieldset>
      ))}
      {summary ? (
        <p role="status" className="text-sm">
          {summary}
        </p>
      ) : null}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? t("saving") : t("saveNotifications")}
      </Button>
    </form>
  );
}

function samePreferences(left: NotificationPreferences, right: NotificationPreferences): boolean {
  return NOTIFICATION_CHANNELS.every((channel) =>
    NOTIFICATION_CATEGORIES.every(
      (category) => left[channel][category] === right[channel][category],
    ),
  );
}
