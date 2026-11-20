import { getTranslations, setRequestLocale } from "next-intl/server";

import { PrivacyPanel } from "@/components/settings/privacy-panel";
import { getPrivacy } from "@/lib/privacy";
import {
  requestAccountDeletion,
  requestPrivacyExport,
  updatePrivacyConsent,
} from "@/lib/privacy-actions";

interface PrivacySettingsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * GDPR export, optional consents, and account deletion (SP-019).
 */
export default async function PrivacySettingsPage({
  params,
}: PrivacySettingsPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Settings");
  const overview = await getPrivacy();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("privacyTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("privacyBody")}</p>
      </header>
      <PrivacyPanel
        overview={overview}
        onExport={requestPrivacyExport}
        onDelete={requestAccountDeletion}
        onConsent={updatePrivacyConsent}
      />
    </div>
  );
}
