import { z } from "zod";

export const USER_ROLES = [
  "learner",
  "volunteer",
  "organizer",
  "content_editor",
  "moderator",
  "admin",
] as const;

export const PERMISSIONS = [
  "learn",
  "tandem.offer",
  "events.manage",
  "scenarios.author",
  "moderation.act",
  "roles.assign",
] as const;

export const userRoleSchema = z.enum(USER_ROLES).meta({
  id: "UserRole",
  description: "The single role stored for a user and copied into the access token.",
});

export const permissionSchema = z.enum(PERMISSIONS).meta({ id: "Permission" });

export type UserRole = z.infer<typeof userRoleSchema>;
export type Permission = z.infer<typeof permissionSchema>;

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  learner: ["learn"],
  volunteer: ["learn", "tandem.offer"],
  organizer: ["learn", "events.manage"],
  content_editor: ["learn", "scenarios.author"],
  moderator: ["learn", "moderation.act"],
  admin: [
    "learn",
    "tandem.offer",
    "events.manage",
    "scenarios.author",
    "moderation.act",
    "roles.assign",
  ],
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/** True when the role's permission set includes `permission`. Unknown roles grant nothing. */
export function can(role: string, permission: Permission): boolean {
  if (!isUserRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const sessionUserSchema = z
  .object({
    id: z.string().min(1).max(64),
    displayName: z.string().min(1).max(100),
    emailVerified: z.boolean(),
    role: userRoleSchema,
  })
  .meta({ id: "SessionUser" });

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const assignRoleBodySchema = z
  .object({
    role: userRoleSchema,
  })
  .meta({ id: "AssignRoleBody" });

export type AssignRoleBody = z.infer<typeof assignRoleBodySchema>;

export const assignRoleResponseSchema = z
  .object({
    id: z.string().min(1).max(64),
    role: userRoleSchema,
  })
  .meta({ id: "AssignRoleResponse" });

export type AssignRoleResponse = z.infer<typeof assignRoleResponseSchema>;
