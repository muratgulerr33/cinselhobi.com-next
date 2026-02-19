export default function AdminCustomersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-96 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-24 rounded-lg border border-border bg-card animate-pulse" />
      <div className="h-96 rounded-lg border border-border bg-card animate-pulse" />
    </div>
  );
}
