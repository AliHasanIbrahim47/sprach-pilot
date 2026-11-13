import { getTranslations, setRequestLocale } from "next-intl/server";

interface PrivacySettingsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Entry points for the GDPR export and deletion tools (SP-019).
 */
export default async function PrivacySettingsPage({
  params,
}: PrivacySettingsPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Settings");

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("privacyTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("privacyBody")}</p>
      </header>
      <section id="export" className="flex flex-col gap-2">
        <h2 className="text-xl font-medium">
          <a href="#export">{t("exportData")}</a>
        </h2>
        <p className="text-sm">{t("exportBody")}</p>
      </section>
      <section id="delete" className="flex flex-col gap-2">
        <h2 className="text-xl font-medium">
          <a href="#delete" className="text-red-500">
            {t("deleteAccount")}
          </a>
        </h2>
        <p className="text-sm">{t("deleteBody")}</p>
      </section>
    </div>
  );
}
