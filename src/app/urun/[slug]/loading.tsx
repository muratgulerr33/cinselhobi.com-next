export default function ProductLoading() {
  return (
    <div className="space-y-6 pb-24">
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

