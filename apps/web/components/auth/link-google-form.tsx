"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { fieldMessage } from "@/components/auth/field-message";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { linkGoogleAccount } from "@/lib/auth-actions";
import { type AuthFieldErrors } from "@/lib/auth-field-errors";

interface LinkGoogleFormProps {
  linkToken: string;
  email: string;
}

export function LinkGoogleForm({ linkToken, email }: LinkGoogleFormProps): React.JSX.Element {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [summary, setSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSummary("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    if (password.length === 0) {
      setFieldErrors({ password: "required" });
      setSummary(t("invalidField"));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const result = await linkGoogleAccount({ linkToken, password });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setSummary(summaryFor(result.code, t));
        return;
      }
      router.replace(result.needsOnboarding ? "/onboarding" : "/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordError = fieldErrors.password ? fieldMessage(fieldErrors.password, t) : undefined;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <p aria-live="polite" className="text-destructive text-sm">
        {summary}
      </p>

      <p className="text-muted-foreground text-sm">
        {email ? t("linkGoogleBody", { email }) : t("linkGoogleIntro")}
      </p>

      <PasswordField
        name="password"
        label={t("password")}
        autoComplete="current-password"
        showLabel={t("showPassword")}
        hideLabel={t("hidePassword")}
        error={passwordError}
      />

      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("submitting") : t("linkGoogleSubmit")}
      </Button>

      <p className="text-muted-foreground text-sm">
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          {t("goToSignIn")}
        </Link>
      </p>
    </form>
  );
}

function summaryFor(code: string, t: ReturnType<typeof useTranslations>): string {
  if (code === "unauthorized") return t("invalidCredentials");
  if (code === "validation") return t("invalidField");
  return t("genericError");
}
