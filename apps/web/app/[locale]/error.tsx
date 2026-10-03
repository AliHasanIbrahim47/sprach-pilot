"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorPageProps): React.JSX.Element {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-start justify-center gap-4 px-4 py-16">
      <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("body")}</p>
      <Button type="button" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
