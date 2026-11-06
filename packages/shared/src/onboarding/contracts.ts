import { z } from "zod";

import { uiLocaleSchema } from "../locale.js";

/** Self-assessment and placement stop at C1. C2 stays in the database enum for later content. */
export const PLACEMENT_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

export const LEARNING_GOALS = [
  "work",
  "bureaucracy",
  "health",
  "housing",
  "social",
  "exam",
] as const;

export const ONBOARDING_STEPS = ["languages", "level", "quiz", "goals", "city"] as const;

/** Most native languages one profile can store. */
export const MAX_NATIVE_LANGUAGES = 5;

export const NATIVE_LANGUAGE_CODES = [
  "en",
  "de",
  "ar",
  "tr",
  "uk",
  "ru",
  "pl",
  "fa",
  "es",
  "fr",
  "it",
  "ku",
] as const;

export const placementLevelSchema = z.enum(PLACEMENT_LEVELS).meta({
  id: "PlacementLevel",
  description: "CEFR level the learner can choose during onboarding (A1–C1).",
});

/** A level the learner has not chosen yet. Kept separate so PlacementLevel stays non-null. */
const nullablePlacementLevelSchema = z.enum(PLACEMENT_LEVELS).nullable();

export const learningGoalSchema = z.enum(LEARNING_GOALS).meta({ id: "LearningGoal" });

export const onboardingStepSchema = z.enum(ONBOARDING_STEPS).meta({ id: "OnboardingStep" });

export const nativeLanguageSchema = z.enum(NATIVE_LANGUAGE_CODES).meta({ id: "NativeLanguage" });

export const onboardingStatusSchema = z
  .enum(["pending", "completed", "skipped"])
  .meta({ id: "OnboardingStatus" });

export const cityPointSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(80),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
  })
  .meta({
    id: "CityPoint",
    description: "City id and approximate centroid. Not a street address or postal code.",
  });

export const scenarioSchema = z
  .object({
    id: z.string().min(1).max(64),
    level: placementLevelSchema,
    goals: z.array(learningGoalSchema).min(1).max(6),
    title: z.string().min(1).max(120),
  })
  .meta({ id: "Scenario" });

export const onboardingResponseSchema = z
  .object({
    status: onboardingStatusSchema,
    step: onboardingStepSchema,
    uiLocale: uiLocaleSchema,
    nativeLanguages: z.array(nativeLanguageSchema).max(MAX_NATIVE_LANGUAGES),
    cefrLevel: nullablePlacementLevelSchema,
    goals: z.array(learningGoalSchema).max(6),
    city: cityPointSchema.nullable(),
    needsCity: z.boolean(),
    recommendations: z.array(scenarioSchema).max(3),
  })
  .meta({ id: "OnboardingResponse" });

export const languagesStepSchema = z.object({
  step: z.literal("languages"),
  uiLocale: uiLocaleSchema,
  nativeLanguages: z.array(nativeLanguageSchema).min(1).max(MAX_NATIVE_LANGUAGES),
});

export const levelStepSchema = z.object({
  step: z.literal("level"),
  cefrLevel: placementLevelSchema,
});

export const quizStepSchema = z.object({
  step: z.literal("quiz"),
  skipped: z.boolean(),
  cefrLevel: nullablePlacementLevelSchema,
});

export const goalsStepSchema = z.object({
  step: z.literal("goals"),
  goals: z.array(learningGoalSchema).min(1).max(6),
});

export const cityStepSchema = z.object({
  step: z.literal("city"),
  skipped: z.boolean(),
  cityId: z.string().trim().min(1).max(64).nullable(),
});

export const onboardingStepBodySchema = z
  .discriminatedUnion("step", [
    languagesStepSchema,
    levelStepSchema,
    quizStepSchema,
    goalsStepSchema,
    cityStepSchema,
  ])
  .meta({ id: "OnboardingStepBody" });

export const quizChoiceSchema = z.object({
  id: z.string().min(1).max(8),
  text: z.string().min(1).max(240),
});

export const quizItemSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(["reading", "listening"]),
    level: placementLevelSchema,
    prompt: z.string().min(1).max(400),
    passage: z.string().min(1).max(600).nullable(),
    transcript: z.string().min(1).max(600).nullable(),
    choices: z.array(quizChoiceSchema).min(2).max(4),
  })
  .meta({ id: "QuizItem" });

export const quizListSchema = z
  .object({
    items: z.array(quizItemSchema).length(10),
  })
  .meta({ id: "QuizList" });

export const quizSubmissionSchema = z
  .object({
    answers: z
      .array(
        z.object({
          itemId: z.string().min(1).max(64),
          choiceId: z.string().min(1).max(8),
        }),
      )
      .length(10),
  })
  .meta({ id: "QuizSubmission" });

export const quizResultSchema = z
  .object({
    suggestedLevel: placementLevelSchema,
    correctCount: z.number().int().nonnegative(),
    itemCount: z.number().int().positive(),
  })
  .meta({ id: "QuizResult" });

export const citySearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(40),
  })
  .meta({ id: "CitySearchQuery" });

export const citySuggestionSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(80),
    matchedPostalCode: z.string().regex(/^\d{5}$/),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
  })
  .meta({
    id: "CitySuggestion",
    description: "Autocomplete hit. Saving a city stores the id and centroid only.",
  });

export const citySearchResponseSchema = z
  .object({
    cities: z.array(citySuggestionSchema).max(8),
  })
  .meta({ id: "CitySearchResponse" });

export type PlacementLevel = z.infer<typeof placementLevelSchema>;
export type LearningGoal = z.infer<typeof learningGoalSchema>;
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;
export type NativeLanguage = z.infer<typeof nativeLanguageSchema>;
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
export type CityPoint = z.infer<typeof cityPointSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;
export type OnboardingStepBody = z.infer<typeof onboardingStepBodySchema>;
export type QuizItem = z.infer<typeof quizItemSchema>;
export type QuizList = z.infer<typeof quizListSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
export type QuizResult = z.infer<typeof quizResultSchema>;
export type CitySuggestion = z.infer<typeof citySuggestionSchema>;
export type CitySearchResponse = z.infer<typeof citySearchResponseSchema>;

/** True until the learner finishes the wizard or skips it. */
export function isOnboardingPending(input: {
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
}): boolean {
  return input.onboardingCompletedAt === null && input.onboardingSkippedAt === null;
}
