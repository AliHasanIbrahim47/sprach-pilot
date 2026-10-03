"use client";

import { loginBodySchema } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { fieldMessage } from "@/components/auth/field-message";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { loginAccount } from "@/lib/auth-actions";
import { type AuthFieldErrors, zodIssuesToFieldErrors } from "@/lib/auth-field-errors";

export function LoginForm(): React.JSX.Element {
  const t = useTranslations("Auth");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [summary, setSummary] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSummary("");
    setIsSuccess(false);

    const formData = new FormData(event.currentTarget);
    const parsed = loginBodySchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error.issues));
      setSummary(t("invalidField"));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const result = await loginAccount(parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setSummary(summaryFor(result, t));
        return;
      }
      setIsSuccess(true);
      setSummary(t("loginSuccess"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const emailError = fieldErrors.email ? fieldMessage(fieldErrors.email, t) : undefined;
  const passwordError = fieldErrors.password ? fieldMessage(fieldErrors.password, t) : undefined;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <p aria-live="polite" className={isSuccess ? "text-sm" : "text-destructive text-sm"}>
        {summary}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">{t("email")}</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          {...(emailError
            ? { "aria-invalid": true as const, "aria-describedby": "login-email-error" }
            : {})}
        />
        {emailError ? (
          <p id="login-email-error" className="text-destructive text-xs">
            {emailError}
          </p>
        ) : null}
      </div>

      <PasswordField
        name="password"
        label={t("password")}
        autoComplete="current-password"
        showLabel={t("showPassword")}
        hideLabel={t("hidePassword")}
        error={passwordError}
      />

      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("submitting") : t("signInSubmit")}
      </Button>

      <p className="text-muted-foreground text-sm">
        {t("needAccount")}{" "}
        <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
          {t("goToRegister")}
        </Link>
      </p>
    </form>
  );
}

function summaryFor(
  result: { code: string; retryAfterSeconds?: number },
  t: ReturnType<typeof useTranslations>,
): string {
  if (result.code === "unauthorized") return t("invalidCredentials");
  if (result.code === "rate-limited") {
    return result.retryAfterSeconds === undefined
      ? t("tooManyAttemptsLater")
      : t("tooManyAttempts", { seconds: result.retryAfterSeconds });
  }
  if (result.code === "validation") return t("invalidField");
  return t("genericError");
}
