export const locales = ["en", "de", "ar", "uk", "tr"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const localeNames: Record<AppLocale, string> = {
  en: "English",
  de: "Deutsch",
  ar: "العربية",
  uk: "Українська",
  tr: "Türkçe",
};

export const rtlLocales = new Set<AppLocale>(["ar"]);

export const defaultTimeZone = "Europe/Berlin";

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

export function getLocaleDirection(locale: AppLocale): "ltr" | "rtl" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
