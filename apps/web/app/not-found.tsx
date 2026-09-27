import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-start justify-center gap-4 px-4 py-16">
      <p className="text-primary text-sm font-medium tracking-wide uppercase">404</p>
      <h1 className="font-display text-3xl tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        That route does not exist. Head back to the landing page.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
