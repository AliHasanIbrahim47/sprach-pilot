import { setRequestLocale } from "next-intl/server";

import { CafeHome } from "@/components/onboarding/cafe-home";
import { redirect } from "@/i18n/navigation";
import { getOnboarding } from "@/lib/onboarding";
import { saveCity, searchCities } from "@/lib/onboarding-actions";

interface CafePageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Shows the café and asks for a city when onboarding did not store one. An open wizard redirects there first.
 */
export default async function CafePage({ params }: CafePageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const onboarding = await getOnboarding();
  if (onboarding.status === "pending") redirect({ href: "/onboarding", locale });

  return (
    <CafeHome
      needsCity={onboarding.needsCity}
      cityName={onboarding.city?.name ?? null}
      onSearch={searchCities}
      onSave={saveCity}
    />
  );
}
