import { getTranslations, setRequestLocale } from "next-intl/server";

import { GoogleContinueButton } from "@/components/auth/google-continue-button";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/session-gate";

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[]; oauth?: string | string[] }>;
}

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  const paramsSearch = await searchParams;
  const nextParam = paramsSearch.next;
  const oauthParam = paramsSearch.oauth;
  const nextPath = safeNextPath(Array.isArray(nextParam) ? nextParam[0] : nextParam);
  const oauthError = Array.isArray(oauthParam) ? oauthParam[0] : oauthParam;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("signInTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("signInBody")}</p>
      </div>
      {oauthError ? (
        <p className="text-destructive text-sm" role="alert">
          {oauthMessage(oauthError, t)}
        </p>
      ) : null}
      <LoginForm nextPath={nextPath} />
      <GoogleContinueButton returnTo={nextPath} />
    </div>
  );
}

function oauthMessage(code: string, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (code === "unavailable") return t("oauthUnavailable");
  if (code === "disabled") return t("oauthDisabled");
  if (code === "failed") return t("oauthFailed");
  return t("oauthFailed");
}
