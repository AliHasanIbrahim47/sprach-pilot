import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { Link } from "@/i18n/navigation";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { emailLinkStatusFromBody } from "@/lib/email-link-status";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

interface VerifyEmailPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: VerifyEmailPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  const tokenParam = (await searchParams).token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const status = await verifyStatus(token);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("verifyTitle")}</h1>
        <p aria-live="polite">{messageFor(status, t)}</p>
      </div>
      {status === "verified" ? (
        <Link href="/login" className="text-sm underline-offset-4 hover:underline">
          {t("goToSignIn")}
        </Link>
      ) : (
        <ResendVerificationForm mode="email" />
      )}
    </div>
  );
}

async function verifyStatus(
  token: string | undefined,
): Promise<"verified" | "used" | "expired" | "invalid" | "missing"> {
  if (!token) return "missing";
  try {
    await apiFetch(`/v1/auth/verify?token=${encodeURIComponent(token)}`, { forwardCookies: false });
    return "verified";
  } catch (error) {
    if (error instanceof ApiClientError) {
      return emailLinkStatusFromBody(error.body) ?? "invalid";
    }
    return "invalid";
  }
}

function messageFor(
  status: "verified" | "used" | "expired" | "invalid" | "missing",
  t: (
    key: "emailVerified" | "linkAlreadyUsed" | "linkExpired" | "linkInvalid" | "linkMissing",
  ) => string,
): string {
  if (status === "verified") return t("emailVerified");
  if (status === "used") return t("linkAlreadyUsed");
  if (status === "expired") return t("linkExpired");
  if (status === "missing") return t("linkMissing");
  return t("linkInvalid");
}
