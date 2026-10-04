import { getTranslations, setRequestLocale } from "next-intl/server";

interface DecksPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DecksPage({ params }: DecksPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("App");

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-3xl tracking-tight">{t("decksTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("decksBody")}</p>
    </div>
  );
}
