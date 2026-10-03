import { getTranslations, setRequestLocale } from "next-intl/server";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SignInPage({ params }: SignInPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-3xl tracking-tight">{t("signInTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("signInBody")}</p>
    </div>
  );
}
