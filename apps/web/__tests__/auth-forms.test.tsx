import { AUTH_COPY } from "@sprachpilot/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../messages/en.json";

const registerAccount = vi.fn();
const loginAccount = vi.fn();
const { routerReplace } = vi.hoisted(() => ({ routerReplace: vi.fn() }));

vi.mock("@/lib/auth-actions", () => ({
  registerAccount: (...args: unknown[]) => registerAccount(...args),
  loginAccount: (...args: unknown[]) => loginAccount(...args),
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
  useRouter: () => ({ replace: routerReplace }),
}));

import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

afterEach(() => {
  cleanup();
});

function renderForm(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("auth copy", () => {
  it("keeps the English catalog aligned with the API strings", () => {
    expect(en.Auth.verifyEmail).toBe(AUTH_COPY.registerAccepted);
    expect(en.Auth.invalidCredentials).toBe(AUTH_COPY.invalidCredentials);
    expect(en.Auth.passwordTooCommon).toBe(AUTH_COPY.passwordTooCommon);
    expect(en.Auth.linkAlreadyUsed).toBe(AUTH_COPY.linkAlreadyUsed);
    expect(en.Auth.passwordResetAccepted).toBe(AUTH_COPY.passwordResetAccepted);
    expect(en.Auth.verificationSent).toBe(AUTH_COPY.verificationResent);
    expect(en.Auth.passwordResetComplete).toBe(AUTH_COPY.passwordResetComplete);
    expect(en.Auth.emailVerified).toBe(AUTH_COPY.emailVerified);
    expect(en.Auth.linkExpired).toBe(AUTH_COPY.linkExpired);
    expect(en.Auth.linkInvalid).toBe(AUTH_COPY.linkInvalid);
  });
});

describe("register form", () => {
  beforeEach(() => {
    registerAccount.mockReset();
  });

  it("labels every field and announces validation errors", async () => {
    const user = userEvent.setup();
    renderForm(<RegisterForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("I accept the Terms and Privacy Policy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create account" }));

    const live = screen.getByText("Check this field.");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(
      screen.getByText("Accept the Terms and Privacy Policy to continue."),
    ).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderForm(<RegisterForm />);

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("tells the learner to verify email after a valid registration", async () => {
    registerAccount.mockResolvedValue({ ok: true, intent: "register" });
    const user = userEvent.setup();
    renderForm(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Display name"), "Ada");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByLabelText("I accept the Terms and Privacy Policy"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(AUTH_COPY.registerAccepted)).toBeInTheDocument();
    expect(registerAccount).toHaveBeenCalledOnce();
  });

  it("shows a common-password rejection from the API", async () => {
    registerAccount.mockResolvedValue({
      ok: false,
      code: "validation",
      fieldErrors: { password: "password_too_common" },
    });
    const user = userEvent.setup();
    renderForm(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Display name"), "Ada");
    await user.type(screen.getByLabelText("Password"), "password12345");
    await user.click(screen.getByLabelText("I accept the Terms and Privacy Policy"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(AUTH_COPY.passwordTooCommon)).toBeInTheDocument();
  });
});

describe("login form", () => {
  beforeEach(() => {
    loginAccount.mockReset();
    routerReplace.mockReset();
  });

  it("shows the generic credential error", async () => {
    loginAccount.mockResolvedValue({ ok: false, code: "unauthorized" });
    const user = userEvent.setup();
    renderForm(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Password"), "not-the-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(AUTH_COPY.invalidCredentials)).toBeInTheDocument();
  });

  it("continues to the requested path after a successful sign-in", async () => {
    loginAccount.mockResolvedValue({ ok: true, intent: "login" });
    const user = userEvent.setup();
    renderForm(<LoginForm nextPath="/app/decks" />);

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(routerReplace).toHaveBeenCalledWith("/app/decks");
  });
});
