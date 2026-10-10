import { prisma, type PrismaClient } from "@sprachpilot/db";

export const GOOGLE_PROVIDER = "google" as const;

export interface LinkedAccountRecord {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
}

export interface AccountRepository {
  findByProvider(provider: string, providerAccountId: string): Promise<LinkedAccountRecord | null>;
  findByUserAndProvider(userId: string, provider: string): Promise<LinkedAccountRecord | null>;
  link(input: {
    userId: string;
    provider: string;
    providerAccountId: string;
  }): Promise<LinkedAccountRecord>;
  unlink(userId: string, provider: string): Promise<boolean>;
  listProviders(userId: string): Promise<readonly string[]>;
}

export interface MemoryAccountRepository extends AccountRepository {
  records(): readonly LinkedAccountRecord[];
}

function toRecord(row: {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
}): LinkedAccountRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerAccountId: row.providerAccountId,
  };
}

export function createAccountRepository(client: PrismaClient = prisma): AccountRepository {
  return {
    async findByProvider(provider, providerAccountId) {
      const row = await client.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
      return row ? toRecord(row) : null;
    },

    async findByUserAndProvider(userId, provider) {
      const row = await client.account.findFirst({ where: { userId, provider } });
      return row ? toRecord(row) : null;
    },

    async link(input) {
      const row = await client.account.create({
        data: {
          userId: input.userId,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      });
      return toRecord(row);
    },

    async unlink(userId, provider) {
      const result = await client.account.deleteMany({ where: { userId, provider } });
      return result.count > 0;
    },

    async listProviders(userId) {
      const rows = await client.account.findMany({
        where: { userId },
        select: { provider: true },
      });
      return rows.map((row) => row.provider);
    },
  };
}

export function createMemoryAccountRepository(): MemoryAccountRepository {
  const rows: LinkedAccountRecord[] = [];

  return {
    async findByProvider(provider, providerAccountId) {
      return (
        rows.find(
          (row) => row.provider === provider && row.providerAccountId === providerAccountId,
        ) ?? null
      );
    },

    async findByUserAndProvider(userId, provider) {
      return rows.find((row) => row.userId === userId && row.provider === provider) ?? null;
    },

    async link(input) {
      const existing = rows.find(
        (row) =>
          row.provider === input.provider && row.providerAccountId === input.providerAccountId,
      );
      if (existing) throw new Error("duplicate provider account");
      const record: LinkedAccountRecord = {
        id: `account-${rows.length + 1}`,
        userId: input.userId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      };
      rows.push(record);
      return record;
    },

    async unlink(userId, provider) {
      const index = rows.findIndex((row) => row.userId === userId && row.provider === provider);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },

    async listProviders(userId) {
      return rows.filter((row) => row.userId === userId).map((row) => row.provider);
    },

    records() {
      return [...rows];
    },
  };
}
