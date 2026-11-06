import {
  type CitySearchResponse,
  isOnboardingPending,
  ONBOARDING_STEPS,
  type OnboardingResponse,
  type OnboardingStep,
  type OnboardingStepBody,
  type QuizList,
  type QuizResult,
  type QuizSubmission,
  ValidationError,
} from "@sprachpilot/shared";

import { findCity, searchCities, toCityPoint } from "./cities.js";
import type { OnboardingMetrics } from "./metrics.js";
import type { OnboardingProfile, OnboardingRepository } from "./onboarding.repository.js";
import { suggestCefrLevel } from "./placement.js";
import { QUIZ_ITEMS, toPublicQuizItem } from "./quiz.js";
import { recommendScenarios } from "./recommendations.js";

export interface OnboardingService {
  get(userId: string): Promise<OnboardingResponse>;
  save(userId: string, body: OnboardingStepBody): Promise<OnboardingResponse>;
  quiz(): QuizList;
  scoreQuiz(body: QuizSubmission): QuizResult;
  complete(userId: string): Promise<OnboardingResponse>;
  skip(userId: string): Promise<OnboardingResponse>;
  searchCities(query: string): CitySearchResponse;
}

export interface OnboardingServiceDependencies {
  profiles: OnboardingRepository;
  metrics: OnboardingMetrics;
  clock: () => Date;
}

export function createOnboardingService(
  dependencies: OnboardingServiceDependencies,
): OnboardingService {
  const { profiles, metrics, clock } = dependencies;
  const recordedSteps = new Set<string>();

  /**
   * Counts a step the first time this process sees it for the user.
   */
  function recordOnce(userId: string, step: OnboardingStep | "skipped"): void {
    const key = `${userId}:${step}`;
    if (recordedSteps.has(key)) return;
    recordedSteps.add(key);
    metrics.recordStep(step);
  }

  return {
    async get(userId) {
      return toResponse(await profiles.get(userId));
    },

    /**
     * Applies one wizard step and moves the resume pointer forward while onboarding is still open.
     */
    async save(userId, body) {
      const profile = await profiles.get(userId);
      const pending = isPending(profile);
      applyStep(profile, body);
      if (pending) {
        profile.step = advance(profile.step, body.step);
        recordOnce(userId, body.step);
      }
      await profiles.save(profile);
      return toResponse(profile);
    },

    quiz() {
      return { items: QUIZ_ITEMS.map(toPublicQuizItem) };
    },

    scoreQuiz(body) {
      return scorePlacement(body);
    },

    /**
     * Finishes onboarding once languages, a level, and a goal are stored, then returns recommendations.
     */
    async complete(userId) {
      const profile = await profiles.get(userId);
      const missing = missingRequirements(profile);
      if (missing.length > 0) {
        throw new ValidationError({
          detail: "Choose your languages, level, and at least one goal before finishing.",
          errors: missing.map((field) => ({
            field,
            code: "required",
            message: "Required to finish onboarding.",
          })),
        });
      }
      if (isPending(profile)) profile.completedAt = clock();
      await profiles.save(profile);
      return toResponse(profile);
    },

    /**
     * Closes the wizard without requiring the remaining answers.
     */
    async skip(userId) {
      const profile = await profiles.get(userId);
      if (isPending(profile)) {
        profile.skippedAt = clock();
        recordOnce(userId, "skipped");
      }
      await profiles.save(profile);
      return toResponse(profile);
    },

    searchCities(query) {
      return { cities: searchCities(query) };
    },
  };
}

/**
 * Writes one step. Skipping the quiz keeps the current level, and skipping the city clears it.
 */
function applyStep(profile: OnboardingProfile, body: OnboardingStepBody): void {
  switch (body.step) {
    case "languages":
      profile.uiLocale = body.uiLocale;
      profile.nativeLanguages = unique(body.nativeLanguages);
      return;
    case "level":
      profile.cefrLevel = body.cefrLevel;
      return;
    case "quiz":
      if (body.skipped) return;
      if (!body.cefrLevel) {
        throw new ValidationError({
          detail: "Choose a level or skip the quiz.",
          errors: [
            { field: "cefrLevel", code: "required", message: "Choose a level or skip the quiz." },
          ],
        });
      }
      profile.cefrLevel = body.cefrLevel;
      return;
    case "goals":
      profile.goals = unique(body.goals);
      return;
    case "city": {
      if (body.skipped) {
        profile.city = null;
        return;
      }
      if (!body.cityId) {
        throw new ValidationError({
          detail: "Choose a city or skip this step.",
          errors: [
            { field: "cityId", code: "required", message: "Choose a city or skip this step." },
          ],
        });
      }
      const city = findCity(body.cityId);
      if (!city) {
        throw new ValidationError({
          detail: "Choose a city from the list.",
          errors: [{ field: "cityId", code: "unknown", message: "Choose a city from the list." }],
        });
      }
      profile.city = toCityPoint(city);
      return;
    }
  }
}

/**
 * Grades the ten answers and suggests the highest band the learner passed.
 */
function scorePlacement(body: QuizSubmission): QuizResult {
  const choices = new Map<string, string>();
  for (const answer of body.answers) {
    if (choices.has(answer.itemId)) {
      throw new ValidationError({
        detail: "Answer each question once.",
        errors: [{ field: "answers", code: "duplicate", message: "Answer each question once." }],
      });
    }
    choices.set(answer.itemId, answer.choiceId);
  }

  /**
   * Grades one catalog item. An unknown question or choice is rejected.
   */
  function gradeAnswer(item: (typeof QUIZ_ITEMS)[number]): {
    level: (typeof item)["level"];
    correct: boolean;
  } {
    const choiceId = choices.get(item.id);
    if (!choiceId || !item.choices.some((choice) => choice.id === choiceId)) {
      throw new ValidationError({
        detail: "Answer every question.",
        errors: [{ field: "answers", code: "incomplete", message: "Answer every question." }],
      });
    }
    return { level: item.level, correct: choiceId === item.correctChoiceId };
  }

  const graded = QUIZ_ITEMS.map(gradeAnswer);

  return {
    suggestedLevel: suggestCefrLevel(graded),
    correctCount: graded.filter((answer) => answer.correct).length,
    itemCount: graded.length,
  };
}

/**
 * Moves the resume pointer to the step after the one just saved, and never backward.
 */
function advance(current: OnboardingStep, saved: OnboardingStep): OnboardingStep {
  const currentIndex = ONBOARDING_STEPS.indexOf(current);
  const savedIndex = ONBOARDING_STEPS.indexOf(saved);
  const nextIndex = Math.min(savedIndex + 1, ONBOARDING_STEPS.length - 1);
  return ONBOARDING_STEPS[Math.max(currentIndex, nextIndex)] ?? current;
}

/**
 * Lists the answers that must be stored before onboarding can finish.
 */
function missingRequirements(profile: OnboardingProfile): string[] {
  const missing: string[] = [];
  if (profile.nativeLanguages.length === 0) missing.push("nativeLanguages");
  if (!profile.cefrLevel) missing.push("cefrLevel");
  if (profile.goals.length === 0) missing.push("goals");
  return missing;
}

/**
 * Shapes the profile for the client. Recommendations appear only after completion, and only with a level.
 */
function toResponse(profile: OnboardingProfile): OnboardingResponse {
  const status = profile.completedAt ? "completed" : profile.skippedAt ? "skipped" : "pending";
  return {
    status,
    step: profile.step,
    uiLocale: profile.uiLocale,
    nativeLanguages: profile.nativeLanguages,
    cefrLevel: profile.cefrLevel,
    goals: profile.goals,
    city: profile.city,
    needsCity: profile.city === null,
    recommendations:
      status === "completed" && profile.cefrLevel
        ? recommendScenarios({ level: profile.cefrLevel, goals: profile.goals })
        : [],
  };
}

function isPending(profile: OnboardingProfile): boolean {
  return isOnboardingPending({
    onboardingCompletedAt: profile.completedAt,
    onboardingSkippedAt: profile.skippedAt,
  });
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
