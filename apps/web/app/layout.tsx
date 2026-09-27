import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s · ${appConfig.name}`,
  },
  description: "Self-hosted German language learning for everyday life in Germany.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <ThemeProvider>
          <SkipToContent />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
