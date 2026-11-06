import { Prisma, prisma, type PrismaClient } from "@sprachpilot/db";
import {
  type CityPoint,
  isUiLocale,
  LEARNING_GOALS,
  type LearningGoal,
  NATIVE_LANGUAGE_CODES,
  type NativeLanguage,
  NotFoundError,
  ONBOARDING_STEPS,
  type OnboardingStep,
  PLACEMENT_LEVELS,
  type PlacementLevel,
  type UiLocale,
} from "@sprachpilot/shared";

export interface OnboardingProfile {
  userId: string;
  uiLocale: UiLocale;
  nativeLanguages: NativeLanguage[];
  cefrLevel: PlacementLevel | null;
  goals: LearningGoal[];
  city: CityPoint | null;
  step: OnboardingStep;
  completedAt: Date | null;
  skippedAt: Date | null;
}

export interface OnboardingRepository {
  get(userId: string): Promise<OnboardingProfile>;
  save(profile: OnboardingProfile): Promise<void>;
}

export function createOnboardingRepository(client: PrismaClient = prisma): OnboardingRepository {
  return {
    async get(userId) {
      const row = await client.profile.findUnique({ where: { userId } });
      if (row?.deletedAt) throw new NotFoundError("Profile not found");
      if (row) return fromRow(row);

      // Accounts created before profiles were required, or a failed nested write.
      try {
        const created = await client.profile.create({ data: { userId } });
        return fromRow(created);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await client.profile.findUnique({ where: { userId } });
          if (existing && !existing.deletedAt) return fromRow(existing);
        }
        throw error;
      }
    },

    async save(profile) {
      try {
        await client.profile.update({
          where: { userId: profile.userId },
          data: {
            uiLocale: profile.uiLocale,
            nativeLanguages: profile.nativeLanguages,
            cefrLevel: profile.cefrLevel,
            goals: profile.goals,
            cityId: profile.city?.id ?? null,
            cityName: profile.city?.name ?? null,
            cityLatitude: profile.city?.latitude ?? null,
            cityLongitude: profile.city?.longitude ?? null,
            onboardingStep: profile.step,
            onboardingCompletedAt: profile.completedAt,
            onboardingSkippedAt: profile.skippedAt,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          throw new NotFoundError("Profile not found");
        }
        throw error;
      }
    },
  };
}

export function createMemoryOnboardingRepository(): OnboardingRepository {
  const rows = new Map<string, OnboardingProfile>();

  return {
    async get(userId) {
      const existing = rows.get(userId);
      return existing ? cloneProfile(existing) : defaultProfile(userId);
    },

    async save(profile) {
      rows.set(profile.userId, cloneProfile(profile));
    },
  };
}

function defaultProfile(userId: string): OnboardingProfile {
  return {
    userId,
    uiLocale: "en",
    nativeLanguages: [],
    cefrLevel: null,
    goals: [],
    city: null,
    step: "languages",
    completedAt: null,
    skippedAt: null,
  };
}

function cloneProfile(profile: OnboardingProfile): OnboardingProfile {
  return {
    ...profile,
    nativeLanguages: [...profile.nativeLanguages],
    goals: [...profile.goals],
    city: profile.city ? { ...profile.city } : null,
    completedAt: profile.completedAt ? new Date(profile.completedAt) : null,
    skippedAt: profile.skippedAt ? new Date(profile.skippedAt) : null,
  };
}

function fromRow(row: {
  userId: string;
  uiLocale: string;
  nativeLanguages: string[];
  cefrLevel: string | null;
  goals: string[];
  cityId: string | null;
  cityName: string | null;
  cityLatitude: Prisma.Decimal | null;
  cityLongitude: Prisma.Decimal | null;
  onboardingStep: string;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
}): OnboardingProfile {
  return {
    userId: row.userId,
    uiLocale: isUiLocale(row.uiLocale) ? row.uiLocale : "en",
    nativeLanguages: row.nativeLanguages.filter(isNativeLanguage),
    cefrLevel: isPlacementLevel(row.cefrLevel) ? row.cefrLevel : null,
    goals: row.goals.filter(isLearningGoal),
    city: readCity(row),
    step: isOnboardingStep(row.onboardingStep) ? row.onboardingStep : "languages",
    completedAt: row.onboardingCompletedAt,
    skippedAt: row.onboardingSkippedAt,
  };
}

function readCity(row: {
  cityId: string | null;
  cityName: string | null;
  cityLatitude: Prisma.Decimal | null;
  cityLongitude: Prisma.Decimal | null;
}): CityPoint | null {
  if (!row.cityId || !row.cityName || row.cityLatitude === null || row.cityLongitude === null) {
    return null;
  }
  return {
    id: row.cityId,
    name: row.cityName,
    latitude: row.cityLatitude.toNumber(),
    longitude: row.cityLongitude.toNumber(),
  };
}

function isNativeLanguage(value: string): value is NativeLanguage {
  return (NATIVE_LANGUAGE_CODES as readonly string[]).includes(value);
}

function isPlacementLevel(value: string | null): value is PlacementLevel {
  return value !== null && (PLACEMENT_LEVELS as readonly string[]).includes(value);
}

function isLearningGoal(value: string): value is LearningGoal {
  return (LEARNING_GOALS as readonly string[]).includes(value);
}

function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}
