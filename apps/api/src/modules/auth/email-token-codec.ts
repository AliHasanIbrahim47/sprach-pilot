import { createHmac, randomBytes } from "node:crypto";

/** 32 bytes is 256 bits of entropy (NFR-1). */
const TOKEN_BYTES = 32;

export interface EmailTokenCodec {
  create(): string;
  hash(token: string): string;
}

/**
 * Raw tokens travel only in the email link and the queue payload.
 * The database stores an HMAC so a leaked row cannot be replayed.
 * The prefix keeps this digest distinct from refresh-token HMACs.
 */
export function createEmailTokenCodec(pepper: string): EmailTokenCodec {
  return {
    create() {
      return randomBytes(TOKEN_BYTES).toString("base64url");
    },
    hash(token) {
      return createHmac("sha256", pepper).update(`email-token:v1:${token}`).digest("hex");
    },
  };
}
