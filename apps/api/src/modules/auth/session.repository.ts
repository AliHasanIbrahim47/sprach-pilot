import { prisma, type PrismaClient } from "@sprachpilot/db";

export type RevokeReason = "logout" | "revoked" | "reuse" | "password_reset";

export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RevokeReason | null;
  rotatedAt: Date | null;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipHash: string | null;
  now: Date;
}

export type RotateResult =
  | { status: "rotated"; session: SessionRecord }
  | { status: "reuse"; familyId: string; userId: string }
  | { status: "expired" }
  | { status: "invalid" };

export interface RotateSessionInput {
  refreshTokenHash: string;
  nextRefreshTokenHash: string;
  expiresAt: Date;
  now: Date;
}

export interface RevokeFamilyInput {
  familyId: string;
  userId?: string;
  reason: RevokeReason;
  now: Date;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionRecord>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRecord | null>;
  rotate(input: RotateSessionInput): Promise<RotateResult>;
  familyBelongsToUser(familyId: string, userId: string): Promise<boolean>;
  revokeFamily(input: RevokeFamilyInput): Promise<void>;
  revokeAllForUser(input: { userId: string; reason: RevokeReason; now: Date }): Promise<void>;
  listActive(userId: string, now: Date): Promise<SessionRecord[]>;
}

interface SessionRow {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  rotatedAt: Date | null;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: Date;
  lastUsedAt: Date;
}

function readReason(value: string | null): RevokeReason | null {
  if (
    value === "logout" ||
    value === "revoked" ||
    value === "reuse" ||
    value === "password_reset"
  ) {
    return value;
  }
  return null;
}

function toSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    familyId: row.familyId,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    revokedReason: readReason(row.revokedReason),
    rotatedAt: row.rotatedAt,
    userAgent: row.userAgent,
    ipHash: row.ipHash,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

export function createSessionRepository(client: PrismaClient = prisma): SessionRepository {
  return {
    async create(input) {
      const row = await client.session.create({
        data: {
          userId: input.userId,
          familyId: input.familyId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent,
          ipHash: input.ipHash,
          lastUsedAt: input.now,
        },
      });
      return toSessionRecord(row);
    },

    async findByRefreshTokenHash(refreshTokenHash) {
      const row = await client.session.findUnique({ where: { refreshTokenHash } });
      return row ? toSessionRecord(row) : null;
    },

    async rotate(input) {
      return client.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "sessions"
          WHERE "refresh_token_hash" = ${input.refreshTokenHash}
          FOR UPDATE
        `;
        const lockedId = locked[0]?.id;
        if (!lockedId) return { status: "invalid" };

        const current = await tx.session.findUnique({ where: { id: lockedId } });
        if (!current) return { status: "invalid" };

        if (current.rotatedAt) {
          await tx.session.updateMany({
            where: { familyId: current.familyId, revokedAt: null },
            data: { revokedAt: input.now, revokedReason: "reuse" },
          });
          return { status: "reuse", familyId: current.familyId, userId: current.userId };
        }

        if (current.revokedAt) return { status: "invalid" };
        if (current.expiresAt.getTime() <= input.now.getTime()) return { status: "expired" };

        await tx.session.update({
          where: { id: current.id },
          data: { rotatedAt: input.now, lastUsedAt: input.now },
        });

        const created = await tx.session.create({
          data: {
            userId: current.userId,
            familyId: current.familyId,
            refreshTokenHash: input.nextRefreshTokenHash,
            expiresAt: input.expiresAt,
            userAgent: current.userAgent,
            ipHash: current.ipHash,
            lastUsedAt: input.now,
          },
        });

        return { status: "rotated", session: toSessionRecord(created) };
      });
    },

    async familyBelongsToUser(familyId, userId) {
      const row = await client.session.findFirst({
        where: { familyId, userId },
        select: { id: true },
      });
      return row !== null;
    },

    async revokeFamily(input) {
      await client.session.updateMany({
        where: {
          familyId: input.familyId,
          revokedAt: null,
          ...(input.userId !== undefined ? { userId: input.userId } : {}),
        },
        data: { revokedAt: input.now, revokedReason: input.reason },
      });
    },

    async revokeAllForUser(input) {
      await client.session.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: input.now, revokedReason: input.reason },
      });
    },

    async listActive(userId, now) {
      const rows = await client.session.findMany({
        where: {
          userId,
          rotatedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { lastUsedAt: "desc" },
      });
      return rows.map(toSessionRecord);
    },
  };
}

export interface MemorySessionRepository extends SessionRepository {
  records(): readonly SessionRecord[];
}

export function createMemorySessionRepository(): MemorySessionRepository {
  const rows = new Map<string, SessionRecord>();
  let sequence = 0;

  function snapshot(record: SessionRecord): SessionRecord {
    return { ...record };
  }

  return {
    async create(input) {
      sequence += 1;
      const record: SessionRecord = {
        id: `session-${sequence}`,
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        revokedReason: null,
        rotatedAt: null,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
        createdAt: input.now,
        lastUsedAt: input.now,
      };
      rows.set(record.id, record);
      return snapshot(record);
    },

    async findByRefreshTokenHash(refreshTokenHash) {
      const record = [...rows.values()].find((row) => row.refreshTokenHash === refreshTokenHash);
      return record ? snapshot(record) : null;
    },

    async rotate(input) {
      const current = [...rows.values()].find(
        (row) => row.refreshTokenHash === input.refreshTokenHash,
      );
      if (!current) return { status: "invalid" };

      if (current.rotatedAt) {
        for (const row of rows.values()) {
          if (row.familyId === current.familyId && row.revokedAt === null) {
            row.revokedAt = input.now;
            row.revokedReason = "reuse";
          }
        }
        return { status: "reuse", familyId: current.familyId, userId: current.userId };
      }

      if (current.revokedAt) return { status: "invalid" };
      if (current.expiresAt.getTime() <= input.now.getTime()) return { status: "expired" };

      current.rotatedAt = input.now;
      current.lastUsedAt = input.now;

      sequence += 1;
      const created: SessionRecord = {
        id: `session-${sequence}`,
        userId: current.userId,
        familyId: current.familyId,
        refreshTokenHash: input.nextRefreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        revokedReason: null,
        rotatedAt: null,
        userAgent: current.userAgent,
        ipHash: current.ipHash,
        createdAt: input.now,
        lastUsedAt: input.now,
      };
      rows.set(created.id, created);
      return { status: "rotated", session: snapshot(created) };
    },

    async familyBelongsToUser(familyId, userId) {
      return [...rows.values()].some((row) => row.familyId === familyId && row.userId === userId);
    },

    async revokeFamily(input) {
      for (const row of rows.values()) {
        if (row.familyId !== input.familyId || row.revokedAt !== null) continue;
        if (input.userId !== undefined && row.userId !== input.userId) continue;
        row.revokedAt = input.now;
        row.revokedReason = input.reason;
      }
    },

    async revokeAllForUser(input) {
      for (const row of rows.values()) {
        if (row.userId !== input.userId || row.revokedAt !== null) continue;
        row.revokedAt = input.now;
        row.revokedReason = input.reason;
      }
    },

    async listActive(userId, now) {
      return [...rows.values()]
        .filter(
          (row) =>
            row.userId === userId &&
            row.rotatedAt === null &&
            row.revokedAt === null &&
            row.expiresAt.getTime() > now.getTime(),
        )
        .sort((left, right) => right.lastUsedAt.getTime() - left.lastUsedAt.getTime())
        .map(snapshot);
    },

    records() {
      return [...rows.values()].map(snapshot);
    },
  };
}
