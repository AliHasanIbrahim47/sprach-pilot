import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipToContent } from "@/components/layout/skip-to-content";

describe("layout components", () => {
  it("renders skip-to-content as the first interactive target", () => {
    const { container } = render(<SkipToContent />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(container.firstElementChild).toBe(link);
  });

  it("renders the site header with brand and primary navigation", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /sprachpilot/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("renders the site footer with brand copy", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/german for real life/i)).toBeInTheDocument();
  });
});
