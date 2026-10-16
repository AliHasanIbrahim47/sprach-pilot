import { ConflictError, ForbiddenError, NotFoundError, type UserRole } from "@sprachpilot/shared";

import type { RoleRepository, RoleWrite } from "./role.repository.js";

export interface RoleService {
  assignRole(input: {
    actorId: string;
    targetUserId: string;
    role: UserRole;
  }): Promise<{ id: string; role: UserRole }>;
}

type RoleHolder = { role: string; deletedAt: Date | null } | null;

type RoleChangeDecision =
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "last-admin" }
  | { type: "unchanged"; role: UserRole }
  | { type: "update"; previousRole: string };

export function decideRoleChange(input: {
  actor: RoleHolder;
  target: RoleHolder;
  nextRole: UserRole;
  otherActiveAdminCount: number;
}): RoleChangeDecision {
  if (!input.actor || input.actor.deletedAt !== null || input.actor.role !== "admin") {
    return { type: "forbidden" };
  }
  if (!input.target || input.target.deletedAt !== null) return { type: "not-found" };
  if (input.target.role === input.nextRole) return { type: "unchanged", role: input.nextRole };
  if (input.target.role === "admin" && input.otherActiveAdminCount === 0) {
    return { type: "last-admin" };
  }
  return { type: "update", previousRole: input.target.role };
}

function toRoleWrite(decision: RoleChangeDecision, nextRole: UserRole): RoleWrite {
  if (decision.type === "forbidden") throw new ForbiddenError();
  if (decision.type === "not-found") throw new NotFoundError("User not found");
  if (decision.type === "last-admin") {
    throw new ConflictError("The platform must keep one admin");
  }
  if (decision.type === "unchanged") return { type: "unchanged", role: decision.role };
  return { type: "update", previousRole: decision.previousRole, role: nextRole };
}

export function createRoleService(roles: RoleRepository): RoleService {
  return {
    async assignRole(input) {
      return roles.commitRoleChange({
        actorId: input.actorId,
        targetUserId: input.targetUserId,
        decide(snapshot) {
          return toRoleWrite(
            decideRoleChange({
              actor: snapshot.actor,
              target: snapshot.target,
              nextRole: input.role,
              otherActiveAdminCount: snapshot.otherActiveAdminCount,
            }),
            input.role,
          );
        },
      });
    },
  };
}
