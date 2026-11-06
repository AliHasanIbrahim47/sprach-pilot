"use server";

import type {
  CitySearchResponse,
  CitySuggestion,
  OnboardingResponse,
  OnboardingStepBody,
  QuizResult,
  QuizSubmission,
} from "@sprachpilot/shared";
import {
  citySearchQuerySchema,
  onboardingStepBodySchema,
  quizSubmissionSchema,
} from "@sprachpilot/shared";

import { apiFetch } from "./api-client";
import type { OnboardingActionResult } from "./onboarding-result";

export async function saveOnboardingStep(
  input: OnboardingStepBody,
): Promise<OnboardingActionResult<OnboardingResponse>> {
  const parsed = onboardingStepBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  try {
    const data = await apiFetch<OnboardingResponse>("/v1/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function scorePlacementQuiz(
  input: QuizSubmission,
): Promise<OnboardingActionResult<QuizResult>> {
  const parsed = quizSubmissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  try {
    const data = await apiFetch<QuizResult>("/v1/onboarding/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function completeOnboarding(): Promise<OnboardingActionResult<OnboardingResponse>> {
  try {
    const data = await apiFetch<OnboardingResponse>("/v1/onboarding/complete", { method: "POST" });
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function skipOnboarding(): Promise<OnboardingActionResult<OnboardingResponse>> {
  try {
    const data = await apiFetch<OnboardingResponse>("/v1/onboarding/skip", { method: "POST" });
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const parsed = citySearchQuerySchema.safeParse({ q: query });
  if (!parsed.success) return [];

  const data = await apiFetch<CitySearchResponse>(
    `/v1/cities?q=${encodeURIComponent(parsed.data.q)}`,
  );
  return data.cities;
}

export async function saveCity(cityId: string): Promise<boolean> {
  const result = await saveOnboardingStep({ step: "city", skipped: false, cityId });
  return result.ok;
}
