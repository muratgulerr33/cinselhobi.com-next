"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { buildHubCardHref } from "@/config/hub-ui";
import type { CategoryBubble } from "./category-bubble-rail";

type ProductImage = string | { src: string; alt?: string };

interface Product {
  id: number;
  wcId: number;
  name: string;
  slug: string;
  price: number;
  images: ProductImage[];
  stockStatus: string;
  isFavorite?: boolean;
}

interface CategoryQuickLookSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryBubble | null;
}

export function CategoryQuickLookSheet({
  open,
  onOpenChange,
  category,
}: CategoryQuickLookSheetProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !category) {
      setProducts([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchProducts() {
      if (!category) return;
      
      setLoading(true);
      setError(null);

      try {
        // Fetch products for the child category using parentSlug and sub (childWcId)
        const response = await fetch(
          `/api/products?categorySlug=${category.parentSlug}&sub=${category.childWcId}&limit=8&sort=newest&inStock=1`
        );

        if (!response.ok) {
          throw new Error("Ürünler yüklenemedi");
        }

        const data = await response.json();
        
        if (!cancelled) {
          setProducts(data.products || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Bir hata oluştu");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [open, category]);

  const viewAllHref = category
    ? buildHubCardHref(category.parentSlug, category.childWcId)
    : "#";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{category?.label || "Kategori"}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3 animate-pulse"
                >
                  <div className="h-20 w-20 rounded-lg bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Bu kategoride henüz ürün bulunmuyor.</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="space-y-3">
              {products.map((product) => {
                const first = product.images?.[0];
                const imgSrc = typeof first === "string" ? first : first?.src;
                const imgAlt = (typeof first === "string" ? product.name : first?.alt) ?? product.name;

                return (
                  <Link
                    key={product.id}
                    href={`/urun/${product.slug}`}
                    className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors active:scale-[0.98]"
                    onClick={() => onOpenChange(false)}
                  >
                    {imgSrc ? (
                      <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                        <Image
                          src={imgSrc}
                          alt={imgAlt}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2 text-sm">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatPrice(product.price)}
                      </p>
                      {product.stockStatus !== "instock" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stokta yok
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {category && (
          <DrawerFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href={viewAllHref} onClick={() => onOpenChange(false)}>
                Tümünü Gör
              </Link>
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
