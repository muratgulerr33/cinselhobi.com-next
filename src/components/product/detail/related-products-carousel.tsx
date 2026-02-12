"use client";

import { useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/catalog/product-card";
import type { RelatedProduct } from "./types";

interface RelatedProductsCarouselProps {
  products: RelatedProduct[];
}

export function RelatedProductsCarousel({ products }: RelatedProductsCarouselProps) {
  const railRef = useRef<HTMLDivElement | null>(null);

  // Desktop arrow scroll handlers (xl+ only)
  const scrollLeft = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: -320, behavior: "smooth" });
  }, []);

  const scrollRight = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: 320, behavior: "smooth" });
  }, []);

  if (products.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Bunlar da ilgini çekebilir
      </h2>
      <div className="w-full max-w-full min-w-0 px-1 relative">
        {/* Desktop arrow buttons (xl+) */}
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Önceki ürünler"
          className="hidden xl:flex absolute left-2 top-1/2 z-10 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-background/90 transition-colors pointer-events-auto"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={scrollRight}
          aria-label="Sonraki ürünler"
          className="hidden xl:flex absolute right-2 top-1/2 z-10 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-background/90 transition-colors pointer-events-auto"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={railRef}
          data-ch-carousel="true"
          className="no-scrollbar flex flex-nowrap gap-3 overflow-x-auto [&_*]:!touch-auto snap-x snap-mandatory"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          {products.map((product) => {
            const relatedPrice = product.salePrice ?? product.price ?? product.regularPrice ?? 0;
            const relatedImages = product.images.map((img) => img.src);

            return (
              <div
                key={`related-${product.id}-${product.slug}`}
                className="shrink-0 w-[calc(50%-6px)] md:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] xl:w-[calc(20%-9.6px)] 2xl:w-[calc(16.666%-10px)] snap-start"
              >
                <div className="p-2">
                  <ProductCard
                    product={{
                      id: product.id,
                      name: product.name,
                      slug: product.slug,
                      price: relatedPrice,
                      images: relatedImages,
                      stockStatus: product.stockStatus,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

