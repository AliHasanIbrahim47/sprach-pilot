import { useTranslations } from "next-intl";

export function SiteFooter(): React.JSX.Element {
  const t = useTranslations("Footer");
  const tCommon = useTranslations("Common");

  return (
    <footer className="border-border mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display text-foreground">{tCommon("appName")}</span>
          {" — "}
          {t("tagline")}
        </p>
        <p>{t("platform")}</p>
      </div>
    </footer>
  );
}
