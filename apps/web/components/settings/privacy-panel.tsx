"use client";

import type { PrivacyOverview } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SettingsActionResult } from "@/lib/settings-result";
import { settingsStatusMessage } from "@/lib/settings-result";

type PrivacyResult = Pick<SettingsActionResult, "ok" | "errorKey">;

interface PrivacyPanelProps {
  overview: PrivacyOverview;
  onExport: () => Promise<PrivacyResult>;
  onDelete: () => Promise<PrivacyResult>;
  onConsent: (input: {
    policy: "recording_storage" | "product_emails" | "analytics";
    granted: boolean;
  }) => Promise<PrivacyResult>;
}

function isNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

const CONSENT_LABEL = {
  recording_storage: "consentRecording",
  product_emails: "consentProductEmails",
  analytics: "consentAnalytics",
} as const;

/**
 * Export, optional consents, and account deletion. Submits happen in the event handlers.
 */
export function PrivacyPanel({
  overview,
  onExport,
  onDelete,
  onConsent,
}: PrivacyPanelProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [summary, setSummary] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "granted" | "withdrawn">>(() =>
    Object.fromEntries(overview.consents.map((consent) => [consent.policy, consent.decision])),
  );
  const optional = overview.consents.filter((consent) => consent.policy in CONSENT_LABEL);

  async function handleExport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSummary("");
    setIsExporting(true);
    try {
      const result = await onExport();
      setSummary(settingsStatusMessage(result, t("exportQueued"), tErrors));
    } catch (error) {
      if (isNavigationError(error)) throw error;
      setSummary(tErrors("internal"));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!confirmed) return;
    setSummary("");
    setIsDeleting(true);
    try {
      const result = await onDelete();
      if (!result.ok) setSummary(settingsStatusMessage(result, "", tErrors));
    } catch (error) {
      if (isNavigationError(error)) throw error;
      setSummary(tErrors("internal"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleConsent(
    policy: "recording_storage" | "product_emails" | "analytics",
    granted: boolean,
  ): Promise<void> {
    setSummary("");
    const result = await onConsent({ policy, granted });
    if (result.ok) {
      const decision = granted ? "granted" : "withdrawn";
      setDecisions((current) => ({ ...current, [policy]: decision }));
    }
    const success =
      policy === "recording_storage" && !granted ? t("recordingWithdrawn") : t("consentSaved");
    setSummary(settingsStatusMessage(result, success, tErrors));
  }

  return (
    <div className="flex flex-col gap-8">
      <form className="flex flex-col gap-3" onSubmit={(event) => void handleExport(event)}>
        <h2 className="text-xl font-medium" id="export">
          {t("exportData")}
        </h2>
        <p className="text-sm">{t("exportBody")}</p>
        <Button type="submit" disabled={isExporting}>
          {isExporting ? t("saving") : t("requestExport")}
        </Button>
        {overview.export?.downloadUrl ? (
          <a className="text-sm underline" href={overview.export.downloadUrl}>
            {t("downloadExport")}
          </a>
        ) : null}
      </form>

      <section className="flex flex-col gap-3" aria-labelledby="consents">
        <h2 className="text-xl font-medium" id="consents">
          {t("consentsTitle")}
        </h2>
        {optional.map((consent) => {
          const policy = consent.policy as keyof typeof CONSENT_LABEL;
          const label = t(CONSENT_LABEL[policy]);
          return (
            <label key={consent.policy} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={consent.policy}
                checked={decisions[consent.policy] === "granted"}
                onChange={(event) => void handleConsent(policy, event.target.checked)}
              />
              {label}
            </label>
          );
        })}
      </section>

      <form className="flex flex-col gap-3" onSubmit={(event) => void handleDelete(event)}>
        <h2 className="text-xl font-medium text-red-500" id="delete">
          {t("deleteAccount")}
        </h2>
        <p className="text-sm">{t("deleteBody")}</p>
        {overview.deletion ? (
          <p className="text-sm">{t("deletionScheduled")}</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="confirmDeletion"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {t("deleteConfirmLabel")}
            </label>
            <Button
              type="submit"
              variant="outline"
              className="text-red-500"
              disabled={!confirmed || isDeleting}
            >
              {t("deleteAccount")}
            </Button>
          </>
        )}
      </form>
      {summary ? <p className="text-sm">{summary}</p> : null}
    </div>
  );
}
