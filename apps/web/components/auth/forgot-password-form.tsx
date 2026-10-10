"use client";

import { passwordForgotBodySchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { fieldMessage } from "@/components/auth/field-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/lib/auth-actions";
import { type AuthFieldErrors, zodIssuesToFieldErrors } from "@/lib/auth-field-errors";

export function ForgotPasswordForm(): React.JSX.Element {
  const t = useTranslations("Auth");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [summary, setSummary] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSummary("");
    setIsSuccess(false);

    const form = event.currentTarget;
    const parsed = passwordForgotBodySchema.safeParse({
      email: new FormData(form).get("email"),
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error.issues));
      setSummary(t("invalidField"));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setSummary(t("genericError"));
        return;
      }
      setIsSuccess(true);
      setSummary(t("passwordResetAccepted"));
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  }

  const emailError = fieldErrors.email ? fieldMessage(fieldErrors.email, t) : undefined;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <p aria-live="polite" className={isSuccess ? "text-sm" : "text-destructive text-sm"}>
        {summary}
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">{t("email")}</Label>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          {...(emailError
            ? { "aria-invalid": true as const, "aria-describedby": "forgot-email-error" }
            : {})}
        />
        {emailError ? (
          <p id="forgot-email-error" className="text-destructive text-xs">
            {emailError}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("submitting") : t("forgotPasswordSubmit")}
      </Button>
      <p className="text-muted-foreground text-sm">
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          {t("goToSignIn")}
        </Link>
      </p>
    </form>
  );
}
