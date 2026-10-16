import type { Permission } from "@sprachpilot/shared";
import { can, ForbiddenError } from "@sprachpilot/shared";

/**
 * Allows the actor to modify a resource they own, or a resource covered by an
 * explicit cross-user permission. Admin has no bypass outside that permission.
 */
export function assertMayModifyOwnedResource(input: {
  actorId: string;
  ownerId: string;
  actorRole: string;
  crossUserPermission: Permission;
}): void {
  if (input.actorId === input.ownerId) return;
  if (can(input.actorRole, input.crossUserPermission)) return;
  throw new ForbiddenError();
}
