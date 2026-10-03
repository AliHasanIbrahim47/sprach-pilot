import type { ReactNode } from "react";

interface RootLayoutProps {
  children: ReactNode;
}

/** Root shell — locale-specific `<html>` / `<body>` live under `[locale]`. */
export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
  return children as React.JSX.Element;
}
