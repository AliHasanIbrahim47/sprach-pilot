import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "../globals.css";

import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { getLocaleDirection, isAppLocale, locales } from "@/i18n/config";
import { routing } from "@/i18n/routing";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: { default: string; template: string }; description: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Common" });
  const tMarketing = await getTranslations({ locale, namespace: "Marketing" });

  return {
    title: {
      default: t("appName"),
      template: `%s · ${t("appName")}`,
    },
    description: tMarketing("metaDescription"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<React.JSX.Element> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || !isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = getLocaleDirection(locale);

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <SkipToContent />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
