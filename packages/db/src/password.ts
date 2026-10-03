import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id parameters from the OWASP Password Storage Cheat Sheet.
 *
 * - algorithm: 2 (Argon2id)
 * - memoryCost: 19_456 KiB = 19 MiB (SP-012 NFR-1 minimum)
 * - timeCost: 2 passes
 * - parallelism: 1 lane
 *
 * Verify time on this profile stays well under the 500 ms login budget.
 * `@node-rs/argon2` defaults match these values; they are set explicitly so a
 * library upgrade cannot silently weaken the hash.
 */
export const ARGON2ID_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password, ARGON2ID_OPTIONS);
}
