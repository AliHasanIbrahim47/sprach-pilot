import { getTranslations, setRequestLocale } from "next-intl/server";

interface OnboardingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({
  params,
}: OnboardingPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("App");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-10">
      <h1 className="font-display text-3xl tracking-tight">{t("onboardingTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("onboardingBody")}</p>
    </div>
  );
}
