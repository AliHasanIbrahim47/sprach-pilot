import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { hasSessionCookie } from "@/lib/session-cookie";

interface AuthLayoutProps {
  children: ReactNode;
}

export default async function AuthLayout({
  children,
}: AuthLayoutProps): Promise<React.JSX.Element> {
  const signedIn = await hasSessionCookie();

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
