import { Prisma, prisma, type PrismaClient } from "@sprachpilot/db";
import { isUiLocale, type UiLocale } from "@sprachpilot/shared";

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  role: string;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
  uiLocale: UiLocale;
  onboardingCompletedAt: Date | null;
}

export interface ConsentDraft {
  policy: string;
  version: string;
  acceptedAt: Date;
  ipHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string | null;
  displayName: string;
  uiLocale: UiLocale;
  emailVerifiedAt?: Date | null;
  consents: readonly ConsentDraft[];
}

export type CreateUserResult = { status: "created"; id: string } | { status: "duplicate" };

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  createWithConsent(input: CreateUserInput): Promise<CreateUserResult>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  markEmailVerified(id: string, at: Date): Promise<void>;
}

export interface MemoryUserRepository extends UserRepository {
  records(): readonly (AuthUserRecord & { consents: readonly ConsentDraft[] })[];
  markDeleted(email: string): void;
}

function readLocale(value: string | null | undefined): UiLocale {
  if (value && isUiLocale(value)) return value;
  return "en";
}

function toRecord(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  role: string;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
  uiLocale: string;
  onboardingCompletedAt: Date | null;
}): AuthUserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role,
    deletedAt: user.deletedAt,
    emailVerifiedAt: user.emailVerifiedAt,
    uiLocale: readLocale(user.uiLocale),
    onboardingCompletedAt: user.onboardingCompletedAt,
  };
}

const userInclude = {
  profile: { select: { uiLocale: true, onboardingCompletedAt: true } },
} as const;

function fromPrisma(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  role: string;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
  profile: { uiLocale: string; onboardingCompletedAt: Date | null } | null;
}): AuthUserRecord {
  return toRecord({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role,
    deletedAt: user.deletedAt,
    emailVerifiedAt: user.emailVerifiedAt,
    uiLocale: user.profile?.uiLocale ?? "en",
    onboardingCompletedAt: user.profile?.onboardingCompletedAt ?? null,
  });
}

export function createUserRepository(client: PrismaClient = prisma): UserRepository {
  return {
    async findByEmail(email) {
      const user = await client.user.findUnique({ where: { email }, include: userInclude });
      return user ? fromPrisma(user) : null;
    },

    async findById(id) {
      const user = await client.user.findUnique({ where: { id }, include: userInclude });
      return user ? fromPrisma(user) : null;
    },

    async createWithConsent(input) {
      try {
        const user = await client.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
            emailVerifiedAt: input.emailVerifiedAt ?? null,
            profile: { create: { uiLocale: input.uiLocale } },
            consentRecords: {
              create: input.consents.map((consent) => ({
                policy: consent.policy,
                version: consent.version,
                acceptedAt: consent.acceptedAt,
                ipHash: consent.ipHash,
              })),
            },
          },
        });
        return { status: "created", id: user.id };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { status: "duplicate" };
        }
        throw error;
      }
    },

    async updatePassword(id, passwordHash) {
      await client.user.update({ where: { id }, data: { passwordHash } });
    },

    async markEmailVerified(id, at) {
      await client.user.updateMany({
        where: { id, emailVerifiedAt: null },
        data: { emailVerifiedAt: at },
      });
    },
  };
}

export function createMemoryUserRepository(): MemoryUserRepository {
  const users = new Map<string, AuthUserRecord & { consents: ConsentDraft[] }>();

  return {
    async findByEmail(email) {
      const user = users.get(email);
      return user ? toRecord(user) : null;
    },

    async findById(id) {
      const user = [...users.values()].find((record) => record.id === id);
      return user ? toRecord(user) : null;
    },

    async createWithConsent(input) {
      if (users.has(input.email)) return { status: "duplicate" };
      const record = {
        id: `user-${users.size + 1}`,
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: "learner",
        deletedAt: null,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        uiLocale: input.uiLocale,
        onboardingCompletedAt: null as Date | null,
        consents: [...input.consents],
      };
      users.set(input.email, record);
      return { status: "created", id: record.id };
    },

    records() {
      return [...users.values()];
    },

    async updatePassword(id, passwordHash) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) throw new Error("user not found");
      user.passwordHash = passwordHash;
    },

    async markEmailVerified(id, at) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user || user.emailVerifiedAt) return;
      user.emailVerifiedAt = at;
    },

    markDeleted(email) {
      const user = users.get(email);
      if (!user) return;
      user.deletedAt = new Date(0);
    },
  };
}
