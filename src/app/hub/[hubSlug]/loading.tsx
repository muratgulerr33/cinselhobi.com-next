export default function HubDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link skeleton */}
      <div className="h-11 w-32 bg-muted rounded-md animate-pulse" />

      {/* Hero skeleton */}
      <div className="relative overflow-hidden rounded-2xl border h-[280px] sm:h-[320px] bg-muted animate-pulse" />

      {/* Text skeletons */}
      <div className="space-y-2 px-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>

      {/* CTA skeleton */}
      <div className="px-4">
        <div className="h-11 w-32 bg-muted rounded-md animate-pulse" />
      </div>

      {/* Bubble rail skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded animate-pulse mx-4" />
        <div className="flex gap-3 px-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0">
              <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
