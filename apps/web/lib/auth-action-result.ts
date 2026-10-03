import type { AuthFieldErrors } from "./auth-field-errors";

export type AuthActionCode =
  "validation" | "unauthorized" | "forbidden" | "rate-limited" | "internal";

export type AuthActionResult =
  | { ok: true; intent: "register" | "login" }
  | {
      ok: false;
      code: AuthActionCode;
      fieldErrors?: AuthFieldErrors;
      retryAfterSeconds?: number;
    };
