/** Binds a download to one export and one user until `expiresAt`. */
export async function signExportToken(input: {
  secret: string;
  exportId: string;
  userId: string;
  expiresAt: Date;
}): Promise<string> {
  const expiresAtMs = input.expiresAt.getTime();
  const payload = `${input.exportId}.${input.userId}.${expiresAtMs}`;
  const mac = await hmacSha256Base64Url(input.secret, payload);
  return `${expiresAtMs}.${mac}`;
}

export async function verifyExportToken(input: {
  secret: string;
  exportId: string;
  userId: string;
  token: string;
  now: Date;
}): Promise<boolean> {
  const separator = input.token.indexOf(".");
  if (separator <= 0) return false;
  const expiresAtMs = Number(input.token.slice(0, separator));
  const mac = input.token.slice(separator + 1);
  if (!Number.isFinite(expiresAtMs) || input.now.getTime() > expiresAtMs) return false;
  const expected = await signExportToken({
    secret: input.secret,
    exportId: input.exportId,
    userId: input.userId,
    expiresAt: new Date(expiresAtMs),
  });
  const expectedMac = expected.slice(expected.indexOf(".") + 1);
  const provided = base64UrlToBytes(mac);
  const target = base64UrlToBytes(expectedMac);
  if (!provided || !target) return false;
  return sameBytes(provided, target);
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (value.length === 0) return null;
  try {
    const padding = (4 - (value.length % 4)) % 4;
    const base64 = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(padding)}`;
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  const rightBytes = right.values();
  for (const byte of left) mismatch |= byte ^ (rightBytes.next().value ?? 0);
  return mismatch === 0;
}
