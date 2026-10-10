import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/components/auth/sign-out-form", () => ({
  SignOutForm: () => <button type="submit">Sign out</button>,
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

afterEach(() => {
  cleanup();
});

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
    renderWithIntl(<SiteHeader signedIn={false} />);
    expect(screen.getByRole("link", { name: /sprachpilot/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("replaces sign in with sign out when a session cookie is present", () => {
    renderWithIntl(<SiteHeader signedIn />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("opens the navigation from the menu button", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SiteHeader signedIn={false} />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getAllByRole("link", { name: "Home" }).length).toBeGreaterThan(1);
  });

  it("renders Arabic navigation labels when locale is ar", () => {
    renderWithIntl(<SiteHeader signedIn={false} />, "ar", ar);
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
