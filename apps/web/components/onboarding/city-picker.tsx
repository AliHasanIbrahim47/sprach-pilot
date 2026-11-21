"use client";

import type { CitySuggestion } from "@sprachpilot/shared";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CityPickerProps {
  selectedId: string | null;
  selectedLabel?: string | null;
  onSearch: (query: string) => Promise<CitySuggestion[]>;
  onSelect: (city: CitySuggestion) => void;
}

/**
 * Searches cities as the learner types and keeps only the latest response.
 */
export function CityPicker({
  selectedId,
  selectedLabel = null,
  onSearch,
  onSelect,
}: CityPickerProps): React.JSX.Element {
  const t = useTranslations("Onboarding");
  const [query, setQuery] = useState(selectedLabel ?? "");
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestId = useRef(0);

  /**
   * Queries once the text is long enough, and ignores a response from an older keystroke.
   */
  async function handleChange(value: string): Promise<void> {
    const id = requestId.current + 1;
    requestId.current = id;
    setQuery(value);
    setHasError(false);
    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    try {
      const found = await onSearch(value);
      if (requestId.current !== id) return;
      setResults(found);
      setHasSearched(true);
    } catch {
      if (requestId.current !== id) return;
      setHasError(true);
      setHasSearched(false);
      setResults([]);
    } finally {
      if (requestId.current === id) setIsSearching(false);
    }
  }

  const showEmpty = hasSearched && !isSearching && !hasError && results.length === 0;

  /**
   * Writes the city into the field and closes the menu.
   */
  function choose(city: CitySuggestion): void {
    requestId.current += 1;
    setQuery(city.name);
    setResults([]);
    setIsSearching(false);
    setHasSearched(false);
    setHasError(false);
    onSelect(city);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="city-query">{t("citySearch")}</Label>
      <div className="relative">
        <Input
          id="city-query"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="city-results"
          aria-autocomplete="list"
          onChange={(event) => {
            void handleChange(event.target.value);
          }}
        />
        {results.length > 0 ? (
          <ul
            id="city-results"
            role="listbox"
            aria-label={t("citySearch")}
            className="border-border bg-popover text-popover-foreground absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border py-1 shadow-md"
          >
            {results.map((city) => {
              const isSelected = city.id === selectedId;
              return (
                <li key={city.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start text-sm"
                    onClick={() => choose(city)}
                  >
                    <span>{city.name}</span>
                    <span className="text-muted-foreground">{city.matchedPostalCode}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {isSearching ? <p className="text-muted-foreground text-sm">{t("citySearching")}</p> : null}
      {hasError ? (
        <p role="alert" className="text-destructive text-sm">
          {t("citySearchError")}
        </p>
      ) : null}
      {showEmpty ? <p className="text-muted-foreground text-sm">{t("cityNone")}</p> : null}
    </div>
  );
}
