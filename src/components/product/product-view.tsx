"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { Phone, ShoppingBag, Truck, ShieldCheck, Headset, Check } from "lucide-react";
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.77.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
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
  const supportPhoneHref = "tel:+905458651215";
  const supportWhatsAppHref = "https://wa.me/905458651215";

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
      <div
        data-testid="pdp-sticky-bar"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-background border-t border-gray-100 dark:border-gray-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="flex items-center gap-3">
          <div data-testid="pdp-sticky-price" className="shrink-0">
            <div className="text-lg font-bold leading-none whitespace-nowrap text-black dark:text-white">
              {displayPrice ? formatPrice(displayPrice) : "Fiyat Sorunuz"}
            </div>
          </div>

          <div className="min-w-0 flex-1" aria-hidden="true" />

          <div data-testid="pdp-sticky-actions" className="flex shrink-0 items-center gap-2">
            <a
              data-testid="pdp-sticky-phone"
              href={supportPhoneHref}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Telefon"
            >
              <Phone className="h-[18px] w-[18px]" />
            </a>
            <a
              data-testid="pdp-sticky-whatsapp"
              href={supportWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" />
            </a>
          </div>

          <button
            data-testid="pdp-sticky-add-to-cart"
            type="button"
            onClick={handleAddToCart}
            className={`inline-flex h-12 w-[9.75rem] shrink-0 items-center justify-center rounded-2xl px-4 text-sm font-bold whitespace-nowrap active:scale-[0.98] transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              isAdded
                ? "bg-green-600 text-white hover:bg-green-600"
                : "bg-primary text-white hover:bg-primary/90"
            }`}
          >
            {isAdded ? "Eklendi" : "Sepete Ekle"}
          </button>
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
