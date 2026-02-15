"use client";

import { useState, useMemo } from "react";
import { ProductGrid } from "./product-grid";
import { detectIntent, IntentClass } from "@/lib/intent-heuristics";

interface Product {
  id?: number;
  wcId?: number;
  name: string;
  slug: string;
  price?: number | null;
  images?: unknown;
  stockStatus?: string | null;
  isFavorite?: boolean;
}

interface LoadMoreGridProps {
  initialProducts: Product[];
  /** API'nin döndürdüğü nextCursor (wcId). Ürün id'si kullanılmamalı. */
  initialNextCursor: number | null;
  limit: number;
  categorySlug?: string;
  sort?: string;
  minPrice?: number | null; // TL cinsinden
  maxPrice?: number | null; // TL cinsinden
  inStock?: boolean | null;
  sub?: string; // wcId'ler virgülle ayrılmış
  intent?: IntentClass | "all"; // Intent filtreleme (et-dokulu-urunler için)
}

export function LoadMoreGrid({
  initialProducts,
  initialNextCursor,
  limit,
  categorySlug,
  sort,
  minPrice,
  maxPrice,
  inStock,
  sub,
  intent = "all",
}: LoadMoreGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cursorWcId, setCursorWcId] = useState<number | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialNextCursor !== null);
  const [error, setError] = useState<string | null>(null);

  // Intent filtreleme (client-side, sadece et-dokulu-urunler için)
  const filteredProducts = useMemo(() => {
    if (categorySlug !== "et-dokulu-urunler" || intent === "all") {
      return products;
    }

    return products.filter((product) => {
      const categoryContext = categorySlug ? [categorySlug] : [];
      const result = detectIntent(product.slug, product.name, categoryContext);
      return result.intent === intent;
    });
  }, [products, categorySlug, intent]);

  const handleLoadMore = async () => {
    if (loading || !hasMore || cursorWcId === null) return;

    setLoading(true);
    setError(null);

    if (process.env.NODE_ENV === "development") {
      console.debug("[LoadMore] cursorWcId=", cursorWcId);
    }

    try {
      const url = new URL("/api/products", window.location.origin);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("cursor", String(cursorWcId));
      if (categorySlug) {
        url.searchParams.set("categorySlug", categorySlug);
      }
      if (sort) {
        url.searchParams.set("sort", sort);
      }
      if (minPrice !== null && minPrice !== undefined) {
        url.searchParams.set("min", String(minPrice));
      }
      if (maxPrice !== null && maxPrice !== undefined) {
        url.searchParams.set("max", String(maxPrice));
      }
      if (inStock === true) {
        url.searchParams.set("inStock", "1");
      }
      if (sub) {
        url.searchParams.set("sub", sub);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Ürünler yüklenirken bir hata oluştu");
      }

      const data = await response.json();
      const { products: newProducts, nextCursor } = data;

      if (newProducts.length === 0 && nextCursor !== null) {
        console.warn("[LoadMoreGrid] Anomali: 0 ürün döndü ama nextCursor var", { nextCursor });
      }

      const existingWcIds = new Set(
        products
          .map((p) => p.wcId)
          .filter((id): id is number => id !== undefined)
      );
      const uniqueNewProducts = newProducts.filter((product: Product) => {
        if (product.wcId === undefined) return true;
        return !existingWcIds.has(product.wcId);
      });

      setProducts((prev) => [...prev, ...uniqueNewProducts]);
      setCursorWcId(nextCursor);
      setHasMore(nextCursor !== null);
    } catch (error) {
      console.error("Load more error:", error);
      setError("Bir hata oldu, tekrar dene");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ProductGrid products={filteredProducts} />
      
      {error && (
        <div className="text-center text-sm text-destructive pt-2">
          {error}
        </div>
      )}
      
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="rounded-lg border border-border bg-card px-6 py-3 text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Yükleniyor..." : "Daha fazla yükle"}
          </button>
        </div>
      )}
      
      {!hasMore && products.length > 0 && (
        <div className="text-center text-sm text-muted-foreground pt-4">
          Tüm ürünler gösterildi
        </div>
      )}
    </div>
  );
}

