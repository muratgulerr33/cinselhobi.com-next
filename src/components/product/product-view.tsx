"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { ShoppingBag, Truck, ShieldCheck, Headset, Check } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/format";
import { HeaderTitle } from "@/components/layout/header-title";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { useFavorites } from "@/components/favorites/favorites-provider";
import { toast } from "sonner";

// --- TİP TANIMLARI ---
interface ProductImage {
  src: string;
  alt?: string;
}

// Bu interface'i Server'dan gelen veriye uyumlu hale getirdik
export interface ProductType {
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
  stockStatus: string | null;
}

// --- YARDIMCI FONKSİYONLAR ---
function stripUnsafeHtml(input: string) {
  if (!input) return "";
  const noScripts = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const noStyles = noScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  return noStyles.replace(/\son\w+="[^"]*"/gi, "");
}

function htmlToPlainText(input: string) {
  const cleaned = stripUnsafeHtml(input || "");
  const rough = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return rough;
}

// --- ANA COMPONENT ---
// Artık slug değil, direkt "product" objesini alıyor
export function ProductView({ product }: { product: ProductType }) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const { addItem } = useCart();
  const { isFavorite, hydrated } = useFavorites();
  
  // Hero Galeri State'leri
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const rafRef = useRef<number | null>(null);

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

    // UX Geri Bildirimi
    setIsAdded(true);
    toast.success("Ürün sepete eklendi");
    setTimeout(() => setIsAdded(false), 2000);
  };

  // --- GALERİ MANTIĞI ---
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
      const validImages = product.images; 
      setActiveIndex(Math.max(0, Math.min(idx, validImages.length - 1)));
    });
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // --- HESAPLAMALAR ---
  const descriptionHtml = product.description ?? product.shortDescription ?? "";
  const safeDescriptionHtml = useMemo(() => stripUnsafeHtml(descriptionHtml), [descriptionHtml]);
  const plainText = useMemo(() => htmlToPlainText(descriptionHtml), [descriptionHtml]);
  const shouldShowReadMore = plainText.length > 180;
  
  const displayPrice = product.salePrice ?? product.price ?? product.regularPrice ?? null;
  const galleryImages = product.images;

  return (
    <div className="relative z-50 min-h-screen lg:min-h-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 bg-white dark:bg-background min-w-0 w-full max-w-full">
      {/* Client Side Header Title Güncellemesi */}
      <HeaderTitle title={product.name} />
      
        <>
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:px-8 lg:mt-8">
            <div className="lg:col-span-8">
              {/* (A) HERO GALLERY */}
              <div className="h-[55vh] lg:h-[60vh] lg:max-h-[520px] w-full relative bg-gray-50">
                {galleryImages.length === 0 ? (
                  <div className="h-[55vh] lg:h-[60vh] lg:max-h-[520px] w-full relative bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                    Görsel yok
                  </div>
                ) : galleryImages.length === 1 ? (
                  <div className="h-[55vh] lg:h-[60vh] lg:max-h-[520px] w-full relative bg-gray-50">
                    <div className="absolute inset-0 px-4 py-6">
                      <Image
                        src={galleryImages[0].src}
                        alt={galleryImages[0].alt || product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-contain object-center mix-blend-multiply dark:mix-blend-normal"
                        priority
                      />
                    </div>
                  </div>
                ) : (
                  // Slider Modu
                  <div className="h-[55vh] lg:h-[60vh] lg:max-h-[520px] w-full max-w-full min-w-0 relative bg-gray-50">
                    <div
                      ref={scrollerRef}
                      onScroll={onHeroScroll}
                      className="absolute inset-0 min-w-0 max-w-full overflow-x-auto snap-x snap-mandatory snap-always touch-pan-x overscroll-x-contain scrollbar-hide"
                    >
                      <div
                        className="flex h-full"
                        style={{ width: `${galleryImages.length * 100}%`, minWidth: `${galleryImages.length * 100}%` }}
                      >
                        {galleryImages.map((img, idx) => (
                          <div
                            key={`slide-${idx}-${img.src}`}
                            className="relative h-full shrink-0 snap-start"
                            style={{ flex: `0 0 ${100 / galleryImages.length}%` }}
                          >
                            <div className="absolute inset-0 px-4 py-6">
                              <Image
                                key={img.src}
                                src={img.src}
                                alt={img.alt || product.name}
                                fill
                                sizes="(max-width: 768px) 100vw, 50vw"
                                priority={idx === 0}
                                className="object-contain object-center mix-blend-multiply dark:mix-blend-normal"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Slider UI Elemanları */}
                    <div className="absolute top-3 right-3 z-20 rounded-full bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
                      {activeIndex + 1}/{galleryImages.length}
                    </div>

                    <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-2 py-1 backdrop-blur">
                      <div className="flex items-center gap-1.5">
                        {galleryImages.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`Görsel ${i + 1}`}
                            onClick={() => scrollToIndex(i)}
                            className="flex h-6 w-6 min-w-6 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                          >
                            <span
                              className={
                                "rounded-full transition-all " +
                                (i === activeIndex ? "h-1.5 w-4 bg-white" : "h-1.5 w-1.5 bg-white/50")
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Güven Rozetleri (Trust Badges) */}
              <div className="my-6 px-4 lg:px-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3 border border-border/50 flex flex-col items-center justify-center text-center">
                    <Truck className="w-5 h-5 mb-1.5 text-primary" />
                    <span className="text-[11px] font-medium leading-tight">Hızlı Kargo</span>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 border border-border/50 flex flex-col items-center justify-center text-center">
                    <ShieldCheck className="w-5 h-5 mb-1.5 text-primary" />
                    <span className="text-[11px] font-medium leading-tight">Gizli Teslimat</span>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 border border-border/50 flex flex-col items-center justify-center text-center">
                    <Headset className="w-5 h-5 mb-1.5 text-primary" />
                    <span className="text-[11px] font-medium leading-tight">Canlı Destek</span>
                  </div>
                </div>
              </div>

              {/* (C) DESCRIPTION + READ MORE */}
              <div className="pt-4 px-4 lg:px-0">
                {safeDescriptionHtml && (
                  <div>
                    {!descriptionExpanded && shouldShowReadMore ? (
                      <>
                        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {plainText.slice(0, 180)}...
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
                          className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
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
            </div>

            {/* Desktop Buy Box */}
            <div className="hidden lg:block lg:col-span-4">
              <div className="lg:sticky lg:top-24">
                <h1 className="text-xl font-semibold leading-tight text-foreground">
                  {product.name}
                </h1>

                <div className="mt-4 flex flex-col gap-4 items-start">
                  {displayPrice && (
                    <div className="text-2xl font-bold text-foreground self-start">
                      {formatPrice(displayPrice)}
                    </div>
                  )}

                  <div className="flex items-center gap-3 w-full">
                    <FavoriteButton
                      productId={product.id}
                      initialIsFavorite={hydrated ? isFavorite(product.id) : false}
                      className="h-12 w-12 flex items-center justify-center"
                      size="md"
                    />

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className={`h-12 flex-1 rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        isAdded
                          ? "bg-green-600 text-white hover:bg-green-600"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span>Eklendi</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-5 h-5" />
                          <span>Sepete Ekle</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-background border-t border-gray-100 dark:border-gray-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-col">
            <div className="text-xs text-gray-500 dark:text-gray-400">Toplam</div>
            <div className="text-xl font-bold text-black dark:text-white">
              {displayPrice ? formatPrice(displayPrice) : "Fiyat Sorunuz"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FavoriteButton
              productId={product.id}
              initialIsFavorite={hydrated ? isFavorite(product.id) : false}
              className="h-12 w-12 flex items-center justify-center"
              size="md"
            />

            <button
              type="button"
              onClick={handleAddToCart}
              className={`h-12 min-w-[140px] flex-1 rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                isAdded
                  ? "bg-green-600 text-white hover:bg-green-600"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Eklendi</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  <span>Sepete Ekle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
