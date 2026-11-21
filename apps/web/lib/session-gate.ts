import { locales } from "@/i18n/config";

const localeSet = new Set<string>(locales);

/**
 * Path after the locale prefix. `/en/app/decks` becomes `/app/decks`.
 * Paths without a known locale are returned unchanged.
 */
export function pathWithoutLocale(pathname: string): string {
  const segment = pathname.split("/")[1];
  if (!segment || !localeSet.has(segment)) return pathname;
  const rest = pathname.slice(segment.length + 1);
  return rest.length > 0 ? rest : "/";
}

export function localeFromPathname(pathname: string): string {
  const segment = pathname.split("/")[1];
  if (segment && localeSet.has(segment)) return segment;
  return "en";
}

/** True for the authenticated `(app)` URLs, including `/dashboard` and `/app/*`. */
export function isProtectedAppPath(pathname: string): boolean {
  const path = pathWithoutLocale(pathname);
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/onboarding" ||
    path.startsWith("/onboarding/") ||
    path === "/app" ||
    path.startsWith("/app/") ||
    path === "/settings" ||
    path.startsWith("/settings/")
  );
}

export type SessionGate = "continue" | "refresh" | "login";

export function decideSessionGate(input: {
  pathname: string;
  accessValid: boolean;
  hasRefreshCookie: boolean;
}): SessionGate {
  if (!isProtectedAppPath(input.pathname)) return "continue";
  if (input.accessValid) return "continue";
  if (input.hasRefreshCookie) return "refresh";
  return "login";
}

/** Localized login URL that preserves the in-app path the visitor asked for. */
export function loginRedirectUrl(requestUrl: URL): URL {
  const locale = localeFromPathname(requestUrl.pathname);
  const next = pathWithoutLocale(requestUrl.pathname) + requestUrl.search;
  const target = new URL(`/${locale}/login`, requestUrl.origin);
  target.searchParams.set("next", next);
  return target;
}

/**
 * Cookie header for the rest of this request after the API rotates auth cookies.
 * The browser only sees the new cookies on the response, so the page render must be told too.
 */
export function applySetCookies(current: string | null, setCookies: readonly string[]): string {
  const jar = new Map<string, string>();
  if (current) {
    for (const part of current.split(";")) {
      const trimmed = part.trim();
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      jar.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
    }
  }
  for (const header of setCookies) {
    const pair = header.split(";")[0]?.trim() ?? "";
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}
