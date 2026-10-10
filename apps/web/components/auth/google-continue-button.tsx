import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { serverConfig } from "@/lib/server-config";

interface GoogleContinueButtonProps {
  returnTo?: string | null;
}

export async function GoogleContinueButton({
  returnTo = null,
}: GoogleContinueButtonProps): Promise<React.JSX.Element | null> {
  if (!serverConfig.features.googleOAuthEnabled) return null;

  const t = await getTranslations("Auth");
  const locale = await getLocale();
  const href = buildGoogleStartHref(locale, returnTo);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center gap-3">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs tracking-wide uppercase">
          {t("orDivider")}
        </span>
        <div className="bg-border h-px flex-1" />
      </div>
      <Button asChild variant="outline">
        <a href={href}>{t("continueWithGoogle")}</a>
      </Button>
    </div>
  );
}

function buildGoogleStartHref(locale: string, returnTo: string | null): string {
  const params = new URLSearchParams({ locale });
  if (returnTo) params.set("returnTo", returnTo);
  return `/api/auth/google?${params.toString()}`;
}
