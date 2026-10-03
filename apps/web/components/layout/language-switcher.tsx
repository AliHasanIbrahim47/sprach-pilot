"use client";

import { useLocale, useTranslations } from "next-intl";

import { type AppLocale, localeNames, locales } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher(): React.JSX.Element {
  const t = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <span className="sr-only">{t("switchLanguage")}</span>
      <select
        className="border-input bg-background focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
        aria-label={t("language")}
        value={locale}
        name="language"
        onChange={(event) => {
          const next = event.target.value as AppLocale;
          router.replace(pathname, { locale: next });
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
