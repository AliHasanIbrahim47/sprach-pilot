import type { AuthFieldErrors } from "./auth-field-errors";

export type AuthActionCode =
  "validation" | "unauthorized" | "forbidden" | "rate-limited" | "internal";

export type EmailLinkStatus = "used" | "expired" | "invalid";

export type AuthActionResult =
  | { ok: true; intent: "register" | "login" | "forgot" | "resend" | "reset" }
  | {
      ok: false;
      code: AuthActionCode;
      fieldErrors?: AuthFieldErrors;
      retryAfterSeconds?: number;
      linkStatus?: EmailLinkStatus;
    };
