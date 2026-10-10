import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { hasSessionCookie } from "@/lib/session-cookie";

interface MarketingLayoutProps {
  children: ReactNode;
}

export default async function MarketingLayout({
  children,
}: MarketingLayoutProps): Promise<React.JSX.Element> {
  const signedIn = await hasSessionCookie();

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
