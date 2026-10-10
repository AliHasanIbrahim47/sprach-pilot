import { useTranslations } from "next-intl";

import { SignOutForm } from "@/components/auth/sign-out-form";
import { SiteNav } from "@/components/layout/site-nav";
import { Link } from "@/i18n/navigation";

interface SiteHeaderProps {
  signedIn: boolean;
}

export function SiteHeader({ signedIn }: SiteHeaderProps): React.JSX.Element {
  const tCommon = useTranslations("Common");

  return (
    <header className="border-border/70 bg-background/80 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-foreground text-xl tracking-tight focus-visible:outline-none"
        >
          {tCommon("appName")}
        </Link>
        <SiteNav signedIn={signedIn} signOut={<SignOutForm />} />
      </div>
    </header>
  );
}
