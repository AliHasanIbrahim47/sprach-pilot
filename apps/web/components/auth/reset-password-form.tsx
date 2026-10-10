"use client";

import { passwordResetBodySchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { fieldMessage } from "@/components/auth/field-message";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { resetPassword } from "@/lib/auth-actions";
import { type AuthFieldErrors, zodIssuesToFieldErrors } from "@/lib/auth-field-errors";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps): React.JSX.Element {
  const t = useTranslations("Auth");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [summary, setSummary] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [needsNewLink, setNeedsNewLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSummary("");
    setIsSuccess(false);
    setNeedsNewLink(false);

    const parsed = passwordResetBodySchema.safeParse({
      token,
      password: new FormData(event.currentTarget).get("password"),
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error.issues));
      setSummary(t("invalidField"));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const result = await resetPassword(parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setNeedsNewLink(result.linkStatus !== undefined);
        setSummary(summaryFor(result, t));
        return;
      }
      setIsSuccess(true);
      setSummary(t("passwordResetComplete"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordError = fieldErrors.password ? fieldMessage(fieldErrors.password, t) : undefined;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <p aria-live="polite" className={isSuccess ? "text-sm" : "text-destructive text-sm"}>
        {summary}
      </p>
      {isSuccess ? (
        <Link href="/login" className="text-sm underline-offset-4 hover:underline">
          {t("goToSignIn")}
        </Link>
      ) : (
        <>
          <PasswordField
            name="password"
            label={t("password")}
            autoComplete="new-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            error={passwordError}
          />
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? t("submitting") : t("resetPasswordSubmit")}
          </Button>
        </>
      )}
      {needsNewLink ? (
        <Link href="/forgot-password" className="text-sm underline-offset-4 hover:underline">
          {t("resendVerification")}
        </Link>
      ) : null}
    </form>
  );
}

function summaryFor(
  result: { code: string; linkStatus?: "used" | "expired" | "invalid" },
  t: (
    key: "linkAlreadyUsed" | "linkExpired" | "linkInvalid" | "invalidField" | "genericError",
  ) => string,
): string {
  if (result.linkStatus === "used") return t("linkAlreadyUsed");
  if (result.linkStatus === "expired") return t("linkExpired");
  if (result.linkStatus === "invalid") return t("linkInvalid");
  if (result.code === "validation") return t("invalidField");
  return t("genericError");
}
