import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Offline denylist of common passwords (NCSC top passwords, length >= 10).
 * Shorter entries are already rejected by the 10-character minimum.
 * No network call is made at registration time.
 */
let cachedPasswords: ReadonlySet<string> | undefined;

export function loadCommonPasswords(): ReadonlySet<string> {
  if (cachedPasswords) return cachedPasswords;

  const filePath = fileURLToPath(new URL("./data/common-passwords.txt", import.meta.url));
  const passwords = new Set<string>();

  // Bundled denylist next to this module, not a user-supplied path.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- module-relative file
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const value = line.trim().toLowerCase();
    if (value.length === 0 || value.startsWith("#")) continue;
    passwords.add(value);
  }

  cachedPasswords = passwords;
  return passwords;
}

export function isCommonPassword(
  password: string,
  passwords: ReadonlySet<string> = loadCommonPasswords(),
): boolean {
  return passwords.has(password.toLowerCase());
}
