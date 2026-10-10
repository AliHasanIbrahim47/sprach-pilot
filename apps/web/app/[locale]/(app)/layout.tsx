import { type ReactNode, Suspense } from "react";

import { UnverifiedNotice } from "@/components/auth/unverified-notice";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { hasSessionCookie } from "@/lib/session-cookie";

interface AppLayoutProps {
  children: ReactNode;
}

export default async function AppShellLayout({
  children,
}: AppLayoutProps): Promise<React.JSX.Element> {
  const signedIn = await hasSessionCookie();

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6"
      >
        <Suspense fallback={null}>
          <UnverifiedNotice />
        </Suspense>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
