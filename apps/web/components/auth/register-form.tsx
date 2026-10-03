"use client";

import { type RegisterBody, registerBodySchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { fieldMessage } from "@/components/auth/field-message";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { registerAccount } from "@/lib/auth-actions";
import { type AuthFieldErrors, zodIssuesToFieldErrors } from "@/lib/auth-field-errors";

export function RegisterForm(): React.JSX.Element {
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
    const formData = new FormData(form);
    const parsed = registerBodySchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
      acceptedTerms: formData.get("acceptedTerms") === "on",
    });

    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error.issues));
      setSummary(t("invalidField"));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const result = await registerAccount(parsed.data satisfies RegisterBody);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setSummary(summaryFor(result.code, t));
        return;
      }
      setIsSuccess(true);
      setSummary(t("verifyEmail"));
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  }

  const emailError = fieldErrors.email ? fieldMessage(fieldErrors.email, t) : undefined;
  const nameError = fieldErrors.displayName ? fieldMessage(fieldErrors.displayName, t) : undefined;
  const passwordError = fieldErrors.password ? fieldMessage(fieldErrors.password, t) : undefined;
  const consentError = fieldErrors.acceptedTerms
    ? fieldMessage(fieldErrors.acceptedTerms, t)
    : undefined;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <p aria-live="polite" className={isSuccess ? "text-sm" : "text-destructive text-sm"}>
        {summary}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">{t("email")}</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          {...(emailError
            ? { "aria-invalid": true as const, "aria-describedby": "register-email-error" }
            : {})}
        />
        {emailError ? (
          <p id="register-email-error" className="text-destructive text-xs">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-display-name">{t("displayName")}</Label>
        <Input
          id="register-display-name"
          name="displayName"
          type="text"
          autoComplete="nickname"
          {...(nameError
            ? { "aria-invalid": true as const, "aria-describedby": "register-name-error" }
            : {})}
        />
        {nameError ? (
          <p id="register-name-error" className="text-destructive text-xs">
            {nameError}
          </p>
        ) : null}
      </div>

      <PasswordField
        name="password"
        label={t("password")}
        autoComplete="new-password"
        showLabel={t("showPassword")}
        hideLabel={t("hidePassword")}
        error={passwordError}
      />

      <div className="flex flex-col gap-1.5">
        <Label className="flex items-start gap-2 font-normal">
          <input name="acceptedTerms" type="checkbox" className="mt-0.5 size-4" />
          <span>{t("acceptedTerms")}</span>
        </Label>
        {consentError ? <p className="text-destructive text-xs">{consentError}</p> : null}
      </div>

      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>

      <p className="text-muted-foreground text-sm">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          {t("goToSignIn")}
        </Link>
      </p>
    </form>
  );
}

function summaryFor(
  code: "validation" | "unauthorized" | "forbidden" | "rate-limited" | "internal",
  t: (key: "invalidField" | "registrationDisabled" | "genericError") => string,
): string {
  if (code === "forbidden") return t("registrationDisabled");
  if (code === "validation") return t("invalidField");
  return t("genericError");
}
