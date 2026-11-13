"use client";

import { emailChangeBodySchema, passwordChangeBodySchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { settingsStatusMessage } from "@/lib/settings-result";

interface AccountSettingsProps {
  email: string;
  pendingEmail: string | null;
  onChangeEmail: (input: { currentPassword: string; email: string }) => Promise<{ ok: boolean }>;
  onChangePassword: (input: {
    currentPassword: string;
    password: string;
  }) => Promise<{ ok: boolean }>;
}

/**
 * Email and password changes. Both ask for the current password.
 */
export function AccountSettings({
  email,
  pendingEmail,
  onChangeEmail,
  onChangePassword,
}: AccountSettingsProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const [emailSummary, setEmailSummary] = useState(
    pendingEmail ? t("emailPending", { email: pendingEmail }) : "",
  );
  const [passwordSummary, setPasswordSummary] = useState("");
  const [isEmailSaving, setIsEmailSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const emailDirty = newEmail.trim() !== "" || emailPassword !== "";
  const passwordDirty = currentPassword !== "" || nextPassword !== "";

  async function saveEmail(): Promise<boolean> {
    const parsed = emailChangeBodySchema.safeParse({
      currentPassword: emailPassword,
      email: newEmail,
    });
    if (!parsed.success) {
      setEmailSummary(t("invalidField"));
      return false;
    }
    setIsEmailSaving(true);
    const result = await onChangeEmail(parsed.data);
    setIsEmailSaving(false);
    setEmailSummary(
      settingsStatusMessage(result, t("emailPending", { email: parsed.data.email }), tErrors),
    );
    if (result.ok) {
      setNewEmail("");
      setEmailPassword("");
    }
    return result.ok;
  }

  async function savePassword(): Promise<boolean> {
    const parsed = passwordChangeBodySchema.safeParse({
      currentPassword,
      password: nextPassword,
    });
    if (!parsed.success) {
      setPasswordSummary(t("invalidField"));
      return false;
    }
    setIsPasswordSaving(true);
    const result = await onChangePassword(parsed.data);
    setIsPasswordSaving(false);
    setPasswordSummary(settingsStatusMessage(result, t("passwordUpdated"), tErrors));
    if (result.ok) {
      setCurrentPassword("");
      setNextPassword("");
    }
    return result.ok;
  }

  function discard(): void {
    setNewEmail("");
    setEmailPassword("");
    setCurrentPassword("");
    setNextPassword("");
    setEmailSummary(pendingEmail ? t("emailPending", { email: pendingEmail }) : "");
    setPasswordSummary("");
  }

  useUnsavedChanges("account", {
    isDirty: emailDirty || passwordDirty,
    async save() {
      const emailSaved = emailDirty ? await saveEmail() : true;
      const passwordSaved = passwordDirty ? await savePassword() : true;
      return emailSaved && passwordSaved;
    },
    discard,
  });

  async function handleEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await saveEmail();
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await savePassword();
  }

  return (
    <div className="flex flex-col gap-8">
      <form className="flex flex-col gap-3" onSubmit={(event) => void handleEmail(event)}>
        <p className="text-sm">
          {t("currentEmail")} <span className="font-medium">{email}</span>
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-email">{t("newEmail")}</Label>
          <Input
            id="new-email"
            name="email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            required
          />
        </div>
        <PasswordField
          name="currentPassword"
          label={t("currentPassword")}
          autoComplete="current-password"
          showLabel={tAuth("showPassword")}
          hideLabel={tAuth("hidePassword")}
          error={undefined}
          value={emailPassword}
          onChange={setEmailPassword}
        />
        {emailSummary ? (
          <p role="status" className="text-sm">
            {emailSummary}
          </p>
        ) : null}
        <Button type="submit" disabled={isEmailSaving}>
          {isEmailSaving ? t("saving") : t("changeEmail")}
        </Button>
      </form>

      <form className="flex flex-col gap-3" onSubmit={(event) => void handlePassword(event)}>
        <PasswordField
          name="currentPassword"
          label={t("currentPassword")}
          autoComplete="current-password"
          showLabel={tAuth("showPassword")}
          hideLabel={tAuth("hidePassword")}
          error={undefined}
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <PasswordField
          name="password"
          label={t("newPassword")}
          autoComplete="new-password"
          showLabel={tAuth("showPassword")}
          hideLabel={tAuth("hidePassword")}
          error={undefined}
          value={nextPassword}
          onChange={setNextPassword}
        />
        {passwordSummary ? (
          <p role="status" className="text-sm">
            {passwordSummary}
          </p>
        ) : null}
        <Button type="submit" disabled={isPasswordSaving}>
          {isPasswordSaving ? t("saving") : t("changePassword")}
        </Button>
      </form>
    </div>
  );
}
