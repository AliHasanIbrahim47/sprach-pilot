export interface AuthTranslator {
  (key: AuthMessageKey): string;
}

type AuthMessageKey =
  | "passwordTooShort"
  | "passwordTooCommon"
  | "emailInvalid"
  | "displayNameRequired"
  | "consentRequired"
  | "invalidField";

export function fieldMessage(code: string, t: AuthTranslator): string {
  switch (code) {
    case "password_too_short":
      return t("passwordTooShort");
    case "password_too_common":
      return t("passwordTooCommon");
    case "email_invalid":
      return t("emailInvalid");
    case "display_name_required":
      return t("displayNameRequired");
    case "consent_required":
      return t("consentRequired");
    default:
      return t("invalidField");
  }
}
