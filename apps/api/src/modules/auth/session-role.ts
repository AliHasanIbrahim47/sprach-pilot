import { isUserRole, UnauthorizedError, type UserRole } from "@sprachpilot/shared";

/** Role claim from a token or a user row, rejected when it is not one of the six roles. */
export function sessionRole(role: string): UserRole {
  if (!isUserRole(role)) throw new UnauthorizedError();
  return role;
}
