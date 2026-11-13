import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { emailLinkStatusFromBody } from "@/lib/email-link-status";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

interface ConfirmEmailPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

/**
 * Applies a new login email after the learner opens the confirmation link.
 * Until this succeeds, sign-in still uses the previous address.
 */
export default async function ConfirmEmailPage({
  params,
  searchParams,
}: ConfirmEmailPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tAuth] = await Promise.all([getTranslations("Settings"), getTranslations("Auth")]);
  const tokenParam = (await searchParams).token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const status = await confirmStatus(token);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl tracking-tight">{t("confirmEmailTitle")}</h1>
      <p role="status">{messageFor(status, t, tAuth)}</p>
      <Link href="/login" className="text-sm underline-offset-4 hover:underline">
        {tAuth("goToSignIn")}
      </Link>
    </div>
  );
}

async function confirmStatus(
  token: string | undefined,
): Promise<"confirmed" | "used" | "expired" | "invalid" | "missing"> {
  if (!token) return "missing";
  try {
    await apiFetch("/v1/settings/email/confirm", {
      method: "POST",
      forwardCookies: false,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return "confirmed";
  } catch (error) {
    if (error instanceof ApiClientError) {
      return emailLinkStatusFromBody(error.body) ?? "invalid";
    }
    return "invalid";
  }
}

function messageFor(
  status: "confirmed" | "used" | "expired" | "invalid" | "missing",
  t: (key: "emailConfirmed") => string,
  tAuth: (key: "linkAlreadyUsed" | "linkExpired" | "linkInvalid" | "linkMissing") => string,
): string {
  if (status === "confirmed") return t("emailConfirmed");
  if (status === "used") return tAuth("linkAlreadyUsed");
  if (status === "expired") return tAuth("linkExpired");
  if (status === "missing") return tAuth("linkMissing");
  return tAuth("linkInvalid");
}
