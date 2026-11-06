import "server-only";

import type { OnboardingResponse, QuizList } from "@sprachpilot/shared";

import { apiFetch } from "./api-client";

export async function getOnboarding(): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>("/v1/onboarding");
}

export async function getPlacementQuiz(): Promise<QuizList> {
  return apiFetch<QuizList>("/v1/onboarding/quiz");
}
