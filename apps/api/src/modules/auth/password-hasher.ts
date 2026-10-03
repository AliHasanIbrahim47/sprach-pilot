import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "@sprachpilot/db";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
  /** Real argon2id hash used when the account does not exist, so verify cost matches. */
  dummyHash(): Promise<string>;
}

export function createPasswordHasher(): PasswordHasher {
  let dummyHashPromise: Promise<string> | undefined;

  return {
    hash(password) {
      return hashPassword(password);
    },
    verify(passwordHash, password) {
      return verifyPassword(passwordHash, password);
    },
    dummyHash() {
      dummyHashPromise ??= hashPassword(randomBytes(32).toString("base64url"));
      return dummyHashPromise;
    },
  };
}
