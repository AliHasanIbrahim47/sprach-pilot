import { getTranslations, setRequestLocale } from "next-intl/server";

import { LinkGoogleForm } from "@/components/auth/link-google-form";
import { Link } from "@/i18n/navigation";

interface LinkGooglePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[]; email?: string | string[] }>;
}

export default async function LinkGooglePage({
  params,
  searchParams,
}: LinkGooglePageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  const query = await searchParams;
  const tokenParam = query.token;
  const emailParam = query.email;
  const linkToken = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  if (!linkToken || linkToken.length < 32) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl tracking-tight">{t("linkGoogleTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("oauthStateInvalid")}</p>
        </div>
        <p className="text-sm">
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            {t("goToSignIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("linkGoogleTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("linkGoogleIntro")}</p>
      </div>
      <LinkGoogleForm linkToken={linkToken} email={email ?? ""} />
    </div>
  );
}
