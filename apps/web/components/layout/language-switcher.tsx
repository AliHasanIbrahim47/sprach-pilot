"use client";

import { useLocale } from "next-intl";

import { LanguageSelect } from "@/components/language-select";
import { type AppLocale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher(): React.JSX.Element {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  function selectLocale(next: AppLocale): void {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  return <LanguageSelect value={locale} onChange={selectLocale} />;
}
