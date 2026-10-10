"use client";

import { resendVerificationBodySchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { fieldMessage } from "@/components/auth/field-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendVerification } from "@/lib/auth-actions";
import { type AuthFieldErrors, zodIssuesToFieldErrors } from "@/lib/auth-field-errors";

interface ResendVerificationFormProps {
  mode: "account" | "email";
}

export function ResendVerificationForm({ mode }: ResendVerificationFormProps): React.JSX.Element {
  const t = useTranslations("Auth");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [summary, setSummary] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSummary("");
    setIsSuccess(false);

    const email = new FormData(event.currentTarget).get("email");
    const parsed = resendVerificationBodySchema.safeParse(mode === "email" ? { email } : {});
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error.issues));
      setSummary(t("invalidField"));
      return;
    }
    if (mode === "email" && !parsed.data.email) {
      setFieldErrors({ email: "email_invalid" });
      setSummary(t("invalidField"));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const emailAddress = parsed.data.email;
      const result = await resendVerification(
        mode === "email" && emailAddress ? { email: emailAddress } : {},
      );
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setSummary(t("genericError"));
        return;
      }
      setIsSuccess(true);
      setSummary(t("verificationSent"));
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
      {mode === "email" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resend-email">{t("email")}</Label>
          <Input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            {...(emailError
              ? { "aria-invalid": true as const, "aria-describedby": "resend-email-error" }
              : {})}
          />
          {emailError ? (
            <p id="resend-email-error" className="text-destructive text-xs">
              {emailError}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("submitting") : t("resendVerification")}
      </Button>
    </form>
  );
}
