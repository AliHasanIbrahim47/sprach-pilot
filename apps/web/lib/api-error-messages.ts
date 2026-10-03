import { ERROR_TYPE_BASE } from "@sprachpilot/shared";

const KNOWN_CODES = [
  "validation",
  "unauthorized",
  "forbidden",
  "not-found",
  "conflict",
  "rate-limited",
  "external-service",
  "internal",
] as const;

export type ApiErrorCode = (typeof KNOWN_CODES)[number];

/** Map an RFC 9457 `type` URI (or bare code) to an `Errors.*` message key. */
export function apiErrorTypeToMessageKey(typeOrCode: string): `Errors.${ApiErrorCode}` {
  const code = typeOrCode.startsWith(`${ERROR_TYPE_BASE}/`)
    ? typeOrCode.slice(ERROR_TYPE_BASE.length + 1)
    : typeOrCode;

  if ((KNOWN_CODES as readonly string[]).includes(code)) {
    return `Errors.${code as ApiErrorCode}`;
  }

  return "Errors.internal";
}
