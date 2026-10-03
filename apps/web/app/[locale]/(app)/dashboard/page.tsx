import { getTranslations, setRequestLocale } from "next-intl/server";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({
  params,
}: DashboardPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("App");

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-3xl tracking-tight">{t("dashboardTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("dashboardBody")}</p>
    </div>
  );
}
