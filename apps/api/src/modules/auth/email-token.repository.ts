import { prisma, type PrismaClient } from "@sprachpilot/db";

export type EmailTokenPurpose = "email_verification" | "password_reset";

export type ConsumeEmailTokenResult =
  | { status: "consumed"; userId: string }
  | { status: "used" }
  | { status: "expired" }
  | { status: "invalid" };

export interface InsertEmailTokenInput {
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
}

export interface EmailTokenRepository {
  /** Stores a new token and retires older unused tokens of the same purpose. */
  insert(input: InsertEmailTokenInput): Promise<void>;
  consume(tokenHash: string, now: Date): Promise<ConsumeEmailTokenResult>;
}

interface EmailTokenRow {
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export function createEmailTokenRepository(client: PrismaClient = prisma): EmailTokenRepository {
  return {
    async insert(input) {
      await client.$transaction([
        client.emailToken.updateMany({
          where: { userId: input.userId, purpose: input.purpose, usedAt: null },
          data: { usedAt: input.now },
        }),
        client.emailToken.create({
          data: {
            userId: input.userId,
            purpose: input.purpose,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        }),
      ]);
    },

    async consume(tokenHash, now) {
      return client.$transaction(async (tx) => {
        const updated = await tx.emailToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (updated.count === 1) {
          const row = await tx.emailToken.findUnique({
            where: { tokenHash },
            select: { userId: true },
          });
          if (!row) return { status: "invalid" };
          return { status: "consumed", userId: row.userId };
        }

        const existing = await tx.emailToken.findUnique({ where: { tokenHash } });
        if (!existing) return { status: "invalid" };
        if (existing.usedAt) return { status: "used" };
        return { status: "expired" };
      });
    },
  };
}

export interface MemoryEmailTokenRepository extends EmailTokenRepository {
  records(): readonly EmailTokenRow[];
}

export function createMemoryEmailTokenRepository(): MemoryEmailTokenRepository {
  const rows = new Map<string, EmailTokenRow>();

  return {
    async insert(input) {
      for (const row of rows.values()) {
        if (row.userId === input.userId && row.purpose === input.purpose && row.usedAt === null) {
          row.usedAt = input.now;
        }
      }
      rows.set(input.tokenHash, {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
        createdAt: input.now,
      });
    },

    async consume(tokenHash, now) {
      const row = rows.get(tokenHash);
      if (!row) return { status: "invalid" };
      if (row.usedAt) return { status: "used" };
      if (row.expiresAt.getTime() <= now.getTime()) return { status: "expired" };
      row.usedAt = now;
      return { status: "consumed", userId: row.userId };
    },

    records() {
      return [...rows.values()].map((row) => ({ ...row }));
    },
  };
}
