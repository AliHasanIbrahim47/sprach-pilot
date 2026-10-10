"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";

const linkClassName =
  "text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors";

interface SiteNavProps {
  signedIn: boolean;
  signOut: ReactNode;
}

export function SiteNav({ signedIn, signOut }: SiteNavProps): React.JSX.Element {
  const tNav = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu(): void {
    setIsOpen(false);
  }

  function renderLinks(itemClassName: string): React.JSX.Element {
    return (
      <>
        <Link href="/" className={itemClassName} onClick={closeMenu}>
          {tNav("home")}
        </Link>
        {signedIn ? (
          signOut
        ) : (
          <Link href="/login" className={itemClassName} onClick={closeMenu}>
            {tNav("signIn")}
          </Link>
        )}
        <Link href="/dashboard" className={itemClassName} onClick={closeMenu}>
          {tNav("app")}
        </Link>
      </>
    );
  }

  return (
    <>
      <nav
        aria-label={tCommon("primaryNav")}
        className="hidden items-center gap-1 sm:flex sm:gap-2"
      >
        {renderLinks(linkClassName)}
        <LanguageSwitcher />
        <ThemeToggle />
      </nav>

      <div
        className="sm:hidden"
        onKeyDown={(event) => {
          if (event.key === "Escape") closeMenu();
        }}
      >
        <button
          type="button"
          className="text-foreground hover:bg-accent inline-flex size-10 items-center justify-center rounded-md"
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          aria-label={isOpen ? tNav("closeMenu") : tNav("openMenu")}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        {isOpen ? (
          <nav
            id="mobile-nav"
            aria-label={tCommon("primaryNav")}
            className="border-border bg-background absolute inset-x-0 top-16 z-40 flex flex-col gap-1 border-b px-4 py-3 shadow-md"
          >
            {renderLinks(`${linkClassName} w-full text-start`)}
            <div className="mt-2 flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </nav>
        ) : null}
      </div>
    </>
  );
}
