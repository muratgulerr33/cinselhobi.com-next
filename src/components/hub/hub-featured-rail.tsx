"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { type CategoryBubble } from "./category-bubble-rail";
import { ProductCard } from "@/components/catalog/product-card";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: number;
  name: string;
  slug: string;
  price: number;
  images: string[] | Array<{ src: string; alt?: string }>;
  stockStatus?: string | null;
  isFavorite?: boolean;
}

interface HubFeaturedRailProps {
  categories: CategoryBubble[];
}

export function HubFeaturedRail({ categories }: HubFeaturedRailProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  
  const drag = useRef<{ down: boolean; startX: number; startLeft: number; moved: boolean }>({
    down: false,
    startX: 0,
    startLeft: 0,
    moved: false,
  });

  // Desktop mouse drag handlers (only for mouse, not touch)
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // Only left click
    const el = railRef.current;
    if (!el) return;
    
    const startLeft = el.scrollLeft;
    drag.current.down = true;
    drag.current.moved = false;
    drag.current.startX = e.clientX;
    drag.current.startLeft = startLeft;
    e.preventDefault();

    function onMouseMove(e: MouseEvent) {
      if (!drag.current.down) return;
      const currentEl = railRef.current;
      if (!currentEl) return;
      const dx = e.clientX - drag.current.startX;
      if (Math.abs(dx) > 8) {
        drag.current.moved = true;
        currentEl.scrollLeft = startLeft - dx;
      }
    }

    function onMouseUp() {
      drag.current.down = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // Get featured category (first one)
  const featured = categories.length > 0 ? categories[0] : null;

  const fetchProducts = useCallback(async () => {
    if (!featured) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/products?categorySlug=${encodeURIComponent(featured.parentSlug)}&sub=${String(featured.childWcId)}&limit=6&sort=newest&inStock=1`
      );

      if (!response.ok) {
        throw new Error("Ürünler yüklenemedi");
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [featured]);

  // IntersectionObserver for scroll-triggered fetch
  useEffect(() => {
    if (!featured || hasFetched || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasFetched) {
          setHasFetched(true);
          fetchProducts();
        }
      },
      {
        rootMargin: "200px", // Start fetching 200px before visible
        threshold: 0.1,
      }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [featured, hasFetched, loading, fetchProducts]);

  // Don't render if no featured category
  if (!featured) {
    return null;
  }

  return (
    <section className="space-y-4" ref={containerRef}>
      <div className="px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Öne Çıkanlar</h2>
          {featured && (
            <Link
              href={`/${encodeURIComponent(featured.parentSlug)}?sub=${String(featured.childWcId)}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Tümünü Gör <span className="inline-block">›</span>
            </Link>
          )}
        </div>
        {featured && (
          <p className="text-sm text-muted-foreground mt-1">
            {featured.label}
          </p>
        )}
      </div>

      {loading && (
        <div className="px-4">
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col shrink-0 w-40">
                <Skeleton className="aspect-[4/5] rounded-2xl mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-2 text-sm underline"
            >
              Tekrar dene
            </button>
          </div>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="px-4 relative">
          <div
            ref={railRef}
            data-featured-rail="true"
            data-ch-carousel="true"
            onMouseDown={onMouseDown}
            onClickCapture={(e) => {
              if (drag.current.moved) {
                e.preventDefault();
                e.stopPropagation();
                drag.current.moved = false;
              }
            }}
            className="no-scrollbar flex flex-nowrap gap-3 overflow-x-auto cursor-grab active:cursor-grabbing select-none [&_*]:!touch-auto"
            style={{
              touchAction: "pan-x",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {products.map((product) => {
              // Normalize images array
              const images: string[] = Array.isArray(product.images)
                ? product.images.map((img) =>
                    typeof img === "string" ? img : img?.src || ""
                  )
                : [];

              return (
                <div key={product.id} className="shrink-0 w-40">
                  <ProductCard
                    product={{
                      id: product.id,
                      name: product.name,
                      slug: product.slug,
                      price: product.price,
                      images,
                      stockStatus: product.stockStatus,
                    }}
                    isFavorite={product.isFavorite}
                  />
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
        </div>
      )}
    </section>
  );
}
