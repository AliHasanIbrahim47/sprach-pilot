import type { EmailLinkStatus } from "./auth-action-result";

export function emailLinkStatusFromBody(body: unknown): EmailLinkStatus | undefined {
  if (typeof body !== "object" || body === null || !("errors" in body)) return undefined;
  const errors = body.errors;
  if (!Array.isArray(errors)) return undefined;
  for (const error of errors) {
    if (typeof error !== "object" || error === null || !("code" in error)) continue;
    if (error.code === "token_used") return "used";
    if (error.code === "token_expired") return "expired";
    if (error.code === "token_invalid") return "invalid";
  }
  return undefined;
}
