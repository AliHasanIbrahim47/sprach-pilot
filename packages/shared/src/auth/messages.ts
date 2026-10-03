/**
 * Canonical English auth copy. The web `en` catalog must match these strings
 * so API clients and the English UI say the same thing (SP-012).
 */
export const AUTH_COPY = {
  registerAccepted: "Check your email to verify your account.",
  invalidCredentials: "Email or password is incorrect",
  passwordTooCommon: "This password is too common.",
} as const;
