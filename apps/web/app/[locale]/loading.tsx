import { getTranslations } from "next-intl/server";

export default async function Loading(): Promise<React.JSX.Element> {
  const t = await getTranslations("Common");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-24">
      <p className="text-muted-foreground text-sm" role="status">
        {t("loading")}
      </p>
    </div>
  );
}
