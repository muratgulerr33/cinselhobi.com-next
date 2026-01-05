"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/catalog/product-card";
import { useFavorites } from "@/components/favorites/favorites-provider";

interface WishlistProduct {
  id: number;
  name: string;
  slug: string;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  images: unknown;
  stockStatus: string | null;
}

interface WishlistClientProps {
  initialProducts: WishlistProduct[];
}

export function WishlistClient({ initialProducts }: WishlistClientProps) {
  const { isFavorite, hydrated } = useFavorites();

  // Normalize images from DB
  function normalizeImages(images: unknown): string[] {
    if (!images) return [];
    if (!Array.isArray(images)) return [];
    return images
      .map((img) => {
        if (typeof img === "string") {
          return img.trim();
        }
        if (typeof img === "object" && img !== null) {
          if ("src" in img && typeof img.src === "string") {
            return img.src.trim();
          }
          if ("url" in img && typeof img.url === "string") {
            return img.url.trim();
          }
        }
        return null;
      })
      .filter((url): url is string => typeof url === "string" && url.length > 0);
  }

  // Filter out products that are no longer favorites (when hydrated)
  const visibleProducts = useMemo(() => {
    if (!hydrated) {
      return initialProducts;
    }
    return initialProducts.filter((product) => isFavorite(product.id));
  }, [initialProducts, isFavorite, hydrated]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-2xl font-semibold">Favorilerim</h1>
        {visibleProducts.length === 0 ? (
          <div className="mt-6 text-center py-12">
            <p className="text-sm leading-6 text-foreground/70 mb-6">
              Henüz favorin yok
            </p>
            <Link
              href="/categories"
              className="inline-block rounded-xl bg-primary px-6 py-3 text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Kategorilere Git
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visibleProducts.map((product) => {
              const images = normalizeImages(product.images);
              const displayPrice = product.salePrice ?? product.price ?? product.regularPrice ?? 0;

              return (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    price: displayPrice,
                    images,
                    stockStatus: product.stockStatus,
                  }}
                  isFavorite={true}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

