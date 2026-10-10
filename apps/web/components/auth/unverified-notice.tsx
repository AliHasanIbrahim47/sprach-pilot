import { getTranslations } from "next-intl/server";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { getAccount } from "@/lib/account";

export async function UnverifiedNotice(): Promise<React.JSX.Element | null> {
  const account = await getAccount();
  if (!account || account.emailVerified) return null;
  const t = await getTranslations("Auth");

  return (
    <section className="mb-8 rounded-md border border-border bg-muted px-4 py-3" role="status">
      <p className="mb-3 text-sm">{t("verifyToContinue")}</p>
      <ResendVerificationForm mode="account" />
    </section>
  );
}
