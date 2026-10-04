import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAMES = new Set<string>([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);

export interface ParsedSetCookie {
  name: string;
  value: string;
  maxAge: number;
  secure: boolean;
  path: string;
}

export function parseSetCookie(header: string): ParsedSetCookie | null {
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  if (!pair) return null;
  const separator = pair.indexOf("=");
  if (separator <= 0) return null;

  let maxAge = 0;
  let secure = false;
  let path = "/";
  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split("=");
    const key = rawKey?.toLowerCase();
    const attributeValue = rest.join("=");
    if (key === "max-age") maxAge = Number(attributeValue);
    if (key === "secure") secure = true;
    if (key === "path" && attributeValue.length > 0) path = attributeValue;
  }

  if (!Number.isFinite(maxAge) || maxAge < 0) return null;

  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    maxAge,
    secure,
    path,
  };
}

/** Copy API auth cookies onto the Next.js response. Token strings stay httpOnly. */
export async function applyUpstreamAuthCookies(setCookies: readonly string[]): Promise<void> {
  const store = await cookies();
  for (const header of setCookies) {
    const parsed = parseSetCookie(header);
    if (!parsed || !AUTH_COOKIE_NAMES.has(parsed.name)) continue;
    if (parsed.maxAge === 0 || parsed.value.length === 0) {
      store.delete(parsed.name);
      continue;
    }
    store.set(parsed.name, parsed.value, {
      httpOnly: true,
      secure: parsed.secure,
      sameSite: "lax",
      path: parsed.path,
      maxAge: parsed.maxAge,
    });
  }
}
