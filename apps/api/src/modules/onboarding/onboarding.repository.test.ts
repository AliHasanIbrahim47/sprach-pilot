import { Prisma } from "@sprachpilot/db";
import { describe, expect, it } from "vitest";

import { createOnboardingRepository } from "./onboarding.repository.js";

interface StoredProfile {
  userId: string;
  uiLocale: string;
  nativeLanguages: string[];
  cefrLevel: string | null;
  goals: string[];
  cityId: string | null;
  cityName: string | null;
  cityLatitude: null;
  cityLongitude: null;
  onboardingStep: string;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
  deletedAt: Date | null;
}

function createFakeClient(initial: StoredProfile[] = []) {
  const rows = new Map(initial.map((row) => [row.userId, row]));
  return {
    profile: {
      /**
       * Returns the stored profile, or null when this fake client has no row for the user.
       */
      async findUnique({ where }: { where: { userId: string } }) {
        return rows.get(where.userId) ?? null;
      },
      /**
       * Inserts a default profile, or rejects a second profile for the same user.
       */
      async create({ data }: { data: { userId: string } }) {
        if (rows.has(data.userId)) {
          throw new Prisma.PrismaClientKnownRequestError("unique", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        const row: StoredProfile = {
          userId: data.userId,
          uiLocale: "en",
          nativeLanguages: [],
          cefrLevel: null,
          goals: [],
          cityId: null,
          cityName: null,
          cityLatitude: null,
          cityLongitude: null,
          onboardingStep: "languages",
          onboardingCompletedAt: null,
          onboardingSkippedAt: null,
          deletedAt: null,
        };
        rows.set(data.userId, row);
        return row;
      },
      async update() {
        return null;
      },
    },
    rows,
  };
}

describe("onboarding repository", () => {
  it("opens a pending profile when the account has none", async () => {
    const client = createFakeClient();
    const profiles = createOnboardingRepository(client as never);

    const profile = await profiles.get("user-without-profile");

    expect(profile).toMatchObject({
      userId: "user-without-profile",
      step: "languages",
      cefrLevel: null,
      completedAt: null,
      skippedAt: null,
    });
    expect(client.rows.has("user-without-profile")).toBe(true);
  });

  it("does not recreate a deleted profile", async () => {
    const client = createFakeClient([
      {
        userId: "deleted-user",
        uiLocale: "en",
        nativeLanguages: [],
        cefrLevel: null,
        goals: [],
        cityId: null,
        cityName: null,
        cityLatitude: null,
        cityLongitude: null,
        onboardingStep: "languages",
        onboardingCompletedAt: null,
        onboardingSkippedAt: null,
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    const profiles = createOnboardingRepository(client as never);

    await expect(profiles.get("deleted-user")).rejects.toMatchObject({ status: 404 });
    expect(client.rows.size).toBe(1);
  });
});
