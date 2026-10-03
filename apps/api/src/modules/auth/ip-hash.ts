import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 of a client IP. The raw address is never stored. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/**
 * Redis key material for an email + IP pair.
 * The email stays out of Redis; the secret is the IP hash pepper.
 */
export function loginSubjectKey(email: string, ipHash: string, secret: string): string {
  return createHmac("sha256", secret).update(`${email}\n${ipHash}`).digest("hex");
}

export function secretsEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
