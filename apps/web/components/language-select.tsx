"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";

import { type AppLocale, localeNames, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface LanguageSelectProps {
  value: AppLocale;
  onChange: (locale: AppLocale) => void;
  id?: string;
  labelledBy?: string;
  className?: string;
}

export function LanguageSelect({
  value,
  onChange,
  id,
  labelledBy,
  className,
}: LanguageSelectProps): React.JSX.Element {
  const t = useTranslations("Common");
  const [isOpen, setIsOpen] = useState(false);
  const label = labelledBy ? undefined : t("language");

  function selectLocale(next: AppLocale): void {
    setIsOpen(false);
    if (next !== value) onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") setIsOpen(false);
  }

  return (
    <div
      className={cn("relative w-fit", className)}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="border-input bg-background text-foreground inline-flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span lang={value}>{localeNames[value]}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          aria-label={label}
          aria-labelledby={labelledBy}
          className="border-border bg-popover text-popover-foreground absolute end-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-md border py-1 shadow-md"
          onMouseDown={(event) => event.preventDefault()}
        >
          {locales.map((code) => {
            const isSelected = code === value;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  lang={code}
                  aria-selected={isSelected}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex w-full items-center px-3 py-1.5 text-start text-sm",
                    isSelected && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => selectLocale(code)}
                >
                  {localeNames[code]}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
