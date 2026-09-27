export default function Loading(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-24">
      <p className="text-muted-foreground text-sm" role="status">
        Loading…
      </p>
    </div>
  );
}
