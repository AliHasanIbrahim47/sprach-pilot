export const AUTH_FIELDS = ["email", "password", "displayName", "acceptedTerms"] as const;

export type AuthField = (typeof AUTH_FIELDS)[number];

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export function isAuthField(value: string): value is AuthField {
  return (AUTH_FIELDS as readonly string[]).includes(value);
}

/** Stable codes translated in the Auth catalog. Zod and API codes both pass through here. */
export function normalizeFieldCode(field: string, code: string): string {
  if (code === "password_too_common") return code;
  if (field === "password" && code === "too_small") return "password_too_short";
  if (field === "email") return "email_invalid";
  if (field === "displayName") return "display_name_required";
  if (field === "acceptedTerms") return "consent_required";
  return "invalid";
}

export function zodIssuesToFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; code: string }>,
): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || !isAuthField(key)) continue;
    fieldErrors[key] = normalizeFieldCode(key, issue.code);
  }
  return fieldErrors;
}
