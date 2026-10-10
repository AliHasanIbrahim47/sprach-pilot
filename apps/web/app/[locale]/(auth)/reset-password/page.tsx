import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: ResetPasswordPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  const tokenParam = (await searchParams).token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("resetPasswordTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("resetPasswordBody")}</p>
      </div>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-3">
          <p>{t("linkMissing")}</p>
          <Link href="/forgot-password" className="text-sm underline-offset-4 hover:underline">
            {t("resendVerification")}
          </Link>
        </div>
      )}
    </div>
  );
}
