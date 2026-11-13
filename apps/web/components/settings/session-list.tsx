"use client";

import type { AuthSession } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { type SettingsActionResult, settingsStatusMessage } from "@/lib/settings-result";

interface SessionListProps {
  sessions: AuthSession[];
  onRevoke: (familyId: string) => Promise<SettingsActionResult>;
}

/**
 * Devices from the session list. The current device stays signed in.
 */
export function SessionList({ sessions, onRevoke }: SessionListProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [rows, setRows] = useState(sessions);
  const [error, setError] = useState("");

  async function handleRevoke(familyId: string): Promise<void> {
    setError("");
    const revoked = await onRevoke(familyId);
    if (!revoked.ok) {
      setError(settingsStatusMessage(revoked, "", tErrors));
      return;
    }
    setRows((current) => current.filter((session) => session.id !== familyId));
  }

  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{t("noSessions")}</p>;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((session) => {
        const device = session.userAgent ?? t("unknownDevice");
        return (
          <li
            key={session.id}
            className="border-border flex flex-col gap-2 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{device}</p>
              <p className="text-muted-foreground text-xs">
                {session.current ? t("thisDevice") : t("otherDevice")}
              </p>
            </div>
            {session.current ? null : (
              <Button
                type="button"
                variant="outline"
                aria-label={t("signOutDevice", { device })}
                onClick={() => void handleRevoke(session.id)}
              >
                {t("signOutDevice", { device })}
              </Button>
            )}
          </li>
        );
      })}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </ul>
  );
}
