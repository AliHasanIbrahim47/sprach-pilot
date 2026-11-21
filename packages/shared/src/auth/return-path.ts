import { UI_LOCALES } from "../locale.js";

const localeSet = new Set<string>(UI_LOCALES);

/**
 * In-app path safe to open after sign-in.
 * A leading locale is removed so the caller can add its own.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
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

  const segment = decoded.split("/")[1];
  if (!segment || !localeSet.has(segment)) return decoded;
  const rest = decoded.slice(segment.length + 1);
  return rest.length > 0 ? rest : "/";
}
