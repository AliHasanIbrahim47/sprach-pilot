import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppShellLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6"
      >
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
