import { Suspense } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function NotFoundContent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold text-foreground">Bulunamadı</h1>
      <p className="text-muted-foreground">
        Aradığınız sayfa bulunamadı.
      </p>
      <Link
        href="/"
        className="rounded-2xl border border-border bg-card px-4 py-2 text-card-foreground transition-colors hover:bg-muted"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center">Yükleniyor...</div>}>
      <NotFoundContent />
    </Suspense>
  );
}

