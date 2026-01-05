"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/format";
import { HeaderTitle } from "@/components/layout/header-title";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { useFavorites } from "@/components/favorites/favorites-provider";

interface ProductImage {
  src: string;
  alt?: string;
}

interface Product {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  images: ProductImage[];
  sku: string | null;
  stockStatus: string | null;
  stockQuantity: number | null;
}

function stripUnsafeHtml(input: string) {
  if (!input) return "";
  const noScripts = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const noStyles = noScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const noHandlers = noStyles.replace(/\son\w+="[^"]*"/gi, "");
  return noHandlers;
}

function htmlToPlainText(input: string) {
  const cleaned = stripUnsafeHtml(input || "");
  // SSR-safe fallback (no DOM required)
  const rough = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // If DOMParser exists, prefer it (browser)
  try {
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(cleaned, "text/html");
      return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    }
  } catch {}
  return rough;
}

export function ProductDetailPage({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { addItem } = useCart();
  const { isFavorite, hydrated } = useFavorites();
  
  // Hero gallery slider hooks
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    // Loading state'i async olarak ayarla (linter uyarısını önlemek için)
    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/products/${slug}`, {
          signal: abortControllerRef.current!.signal,
        });

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Ürün bulunamadı");
          }
          throw new Error("Bir hata oluştu");
        }

        const data = await res.json();
        
        // İstek iptal edilmediyse state'i güncelle
        if (!abortControllerRef.current?.signal.aborted) {
          setProduct(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (!abortControllerRef.current?.signal.aborted) {
          setError(err instanceof Error ? err.message : "Bir hata oluştu");
          setLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [slug]);

  const handleAddToCart = () => {
    if (!product) return;

    const displayPrice = product.salePrice ?? product.price ?? product.regularPrice ?? 0;
    const primaryImage = product.images[0]?.src || null;

    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: displayPrice,
        imageUrl: primaryImage,
      },
      1
    );
  };

  // Hero gallery slider helpers
  const scrollToIndex = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: i * w, behavior: "smooth" });
  };

  const onHeroScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      const galleryImages = product?.images ?? [];
      const validImages = galleryImages
        .map((img) => ({ 
          src: (img?.src ?? "").trim(), 
          alt: (img?.alt ?? "").trim() 
        }))
        .filter((img) => img.src.length > 0);
      setActiveIndex(Math.max(0, Math.min(idx, validImages.length - 1)));
    });
  };

  // Cleanup on unmount
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Derived values - safe defaults for when product is null
  const descriptionHtml = product?.description ?? product?.shortDescription ?? "";
  const safeDescriptionHtml = useMemo(() => stripUnsafeHtml(descriptionHtml), [descriptionHtml]);
  const plainText = useMemo(() => htmlToPlainText(descriptionHtml), [descriptionHtml]);
  const shouldShowReadMore = plainText.length > 220;
  
  const displayPrice = product
    ? product.salePrice ?? product.price ?? product.regularPrice ?? null
    : null;

  // UI-side defensive filtering - geçersiz görselleri filtrele
  const galleryImages = useMemo(() => {
    if (!product?.images) return [];
    const list = product.images;
    const filtered = list
      .map((img) => ({ 
        src: (img?.src ?? "").trim(), 
        alt: (img?.alt ?? "").trim() 
      }))
      .filter((img) => img.src.length > 0);
    return filtered;
  }, [product?.images]);

  return (
    <div className="relative z-50 min-h-screen bg-white dark:bg-background overflow-x-hidden min-w-0">
      {product && <HeaderTitle title={product.name} />}
      {loading ? (
        <>
          <div className="h-[55vh] w-full bg-gray-50 animate-pulse" />
          <div className="pt-6 space-y-4">
            <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
          </div>
        </>
      ) : !product ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {error || "Ürün bulunamadı"}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* (A) HERO GALLERY */}
          <div className="h-[55vh] w-full relative bg-gray-50">
            {galleryImages.length === 0 ? (
              // Fallback hero - görsel yok
              <div className="h-[55vh] w-full relative bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                Görsel yok
              </div>
            ) : galleryImages.length === 1 ? (
              // Tek görsel - slider yok
              <div className="h-[55vh] w-full relative bg-gray-50">
                <div className="absolute inset-0 px-4 py-6">
                  <Image
                    src={galleryImages[0].src}
                    alt={galleryImages[0].alt || product.name}
                    fill
                    sizes="100vw"
                    className="object-contain object-center mix-blend-multiply dark:mix-blend-normal"
                    priority
                  />
                </div>
              </div>
            ) : (
              // Çoklu görsel - slider
              <div className="h-[55vh] w-full relative bg-gray-50">
                <div
                  ref={scrollerRef}
                  onScroll={onHeroScroll}
                  className="absolute inset-0 overflow-x-auto snap-x snap-mandatory snap-always touch-pan-x overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <div className="flex h-full">
                    {galleryImages.map((img, idx) => (
                      <div key={`${img.src}-${idx}`} className="relative h-full min-w-full snap-start">
                        <div className="absolute inset-0 px-4 py-6">
                          <Image
                            src={img.src}
                            alt={img.alt || product?.name || "Ürün görseli"}
                            fill
                            sizes="100vw"
                            priority={idx === 0}
                            className="object-contain object-center mix-blend-multiply dark:mix-blend-normal"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top-right 1/N indicator */}
                <div className="absolute top-3 right-3 z-20 rounded-full bg-black/40 px-2 py-1 text-xs text-white backdrop-blur">
                  {activeIndex + 1}/{galleryImages.length}
                </div>

                {/* Bottom-center dots (tap to jump) */}
                <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/35 px-2 py-1 backdrop-blur">
                  <div className="flex items-center gap-1.5">
                    {galleryImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Görsel ${i + 1}`}
                        onClick={() => scrollToIndex(i)}
                        className={
                          "h-1.5 rounded-full transition-all " +
                          (i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50")
                        }
                      />
                    ))}
                  </div>
                </div>

                {/* Desktop arrows (md+) */}
                <button
                  type="button"
                  aria-label="Önceki görsel"
                  onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
                  className="hidden md:flex absolute left-3 top-1/2 z-20 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Sonraki görsel"
                  onClick={() => scrollToIndex(Math.min(galleryImages.length - 1, activeIndex + 1))}
                  className="hidden md:flex absolute right-3 top-1/2 z-20 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
                >
                  ›
                </button>
              </div>
            )}
          </div>

      {/* (B) INFO BLOCK */}
      <div className="pt-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {product.name}
        </h1>
      </div>

          {/* (C) DESCRIPTION + READ MORE */}
          <div className="pt-4">
            {safeDescriptionHtml && (
              <div>
                {!descriptionExpanded && shouldShowReadMore ? (
                  <>
                    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {plainText.slice(0, 220)}...
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded(true)}
                      className="mt-2 text-sm font-semibold text-black dark:text-white"
                    >
                      Devamını Oku
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: safeDescriptionHtml }}
                    />
                    {shouldShowReadMore && (
                      <button
                        type="button"
                        onClick={() => setDescriptionExpanded(false)}
                        className="mt-2 text-sm font-semibold text-black dark:text-white"
                      >
                        Kapat
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Spacer for sticky bar */}
          <div className="pb-32" />
        </>
      )}

      {/* Sticky Action Bar */}
      {product && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-background border-t border-gray-100 dark:border-gray-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-4">
            {/* Sol Taraf - Fiyat */}
            <div className="flex-col">
              <div className="text-xs text-gray-500 dark:text-gray-400"></div>
              <div className="text-xl font-bold text-black dark:text-white">
                {displayPrice ? formatPrice(displayPrice) : "Fiyat Sorunuz"}
              </div>
            </div>

            {/* Sağ Taraf - Aksiyonlar */}
            <div className="flex items-center gap-3">
              {/* Favori Butonu */}
              <FavoriteButton
                productId={product.id}
                initialIsFavorite={hydrated ? isFavorite(product.id) : false}
                className="h-12 w-12 flex items-center justify-center"
                size="md"
              />

              {/* Sepete Ekle Butonu */}
              <button
                type="button"
                onClick={handleAddToCart}
                className="h-12 min-w-[140px] flex-1 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
              >
                <ShoppingBag className="w-5 h-5" />
                <span>Sepete Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

