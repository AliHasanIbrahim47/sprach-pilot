import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">Create account</h1>
        <p className="text-muted-foreground text-sm">
          Client validation uses the shared Zod contract from{" "}
          <code className="text-xs">@sprachpilot/shared</code>. Persistence arrives in SP-012.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
