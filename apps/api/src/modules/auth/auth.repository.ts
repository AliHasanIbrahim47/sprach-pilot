import { Prisma, prisma, type PrismaClient } from "@sprachpilot/db";
import { isUiLocale, type UiLocale } from "@sprachpilot/shared";

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  role: string;
  deletedAt: Date | null;
  deletionRequestedAt: Date | null;
  purgeAfter: Date | null;
  recordingStorageTransient: boolean;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  uiLocale: UiLocale;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
}

export interface ConsentDraft {
  policy: string;
  version: string;
  acceptedAt: Date;
  ipHash: string;
  decision?: "granted" | "withdrawn";
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
  updateDisplayName(id: string, displayName: string): Promise<void>;
  /**
   * Replaces the login email and marks it verified.
   * Returns `taken` when another account already uses that address.
   */
  changeEmail(
    id: string,
    email: string,
    verifiedAt: Date,
  ): Promise<"updated" | "taken" | "missing">;
  markEmailVerified(id: string, at: Date): Promise<void>;
  listConsents(userId: string): Promise<readonly ConsentDraft[]>;
  appendConsent(userId: string, consent: ConsentDraft): Promise<void>;
  scheduleDeletion(id: string, requestedAt: Date, purgeAfter: Date): Promise<void>;
  clearDeletion(id: string): Promise<void>;
  setRecordingTransient(id: string, transient: boolean): Promise<void>;
  anonymize(
    id: string,
    identity: {
      email: string;
      displayName: string;
      deletedAt: Date;
    },
  ): Promise<void>;
}

export interface MemoryUserRepository extends UserRepository {
  records(): readonly (AuthUserRecord & { consents: readonly ConsentDraft[] })[];
  markDeleted(email: string): void;
  arrangeRole(email: string, role: string): void;
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
  deletionRequestedAt?: Date | null;
  purgeAfter?: Date | null;
  recordingStorageTransient?: boolean;
  createdAt?: Date;
  emailVerifiedAt: Date | null;
  uiLocale: string;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
}): AuthUserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role,
    deletedAt: user.deletedAt,
    deletionRequestedAt: user.deletionRequestedAt ?? null,
    purgeAfter: user.purgeAfter ?? null,
    recordingStorageTransient: user.recordingStorageTransient ?? false,
    createdAt: user.createdAt ?? new Date(0),
    emailVerifiedAt: user.emailVerifiedAt,
    uiLocale: readLocale(user.uiLocale),
    onboardingCompletedAt: user.onboardingCompletedAt,
    onboardingSkippedAt: user.onboardingSkippedAt,
  };
}

const userInclude = {
  profile: { select: { uiLocale: true, onboardingCompletedAt: true, onboardingSkippedAt: true } },
} as const;

/**
 * Maps a user and profile row into the auth record. A missing profile still needs onboarding.
 */
function fromPrisma(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  role: string;
  deletedAt: Date | null;
  deletionRequestedAt: Date | null;
  purgeAfter: Date | null;
  recordingStorageTransient: boolean;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  profile: {
    uiLocale: string;
    onboardingCompletedAt: Date | null;
    onboardingSkippedAt: Date | null;
  } | null;
}): AuthUserRecord {
  return toRecord({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role,
    deletedAt: user.deletedAt,
    deletionRequestedAt: user.deletionRequestedAt,
    purgeAfter: user.purgeAfter,
    recordingStorageTransient: user.recordingStorageTransient,
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt,
    uiLocale: user.profile?.uiLocale ?? "en",
    onboardingCompletedAt: user.profile?.onboardingCompletedAt ?? null,
    onboardingSkippedAt: user.profile?.onboardingSkippedAt ?? null,
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
                decision: consent.decision ?? "granted",
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

    async updateDisplayName(id, displayName) {
      await client.user.update({ where: { id }, data: { displayName } });
    },

    async changeEmail(id, email, verifiedAt) {
      try {
        await client.user.update({
          where: { id },
          data: { email, emailVerifiedAt: verifiedAt },
        });
        return "updated";
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return "taken";
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return "missing";
        }
        throw error;
      }
    },

    async markEmailVerified(id, at) {
      await client.user.updateMany({
        where: { id, emailVerifiedAt: null },
        data: { emailVerifiedAt: at },
      });
    },

    async listConsents(userId) {
      const rows = await client.consentRecord.findMany({
        where: { userId },
        orderBy: { acceptedAt: "asc" },
      });
      return rows.map((row) => ({
        policy: row.policy,
        version: row.version,
        acceptedAt: row.acceptedAt,
        ipHash: row.ipHash,
        decision: row.decision === "withdrawn" ? "withdrawn" : "granted",
      }));
    },

    async appendConsent(userId, consent) {
      await client.consentRecord.create({
        data: {
          userId,
          policy: consent.policy,
          version: consent.version,
          decision: consent.decision ?? "granted",
          acceptedAt: consent.acceptedAt,
          ipHash: consent.ipHash,
        },
      });
    },

    async scheduleDeletion(id, requestedAt, purgeAfter) {
      await client.user.update({
        where: { id },
        data: { deletionRequestedAt: requestedAt, purgeAfter },
      });
    },

    async clearDeletion(id) {
      await client.user.update({
        where: { id },
        data: { deletionRequestedAt: null, purgeAfter: null },
      });
    },

    async setRecordingTransient(id, transient) {
      await client.user.update({
        where: { id },
        data: { recordingStorageTransient: transient },
      });
    },

    async anonymize(id, identity) {
      await client.user.update({
        where: { id },
        data: {
          email: identity.email,
          displayName: identity.displayName,
          passwordHash: null,
          deletedAt: identity.deletedAt,
          deletionRequestedAt: null,
          purgeAfter: null,
        },
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

    /**
     * Stores an in-memory user whose onboarding has not been finished or skipped.
     */
    async createWithConsent(input) {
      if (users.has(input.email)) return { status: "duplicate" };
      const record = {
        id: `user-${users.size + 1}`,
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: "learner",
        deletedAt: null,
        deletionRequestedAt: null,
        purgeAfter: null,
        recordingStorageTransient: false,
        createdAt: new Date(),
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        uiLocale: input.uiLocale,
        onboardingCompletedAt: null as Date | null,
        onboardingSkippedAt: null as Date | null,
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

    async updateDisplayName(id, displayName) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) throw new Error("user not found");
      user.displayName = displayName;
    },

    async changeEmail(id, email, verifiedAt) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) return "missing";
      const existing = users.get(email);
      if (existing && existing.id !== id) return "taken";
      users.delete(user.email);
      user.email = email;
      user.emailVerifiedAt = verifiedAt;
      users.set(email, user);
      return "updated";
    },

    async markEmailVerified(id, at) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user || user.emailVerifiedAt) return;
      user.emailVerifiedAt = at;
    },

    async listConsents(userId) {
      const user = [...users.values()].find((record) => record.id === userId);
      return user ? user.consents.map((consent) => ({ ...consent })) : [];
    },

    async appendConsent(userId, consent) {
      const user = [...users.values()].find((record) => record.id === userId);
      if (!user) throw new Error("user not found");
      user.consents.push({ ...consent });
    },

    async scheduleDeletion(id, requestedAt, purgeAfter) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) throw new Error("user not found");
      user.deletionRequestedAt = requestedAt;
      user.purgeAfter = purgeAfter;
    },

    async clearDeletion(id) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) return;
      user.deletionRequestedAt = null;
      user.purgeAfter = null;
    },

    async setRecordingTransient(id, transient) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) throw new Error("user not found");
      user.recordingStorageTransient = transient;
    },

    async anonymize(id, identity) {
      const user = [...users.values()].find((record) => record.id === id);
      if (!user) return;
      users.delete(user.email);
      user.email = identity.email;
      user.displayName = identity.displayName;
      user.passwordHash = null;
      user.deletedAt = identity.deletedAt;
      user.deletionRequestedAt = null;
      user.purgeAfter = null;
      users.set(user.email, user);
    },

    markDeleted(email) {
      const user = users.get(email);
      if (!user) return;
      user.deletedAt = new Date(0);
    },

    arrangeRole(email: string, role: string) {
      const user = users.get(email);
      if (!user) throw new Error(`no user for ${email}`);
      user.role = role;
    },
  };
}
