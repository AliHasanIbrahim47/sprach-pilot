import { useTranslations } from "next-intl";

export function SkipToContent(): React.JSX.Element {
  const t = useTranslations("Common");

  return (
    <a
      href="#main-content"
      className="bg-primary text-primary-foreground focus:ring-ring absolute start-4 top-4 z-50 -translate-y-16 rounded-md px-4 py-2 text-sm font-medium transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2"
    >
      {t("skipToContent")}
    </a>
  );
}
