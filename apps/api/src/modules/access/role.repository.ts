import { prisma, type PrismaClient } from "@sprachpilot/db";
import type { UserRole } from "@sprachpilot/shared";

import type { MemoryUserRepository } from "../auth/auth.repository.js";

export interface RoleAuditEntry {
  actorId: string;
  action: "role.assigned";
  entityType: "user";
  entityId: string;
  metadata: { oldRole: string; newRole: UserRole };
}

export interface RoleChangeSnapshot {
  actor: { role: string; deletedAt: Date | null } | null;
  target: { id: string; role: string; deletedAt: Date | null } | null;
  otherActiveAdminCount: number;
}

export type RoleWrite =
  { type: "unchanged"; role: UserRole } | { type: "update"; previousRole: string; role: UserRole };

export interface RoleRepository {
  commitRoleChange(input: {
    actorId: string;
    targetUserId: string;
    decide: (snapshot: RoleChangeSnapshot) => RoleWrite;
  }): Promise<{ id: string; role: UserRole }>;
}

export interface MemoryRoleRepository extends RoleRepository {
  audits(): readonly RoleAuditEntry[];
}

export function createRoleRepository(client: PrismaClient = prisma): RoleRepository {
  return {
    async commitRoleChange(input) {
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM users
          WHERE deleted_at IS NULL
            AND (
              id = ${input.actorId}::uuid
              OR id = ${input.targetUserId}::uuid
              OR role = 'admin'::user_role
            )
          FOR UPDATE
        `;

        const actor = await tx.user.findUnique({ where: { id: input.actorId } });
        const target = await tx.user.findUnique({ where: { id: input.targetUserId } });
        const otherActiveAdminCount = await tx.user.count({
          where: { role: "admin", deletedAt: null, id: { not: input.targetUserId } },
        });
        const write = input.decide({
          actor: actor ? { role: actor.role, deletedAt: actor.deletedAt } : null,
          target: target ? { id: target.id, role: target.role, deletedAt: target.deletedAt } : null,
          otherActiveAdminCount,
        });

        if (write.type === "unchanged") return { id: input.targetUserId, role: write.role };

        await tx.user.update({
          where: { id: input.targetUserId },
          data: { role: write.role },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: "role.assigned",
            entityType: "user",
            entityId: input.targetUserId,
            metadata: { oldRole: write.previousRole, newRole: write.role },
          },
        });
        return { id: input.targetUserId, role: write.role };
      });
    },
  };
}

export function createMemoryRoleRepository(users: MemoryUserRepository): MemoryRoleRepository {
  const audits: RoleAuditEntry[] = [];

  return {
    audits() {
      return audits;
    },

    async commitRoleChange(input) {
      const records = users.records();
      const actor = records.find((user) => user.id === input.actorId) ?? null;
      const target = records.find((user) => user.id === input.targetUserId) ?? null;
      const otherActiveAdminCount = records.filter(
        (user) =>
          user.id !== input.targetUserId && user.role === "admin" && user.deletedAt === null,
      ).length;
      const write = input.decide({
        actor: actor ? { role: actor.role, deletedAt: actor.deletedAt } : null,
        target: target ? { id: target.id, role: target.role, deletedAt: target.deletedAt } : null,
        otherActiveAdminCount,
      });

      if (write.type === "unchanged") return { id: input.targetUserId, role: write.role };
      if (!target) throw new Error("Role update missing target row");

      target.role = write.role;
      audits.push({
        actorId: input.actorId,
        action: "role.assigned",
        entityType: "user",
        entityId: target.id,
        metadata: { oldRole: write.previousRole, newRole: write.role },
      });
      return { id: target.id, role: write.role };
    },
  };
}
