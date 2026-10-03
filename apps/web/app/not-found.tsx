import Link from "next/link";

/** Fallback when locale segment is missing (middleware normally redirects). */
export default function RootNotFound(): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
          <h1>Page not found</h1>
          <Link href="/en">Back home</Link>
        </main>
      </body>
    </html>
  );
}
