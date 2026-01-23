export default function CategoryLoading() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

