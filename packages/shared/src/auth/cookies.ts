/** httpOnly cookie that carries the short-lived access JWT. */
export const ACCESS_TOKEN_COOKIE = "sp_access";

/** httpOnly cookie that carries the opaque refresh token. */
export const REFRESH_TOKEN_COOKIE = "sp_refresh";

export interface SessionCookieOptions {
  secure: boolean;
  domain?: string | undefined;
}

export interface ParsedSessionCookie {
  name: string;
  value: string;
  maxAge: number;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  domain?: string;
}

/** Set-Cookie header for an auth cookie. SameSite stays Lax. */
export function serializeSessionCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  options: SessionCookieOptions,
): string {
  const parts = [
    `${name}=${value}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

/** Reads one Set-Cookie header. An omitted SameSite is Lax. An omitted Domain is absent. */
export function parseSessionCookie(header: string): ParsedSessionCookie | null {
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  if (!pair) return null;
  const separator = pair.indexOf("=");
  if (separator <= 0) return null;

  let maxAge = 0;
  let secure = false;
  let httpOnly = false;
  let path = "/";
  let sameSite: ParsedSessionCookie["sameSite"] = "lax";
  let domain: string | undefined;
  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split("=");
    const key = rawKey?.toLowerCase();
    const attributeValue = rest.join("=");
    if (key === "max-age") maxAge = Number(attributeValue);
    if (key === "secure") secure = true;
    if (key === "httponly") httpOnly = true;
    if (key === "path" && attributeValue.length > 0) path = attributeValue;
    if (key === "samesite") sameSite = readSameSite(attributeValue);
    if (key === "domain" && attributeValue.length > 0) domain = attributeValue;
  }

  if (!Number.isFinite(maxAge) || maxAge < 0) return null;

  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    maxAge,
    path,
    httpOnly,
    secure,
    sameSite,
    ...(domain ? { domain } : {}),
  };
}

function readSameSite(value: string): ParsedSessionCookie["sameSite"] {
  const normalized = value.toLowerCase();
  if (normalized === "strict" || normalized === "none" || normalized === "lax") return normalized;
  return "lax";
}
