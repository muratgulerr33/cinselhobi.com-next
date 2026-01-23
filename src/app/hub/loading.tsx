import { Skeleton } from "@/components/ui/skeleton";

export default function HubIndexLoading() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-20 sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
      {/* Hero Skeleton */}
      <div className="mb-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full" />
      </div>

      {/* Hub Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border bg-card shadow-sm p-6"
          >
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
