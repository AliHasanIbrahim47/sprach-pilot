import { Prisma, prisma, type PrismaClient } from "@sprachpilot/db";

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: string;
  deletedAt: Date | null;
}

export interface ConsentDraft {
  policy: string;
  version: string;
  acceptedAt: Date;
  ipHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  consents: readonly ConsentDraft[];
}

export type CreateUserResult = { status: "created"; id: string } | { status: "duplicate" };

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  createWithConsent(input: CreateUserInput): Promise<CreateUserResult>;
}

export interface MemoryUserRepository extends UserRepository {
  records(): readonly (AuthUserRecord & { consents: readonly ConsentDraft[] })[];
  markDeleted(email: string): void;
}

function toRecord(user: {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: string;
  deletedAt: Date | null;
}): AuthUserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role,
    deletedAt: user.deletedAt,
  };
}

export function createUserRepository(client: PrismaClient = prisma): UserRepository {
  return {
    async findByEmail(email) {
      const user = await client.user.findUnique({ where: { email } });
      return user ? toRecord(user) : null;
    },

    async findById(id) {
      const user = await client.user.findUnique({ where: { id } });
      return user ? toRecord(user) : null;
    },

    async createWithConsent(input) {
      try {
        const user = await client.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
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
        consents: [...input.consents],
      };
      users.set(input.email, record);
      return { status: "created", id: record.id };
    },

    records() {
      return [...users.values()];
    },

    markDeleted(email) {
      const user = users.get(email);
      if (!user) return;
      user.deletedAt = new Date(0);
    },
  };
}
