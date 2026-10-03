/**
 * Shared Prisma data layer for API and worker (@sprachpilot/db).
 */
export type { CreatePrismaClientOptions } from "./client.js";
export { createPrismaClient, prisma } from "./client.js";
export { ARGON2ID_OPTIONS, hashPassword, verifyPassword } from "./password.js";
export type { AuditLog, Profile, User } from "@prisma/client";
export { CefrLevel, Prisma, PrismaClient, UserRole } from "@prisma/client";
