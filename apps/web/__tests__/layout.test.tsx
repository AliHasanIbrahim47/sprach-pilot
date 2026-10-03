import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: ({
      children,
      href,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    usePathname: () => "/",
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    redirect: vi.fn(),
    getPathname: vi.fn(),
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { getLocaleDirection } from "@/i18n/config";
import { apiErrorTypeToMessageKey } from "@/lib/api-error-messages";

function renderWithIntl(ui: ReactNode, locale = "en", messages: typeof en = en) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("layout components", () => {
  it("renders skip-to-content as the first interactive target", () => {
    const { container } = renderWithIntl(<SkipToContent />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(container.firstElementChild).toBe(link);
  });

  it("renders the site header with brand and primary navigation", () => {
    renderWithIntl(<SiteHeader />);
    expect(screen.getByRole("link", { name: /sprachpilot/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("renders Arabic navigation labels when locale is ar", () => {
    renderWithIntl(<SiteHeader />, "ar", ar);
    expect(screen.getByRole("link", { name: "الرئيسية" })).toBeInTheDocument();
  });

  it("renders the site footer with brand copy", () => {
    renderWithIntl(<SiteFooter />);
    expect(screen.getByText(/german for real life/i)).toBeInTheDocument();
  });
});

describe("i18n helpers", () => {
  it("marks Arabic as RTL", () => {
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("en")).toBe("ltr");
  });

  it("maps API error type URIs to Errors message keys", () => {
    expect(apiErrorTypeToMessageKey("https://sprachpilot.app/errors/not-found")).toBe(
      "Errors.not-found",
    );
    expect(apiErrorTypeToMessageKey("conflict")).toBe("Errors.conflict");
    expect(apiErrorTypeToMessageKey("https://sprachpilot.app/errors/unknown")).toBe(
      "Errors.internal",
    );
  });
});
