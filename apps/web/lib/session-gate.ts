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
    path.startsWith("/app/")
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

/** Relative in-app path safe to use as a post-login redirect. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.includes("\\") || value.includes("://")) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return null;
  if (decoded.includes("://")) return null;
  return value;
}
