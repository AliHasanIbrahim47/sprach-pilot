import { prisma, type PrismaClient } from "@sprachpilot/db";

export type EmailTokenPurpose = "email_verification" | "password_reset" | "email_change";

export type ConsumeEmailTokenResult =
  | { status: "consumed"; userId: string }
  | { status: "used" }
  | { status: "expired" }
  | { status: "invalid" };

export type PeekEmailTokenResult =
  | { status: "valid"; userId: string }
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

export interface ConsumeEmailTokenInput {
  tokenHash: string;
  now: Date;
  purpose: EmailTokenPurpose;
}

export interface EmailTokenRepository {
  /** Stores a new token and retires older unused tokens of the same purpose. */
  insert(input: InsertEmailTokenInput): Promise<void>;
  /**
   * Marks a matching unused token as used.
   * A token for a different purpose stays unused and is reported as invalid.
   */
  consume(input: ConsumeEmailTokenInput): Promise<ConsumeEmailTokenResult>;
  /** Reads a token without marking it used. */
  peek(input: ConsumeEmailTokenInput): Promise<PeekEmailTokenResult>;
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

    async peek(input) {
      const existing = await client.emailToken.findUnique({
        where: { tokenHash: input.tokenHash },
      });
      return classifyToken(existing, input);
    },

    async consume(input) {
      return client.$transaction(async (tx) => {
        const updated = await tx.emailToken.updateMany({
          where: {
            tokenHash: input.tokenHash,
            purpose: input.purpose,
            usedAt: null,
            expiresAt: { gt: input.now },
          },
          data: { usedAt: input.now },
        });
        if (updated.count === 1) {
          const row = await tx.emailToken.findUnique({
            where: { tokenHash: input.tokenHash },
            select: { userId: true },
          });
          if (!row) return { status: "invalid" };
          return { status: "consumed", userId: row.userId };
        }

        const existing = await tx.emailToken.findUnique({ where: { tokenHash: input.tokenHash } });
        if (!existing || existing.purpose !== input.purpose) return { status: "invalid" };
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

    async peek(input) {
      return classifyToken(rows.get(input.tokenHash), input);
    },

    async consume(input) {
      const row = rows.get(input.tokenHash);
      const preview = classifyToken(row, input);
      if (preview.status !== "valid") return preview;
      if (!row) return { status: "invalid" };
      row.usedAt = input.now;
      return { status: "consumed", userId: row.userId };
    },

    records() {
      return [...rows.values()].map((row) => ({ ...row }));
    },
  };
}

function classifyToken(
  row: { userId: string; purpose: string; expiresAt: Date; usedAt: Date | null } | null | undefined,
  input: ConsumeEmailTokenInput,
): PeekEmailTokenResult {
  if (!row || row.purpose !== input.purpose) return { status: "invalid" };
  if (row.usedAt) return { status: "used" };
  if (row.expiresAt.getTime() <= input.now.getTime()) return { status: "expired" };
  return { status: "valid", userId: row.userId };
}
