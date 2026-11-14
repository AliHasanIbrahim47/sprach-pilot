import { createHmac, timingSafeEqual } from "node:crypto";

/** Binds a download to one export and one user until `expiresAt`. */
export function signExportToken(input: {
  secret: string;
  exportId: string;
  userId: string;
  expiresAt: Date;
}): string {
  const expiresAtMs = input.expiresAt.getTime();
  const payload = `${input.exportId}.${input.userId}.${expiresAtMs}`;
  const mac = createHmac("sha256", input.secret).update(payload).digest("base64url");
  return `${expiresAtMs}.${mac}`;
}

export function verifyExportToken(input: {
  secret: string;
  exportId: string;
  userId: string;
  token: string;
  now: Date;
}): boolean {
  const separator = input.token.indexOf(".");
  if (separator <= 0) return false;
  const expiresAtMs = Number(input.token.slice(0, separator));
  const mac = input.token.slice(separator + 1);
  if (!Number.isFinite(expiresAtMs) || input.now.getTime() > expiresAtMs) return false;
  const expected = signExportToken({
    secret: input.secret,
    exportId: input.exportId,
    userId: input.userId,
    expiresAt: new Date(expiresAtMs),
  });
  const expectedMac = expected.slice(expected.indexOf(".") + 1);
  const provided = Buffer.from(mac);
  const target = Buffer.from(expectedMac);
  if (provided.length !== target.length) return false;
  return timingSafeEqual(provided, target);
}
