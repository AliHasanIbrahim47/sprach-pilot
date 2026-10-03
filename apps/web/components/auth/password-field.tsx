"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  showLabel: string;
  hideLabel: string;
  error: string | undefined;
}

export function PasswordField({
  name,
  label,
  autoComplete,
  showLabel,
  hideLabel,
  error,
}: PasswordFieldProps): React.JSX.Element {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={generatedId}>{label}</Label>
      <div className="relative">
        <Input
          id={generatedId}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          className="pe-12"
          {...(error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {})}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute end-0 top-0"
          aria-pressed={isVisible}
          aria-label={isVisible ? hideLabel : showLabel}
          onClick={() => {
            setIsVisible((current) => !current);
          }}
        >
          {isVisible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
