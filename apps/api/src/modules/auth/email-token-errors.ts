import { AUTH_COPY, ConflictError, ValidationError } from "@sprachpilot/shared";

export function emailTokenUsed(): ConflictError {
  return new ConflictError(AUTH_COPY.linkAlreadyUsed, {
    errors: [{ field: "token", code: "token_used", message: AUTH_COPY.linkAlreadyUsed }],
  });
}

export function emailTokenExpired(): ValidationError {
  return new ValidationError({
    detail: AUTH_COPY.linkExpired,
    errors: [{ field: "token", code: "token_expired", message: AUTH_COPY.linkExpired }],
  });
}

export function emailTokenInvalid(): ValidationError {
  return new ValidationError({
    detail: AUTH_COPY.linkInvalid,
    errors: [{ field: "token", code: "token_invalid", message: AUTH_COPY.linkInvalid }],
  });
}
