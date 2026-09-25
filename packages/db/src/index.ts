/**
 * Database package placeholder. Prisma client and schema arrive in SP-005.
 */
import type { WorkspaceName } from "@sprachpilot/shared";

export const DB_PACKAGE: WorkspaceName = "db";

export function getDbPackageName(): string {
  return "@sprachpilot/db";
}
