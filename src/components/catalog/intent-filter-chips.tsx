"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IntentClass, detectIntent } from "@/lib/intent-heuristics";
import { useMemo } from "react";

interface IntentFilterChipsProps {
  categorySlug: string;
  products: Array<{
    slug: string;
    name: string;
  }>;
}

export function IntentFilterChips({ categorySlug, products }: IntentFilterChipsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const intentParam = searchParams.get("intent");
  const activeIntent: IntentClass | "all" =
    intentParam === "kadin" || intentParam === "erkek" ? (intentParam as IntentClass) : "all";

  // Ürün intent'lerini hesapla (cache için useMemo)
  // Hooks her zaman en üstte olmalı, early return'den önce
  const productIntents = useMemo(() => {
    const intents = new Map<string, IntentClass>();
    for (const product of products) {
      const categoryContext = categorySlug ? [categorySlug] : [];
      const result = detectIntent(product.slug, product.name, categoryContext);
      intents.set(product.slug, result.intent);
    }
    return intents;
  }, [products, categorySlug]);

  // Intent sayılarını hesapla
  const intentCounts = useMemo(() => {
    const counts = { kadin: 0, erkek: 0, all: products.length };
    for (const intent of productIntents.values()) {
      if (intent === "kadin") counts.kadin++;
      else if (intent === "erkek") counts.erkek++;
    }
    return counts;
  }, [productIntents, products.length]);

  // Sadece et-dokulu-urunler için göster (early return hooks'tan sonra)
  if (categorySlug !== "et-dokulu-urunler") {
    return null;
  }

  const setIntent = (intent: IntentClass | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (intent === "all") {
      params.delete("intent");
    } else {
      params.set("intent", intent);
    }
    router.push(`${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex gap-2 flex-wrap items-center mb-4">
      <span className="text-sm font-medium text-muted-foreground">Filtrele:</span>
      <button
        onClick={() => setIntent("all")}
        className={`text-sm px-4 py-2 rounded-full border transition-colors ${
          activeIntent === "all"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background hover:bg-muted"
        }`}
      >
        Tümü ({intentCounts.all})
      </button>
      <button
        onClick={() => setIntent("kadin")}
        className={`text-sm px-4 py-2 rounded-full border transition-colors ${
          activeIntent === "kadin"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background hover:bg-muted"
        }`}
      >
        Kadın ({intentCounts.kadin})
      </button>
      <button
        onClick={() => setIntent("erkek")}
        className={`text-sm px-4 py-2 rounded-full border transition-colors ${
          activeIntent === "erkek"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background hover:bg-muted"
        }`}
      >
        Erkek ({intentCounts.erkek})
      </button>
    </div>
  );
}
