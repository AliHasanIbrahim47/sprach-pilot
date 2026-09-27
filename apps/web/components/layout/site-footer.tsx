import { appConfig } from "@/lib/config";

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-border mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display text-foreground">{appConfig.name}</span>
          {" — "}
          German for real life.
        </p>
        <p>Self-hosted learning platform.</p>
      </div>
    </footer>
  );
}
