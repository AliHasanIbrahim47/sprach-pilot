"use client";

import { type QuietHours, quietHoursSchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { settingsStatusMessage } from "@/lib/settings-result";

interface QuietHoursFormProps {
  quietHours: QuietHours;
  onSave: (quietHours: QuietHours) => Promise<{ ok: boolean }>;
}

/**
 * Local window that holds review, event, match, and product notices.
 */
export function QuietHoursForm({ quietHours, onSave }: QuietHoursFormProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [enabled, setEnabled] = useState(quietHours.enabled);
  const [start, setStart] = useState(quietHours.start);
  const [end, setEnd] = useState(quietHours.end);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState(quietHours);
  const isDirty = enabled !== saved.enabled || start !== saved.start || end !== saved.end;

  async function persist(): Promise<boolean> {
    const parsed = quietHoursSchema.safeParse({ enabled, start, end });
    if (!parsed.success) {
      setSummary(t("invalidField"));
      return false;
    }
    setIsSaving(true);
    const result = await onSave(parsed.data);
    setIsSaving(false);
    setSummary(settingsStatusMessage(result, t("saved"), tErrors));
    if (result.ok) setSaved(parsed.data);
    return result.ok;
  }

  function discard(): void {
    setEnabled(saved.enabled);
    setStart(saved.start);
    setEnd(saved.end);
    setSummary("");
  }

  useUnsavedChanges("quiet-hours", { isDirty, save: persist, discard });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await persist();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <p className="text-muted-foreground text-sm">{t("quietHoursIntro")}</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {t("quietHoursEnabled")}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quiet-start">{t("quietStart")}</Label>
          <Input
            id="quiet-start"
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quiet-end">{t("quietEnd")}</Label>
          <Input
            id="quiet-end"
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            required
          />
        </div>
      </div>
      {summary ? (
        <p role="status" className="text-sm">
          {summary}
        </p>
      ) : null}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? t("saving") : t("saveQuietHours")}
      </Button>
    </form>
  );
}
