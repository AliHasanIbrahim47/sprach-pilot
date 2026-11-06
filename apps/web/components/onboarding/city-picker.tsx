"use client";

import type { CitySuggestion } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CityPickerProps {
  selectedId: string | null;
  onSearch: (query: string) => Promise<CitySuggestion[]>;
  onSelect: (city: CitySuggestion) => void;
}

export function CityPicker({ selectedId, onSearch, onSelect }: CityPickerProps): React.JSX.Element {
  const t = useTranslations("Onboarding");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestId = useRef(0);

  async function handleChange(value: string): Promise<void> {
    const id = requestId.current + 1;
    requestId.current = id;
    setQuery(value);
    setHasError(false);
    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const found = await onSearch(value);
      if (requestId.current !== id) return;
      setResults(found);
    } catch {
      if (requestId.current !== id) return;
      setHasError(true);
      setResults([]);
    } finally {
      if (requestId.current === id) setIsSearching(false);
    }
  }

  const showEmpty = query.trim().length >= 2 && !isSearching && !hasError && results.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="city-query">{t("citySearch")}</Label>
      <Input
        id="city-query"
        value={query}
        autoComplete="off"
        onChange={(event) => {
          void handleChange(event.target.value);
        }}
      />
      {isSearching ? <p className="text-muted-foreground text-sm">{t("saving")}</p> : null}
      {hasError ? (
        <p role="alert" className="text-destructive text-sm">
          {t("saveError")}
        </p>
      ) : null}
      {showEmpty ? <p className="text-muted-foreground text-sm">{t("cityNone")}</p> : null}
      <ul role="listbox" aria-label={t("citySearch")} className="flex flex-col gap-1">
        {results.map((city) => {
          const isSelected = city.id === selectedId;
          return (
            <li key={city.id}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className="border-input hover:bg-accent w-full rounded-md border px-3 py-2 text-start text-sm"
                onClick={() => onSelect(city)}
              >
                {city.matchedPostalCode} {city.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
