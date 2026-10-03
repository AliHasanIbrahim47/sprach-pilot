import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound(): Promise<React.JSX.Element> {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-start justify-center gap-4 px-4 py-16">
      <p className="text-primary text-sm font-medium tracking-wide uppercase">{t("code")}</p>
      <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("body")}</p>
      <Button asChild>
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
