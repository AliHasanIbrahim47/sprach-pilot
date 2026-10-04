import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/session-gate";

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  const nextParam = (await searchParams).next;
  const nextPath = safeNextPath(Array.isArray(nextParam) ? nextParam[0] : nextParam);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("signInTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("signInBody")}</p>
      </div>
      <LoginForm nextPath={nextPath} />
    </div>
  );
}
