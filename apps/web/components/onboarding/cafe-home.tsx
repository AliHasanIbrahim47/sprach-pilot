"use client";

import type { CitySuggestion } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CityPicker } from "@/components/onboarding/city-picker";
import { Button } from "@/components/ui/button";

interface CafeHomeProps {
  needsCity: boolean;
  cityName: string | null;
  onSearch: (query: string) => Promise<CitySuggestion[]>;
  onSave: (cityId: string) => Promise<boolean>;
}

export function CafeHome({
  needsCity,
  cityName,
  onSearch,
  onSave,
}: CafeHomeProps): React.JSX.Element {
  const t = useTranslations("Onboarding");
  const [isPrompting, setIsPrompting] = useState(needsCity);
  const [savedName, setSavedName] = useState(cityName);
  const [selected, setSelected] = useState<CitySuggestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleSave(): Promise<void> {
    if (!selected) return;
    setIsSaving(true);
    setHasError(false);
    try {
      const ok = await onSave(selected.id);
      if (!ok) {
        setHasError(true);
        return;
      }
      setSavedName(selected.name);
      setIsPrompting(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex max-w-lg flex-col gap-4" aria-labelledby="cafe-title">
      <h1 id="cafe-title" className="font-display text-3xl tracking-tight">
        {t("cafeTitle")}
      </h1>
      {isPrompting ? (
        <>
          <p>{t("cafeNeedsCity")}</p>
          <p className="text-muted-foreground text-sm">{t("cityPrivacy")}</p>
          <CityPicker
            selectedId={selected?.id ?? null}
            onSearch={onSearch}
            onSelect={setSelected}
          />
          {hasError ? (
            <p role="alert" className="text-destructive text-sm">
              {t("saveError")}
            </p>
          ) : null}
          <Button type="button" disabled={!selected || isSaving} onClick={() => void handleSave()}>
            {isSaving ? t("saving") : t("cafeSave")}
          </Button>
        </>
      ) : (
        <p>{t("cafeHasCity", { city: savedName ?? "" })}</p>
      )}
    </section>
  );
}
