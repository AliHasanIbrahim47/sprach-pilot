import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): React.JSX.Element {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
