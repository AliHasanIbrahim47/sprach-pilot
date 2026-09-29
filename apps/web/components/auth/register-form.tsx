"use client";

import { type RegisterBody, registerBodySchema } from "@sprachpilot/shared";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

type FieldErrors = Partial<Record<keyof RegisterBody | "_root", string>>;

export function RegisterForm(): React.JSX.Element {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const parsed = registerBodySchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
      acceptedTerms: formData.get("acceptedTerms") === "on",
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as keyof RegisterBody | undefined) ?? "_root";
        nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setMessage("Looks valid. API registration lands in SP-012.");
  }

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="border-input bg-background rounded-md border px-3 py-2"
        />
        {errors.email ? <span className="text-destructive text-xs">{errors.email}</span> : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Display name</span>
        <input
          name="displayName"
          type="text"
          autoComplete="nickname"
          className="border-input bg-background rounded-md border px-3 py-2"
        />
        {errors.displayName ? (
          <span className="text-destructive text-xs">{errors.displayName}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          className="border-input bg-background rounded-md border px-3 py-2"
        />
        {errors.password ? (
          <span className="text-destructive text-xs">{errors.password}</span>
        ) : null}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input name="acceptedTerms" type="checkbox" />
        <span>I accept the Terms and Privacy Policy</span>
      </label>
      {errors.acceptedTerms ? (
        <span className="text-destructive text-xs">{errors.acceptedTerms}</span>
      ) : null}

      <Button type="submit">Create account</Button>
      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
    </form>
  );
}
