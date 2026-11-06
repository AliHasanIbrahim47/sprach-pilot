import { getTranslations, setRequestLocale } from "next-intl/server";

import { RecommendedScenarios } from "@/components/onboarding/recommended-scenarios";
import { Link, redirect } from "@/i18n/navigation";
import { getOnboarding } from "@/lib/onboarding";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Opens the wizard until it is finished or skipped, then shows recommendations only after completion.
 */
export default async function DashboardPage({
  params,
}: DashboardPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [tApp, tOnboarding, onboarding] = await Promise.all([
    getTranslations("App"),
    getTranslations("Onboarding"),
    getOnboarding(),
  ]);

  if (onboarding.status === "pending") redirect({ href: "/onboarding", locale });

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-3xl tracking-tight">{tApp("dashboardTitle")}</h1>
      <p className="text-muted-foreground text-sm">{tApp("dashboardBody")}</p>
      <RecommendedScenarios
        title={tOnboarding("recommendationsTitle")}
        scenarios={onboarding.recommendations}
      />
      <Link href="/app/cafe" className="text-sm font-medium underline-offset-4 hover:underline">
        {onboarding.needsCity ? tOnboarding("cafeNeedsCity") : tOnboarding("cafeTitle")}
      </Link>
    </div>
  );
}
