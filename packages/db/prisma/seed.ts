import { hash } from "@node-rs/argon2";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

/** Demo credentials — local/dev only. Documented in packages/db/README.md. */
const SEED_USERS = [
  {
    email: "admin@sprachpilot.local",
    displayName: "SprachPilot Admin",
    role: UserRole.admin,
    password: "ChangeMe!Admin1",
    profile: {
      nativeLanguages: ["en"],
      uiLocale: "en",
      cefrLevel: null,
      goals: [],
      cityName: "Berlin",
      timezone: "Europe/Berlin",
      onboardingCompletedAt: new Date(),
    },
  },
  {
    email: "learner@sprachpilot.local",
    displayName: "Demo Learner",
    role: UserRole.learner,
    password: "ChangeMe!Learner1",
    profile: {
      nativeLanguages: ["en", "ar"],
      uiLocale: "en",
      cefrLevel: "A2" as const,
      goals: ["work", "bureaucracy", "housing"],
      cityName: "Berlin",
      timezone: "Europe/Berlin",
      onboardingCompletedAt: new Date(),
    },
  },
] as const;

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function upsertSeedUser(seed: (typeof SEED_USERS)[number]): Promise<string> {
  const passwordHash = await hash(seed.password, ARGON2_OPTIONS);

  const user = await prisma.user.upsert({
    where: { email: seed.email },
    create: {
      email: seed.email,
      displayName: seed.displayName,
      role: seed.role,
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          nativeLanguages: [...seed.profile.nativeLanguages],
          uiLocale: seed.profile.uiLocale,
          cefrLevel: seed.profile.cefrLevel,
          goals: [...seed.profile.goals],
          cityName: seed.profile.cityName,
          timezone: seed.profile.timezone,
          onboardingCompletedAt: seed.profile.onboardingCompletedAt,
        },
      },
    },
    update: {
      displayName: seed.displayName,
      role: seed.role,
      passwordHash,
      emailVerifiedAt: new Date(),
      deletedAt: null,
      profile: {
        upsert: {
          create: {
            nativeLanguages: [...seed.profile.nativeLanguages],
            uiLocale: seed.profile.uiLocale,
            cefrLevel: seed.profile.cefrLevel,
            goals: [...seed.profile.goals],
            cityName: seed.profile.cityName,
            timezone: seed.profile.timezone,
            onboardingCompletedAt: seed.profile.onboardingCompletedAt,
          },
          update: {
            nativeLanguages: [...seed.profile.nativeLanguages],
            uiLocale: seed.profile.uiLocale,
            cefrLevel: seed.profile.cefrLevel,
            goals: [...seed.profile.goals],
            cityName: seed.profile.cityName,
            timezone: seed.profile.timezone,
            onboardingCompletedAt: seed.profile.onboardingCompletedAt,
            deletedAt: null,
          },
        },
      },
    },
  });

  return user.id;
}

async function ensureSeedAuditLog(actorId: string): Promise<void> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      actorId,
      action: "seed.bootstrap",
      entityType: "system",
      entityId: "bootstrap",
    },
  });

  if (existing) return;

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "seed.bootstrap",
      entityType: "system",
      entityId: "bootstrap",
      metadata: {
        source: "pnpm db:seed",
        note: "Initial admin and demo learner created",
      },
    },
  });
}

async function main(): Promise<void> {
  const adminId = await upsertSeedUser(SEED_USERS[0]);
  await upsertSeedUser(SEED_USERS[1]);
  await ensureSeedAuditLog(adminId);

  console.info("[db:seed] upserted admin@sprachpilot.local and learner@sprachpilot.local");
}

main()
  .catch((error: unknown) => {
    console.error("[db:seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
