"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";

import { type AppLocale, localeNames, locales } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LanguageSwitcher(): React.JSX.Element {
  const t = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  function selectLocale(next: AppLocale): void {
    setIsOpen(false);
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") setIsOpen(false);
  }

  return (
    <div
      className="relative"
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={t("language")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="border-input bg-background text-foreground inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{localeNames[locale]}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          aria-label={t("language")}
          className="border-border bg-popover text-popover-foreground absolute end-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-md border py-1 shadow-md"
          onMouseDown={(event) => event.preventDefault()}
        >
          {locales.map((code) => {
            const isSelected = code === locale;
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
