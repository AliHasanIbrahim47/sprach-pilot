import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";

const navItems = [
  { href: "/", labelKey: "home" as const },
  { href: "/login", labelKey: "signIn" as const },
  { href: "/dashboard", labelKey: "app" as const },
] as const;

export function SiteHeader(): React.JSX.Element {
  const tNav = useTranslations("Nav");
  const tCommon = useTranslations("Common");

  return (
    <header className="border-border/70 bg-background/80 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-foreground text-xl tracking-tight focus-visible:outline-none"
        >
          {tCommon("appName")}
        </Link>
        <nav aria-label={tCommon("primaryNav")} className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              {tNav(item.labelKey)}
            </Link>
          ))}
          <LanguageSwitcher />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
