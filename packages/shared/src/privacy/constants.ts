/** How long a learner can sign in to cancel erasure, and how long an export link works. */
export const GDPR_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const DELETED_USER_LABEL = "Deleted user";

/** Version stamped on consent changes made from the privacy settings. */
export const PRIVACY_CONSENT_VERSION = "2026-11-14";

/** Captured at registration. Withdrawing these requires deleting the account. */
export const REQUIRED_CONSENT_POLICIES = ["terms", "privacy"] as const;

/** May be granted or withdrawn without closing the account. */
export const OPTIONAL_CONSENT_POLICIES = [
  "recording_storage",
  "product_emails",
  "analytics",
] as const;

/**
 * Every feature that stores personal data registers one of these ids.
 * A missing id fails the privacy domain test.
 */
export const REQUIRED_PRIVACY_DOMAINS = ["identity", "avatars", "recordings", "tandem"] as const;

export type RequiredPrivacyDomain = (typeof REQUIRED_PRIVACY_DOMAINS)[number];

/**
 * Columns marked `/// @pii` in the Prisma schema.
 * The API test fails when the schema and this list disagree.
 */
export const PII_COLUMNS = [
  "User.email",
  "User.passwordHash",
  "User.displayName",
  "Profile.nativeLanguages",
  "Profile.cityName",
  "Profile.avatarUrl",
  "ConsentRecord.ipHash",
  "Session.userAgent",
  "Session.ipHash",
  "AuditLog.ipHash",
  "PendingEmail.email",
] as const;

export function anonymizedEmail(userId: string): string {
  return `deleted+${userId}@users.invalid`;
}

export function isOptionalConsentPolicy(policy: string): boolean {
  return (OPTIONAL_CONSENT_POLICIES as readonly string[]).includes(policy);
}
