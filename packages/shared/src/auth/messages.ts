/**
 * Canonical English auth copy. The web `en` catalog must match these strings
 * so API clients and the English UI say the same thing (SP-012).
 */
export const AUTH_COPY = {
  registerAccepted: "Check your email to verify your account.",
  invalidCredentials: "Email or password is incorrect",
  passwordTooCommon: "This password is too common.",
  linkAlreadyUsed: "Link already used",
  linkExpired: "This link has expired. Request a new one.",
  linkInvalid: "This link is invalid. Request a new one.",
  passwordResetAccepted:
    "If an account exists for that email, we sent password reset instructions.",
  verificationResent: "If an account exists for that email, we sent a verification link.",
  passwordResetComplete: "Your password has been reset. Sign in with the new password.",
  emailVerified: "Your email is verified.",
  emailVerificationRequired: "Verify your email to use this feature.",
  oauthUnavailable: "Google sign-in is temporarily unavailable. Try again later.",
  oauthFailed: "Google sign-in failed. Try again or use email and password.",
  oauthStateInvalid: "Google sign-in failed. Start again from the sign-in page.",
  oauthLinkRequired: "Confirm your password to link Google to this account.",
  oauthUnlinkNeedsPassword: "Set a password before unlinking Google.",
  oauthNotLinked: "Google is not linked to this account.",
  oauthDisabled: "Google sign-in is not enabled.",
} as const;
