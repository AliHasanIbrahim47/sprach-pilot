import { getTranslations, setRequestLocale } from "next-intl/server";

import { GoogleContinueButton } from "@/components/auth/google-continue-button";
import { RegisterForm } from "@/components/auth/register-form";

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
}

export default async function RegisterPage({
  params,
}: RegisterPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("registerTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("registerBody")}</p>
      </div>
      <RegisterForm />
      <GoogleContinueButton returnTo="/onboarding" />
    </div>
  );
}
