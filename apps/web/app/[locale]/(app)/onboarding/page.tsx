import { setRequestLocale } from "next-intl/server";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { redirect } from "@/i18n/navigation";
import { getOnboarding, getPlacementQuiz } from "@/lib/onboarding";
import {
  completeOnboarding,
  saveOnboardingStep,
  scorePlacementQuiz,
  searchCities,
  skipOnboarding,
} from "@/lib/onboarding-actions";

interface OnboardingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({
  params,
}: OnboardingPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [onboarding, quiz] = await Promise.all([getOnboarding(), getPlacementQuiz()]);
  if (onboarding.status !== "pending") redirect({ href: "/dashboard", locale });

  return (
    <OnboardingWizard
      initial={onboarding}
      quizItems={quiz.items}
      onSave={saveOnboardingStep}
      onScoreQuiz={scorePlacementQuiz}
      onComplete={completeOnboarding}
      onSkip={skipOnboarding}
      onSearchCities={searchCities}
    />
  );
}
