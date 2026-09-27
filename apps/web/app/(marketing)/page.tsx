import Link from "next/link";

import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/config";

export default function LandingPage(): React.JSX.Element {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_195)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.985_0.006_220)_0%,_oklch(0.96_0.02_210)_100%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.05_210)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.18_0.025_230)_0%,_oklch(0.16_0.03_220)_100%)]"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <p className="font-display text-primary text-4xl tracking-tight sm:text-5xl lg:text-6xl">
          {appConfig.name}
        </p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Learn German for the situations that actually matter.
        </h1>
        <p className="text-muted-foreground max-w-xl text-base text-pretty sm:text-lg">
          Practice Bürgeramt dialogues, turn documents into vocabulary decks, and find a Sprachcafé
          — all on a stack you host yourself.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">Open app</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
