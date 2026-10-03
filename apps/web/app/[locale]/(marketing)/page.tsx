import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { locales } from "@/i18n/config";
import { Link } from "@/i18n/navigation";

interface LandingPageProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LandingPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Marketing" });
  const languages = Object.fromEntries(locales.map((code) => [code, `/${code}`])) as Record<
    string,
    string
  >;

  return {
    description: t("metaDescription"),
    alternates: {
      languages: {
        ...languages,
        "x-default": "/en",
      },
    },
  };
}

export default async function LandingPage({
  params,
}: LandingPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Marketing");
  const tCommon = await getTranslations("Common");
  const tLearning = await getTranslations("Learning");

  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_195)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.985_0.006_220)_0%,_oklch(0.96_0.02_210)_100%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.05_210)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.18_0.025_230)_0%,_oklch(0.16_0.03_220)_100%)]"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <p className="font-display text-primary text-4xl tracking-tight sm:text-5xl lg:text-6xl">
          {tCommon("appName")}
        </p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("headline")}
        </h1>
        <p className="text-muted-foreground max-w-xl text-base text-pretty sm:text-lg">
          {t("body")}
        </p>
        <figure className="border-border max-w-xl border-s-4 ps-4">
          <figcaption className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
            {t("sampleDialogueLabel")}
          </figcaption>
          <blockquote lang="de" className="text-foreground text-base">
            {tLearning("sampleDialogue")}
          </blockquote>
        </figure>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in">{t("getStarted")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">{t("openApp")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
