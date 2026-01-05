"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/format";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductGallery } from "./ProductGallery";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { cn } from "@/lib/utils";
import type { Product, RelatedProduct } from "./types";

interface ProductDetailClientProps {
  product: Product;
  related: RelatedProduct[];
  initialIsFavorite?: boolean;
}

// ScreenShell contract: px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12 (from page-transition.tsx)
const EDGE_X = "px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12";
const BLEED_X = "-mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8 2xl:-mx-12";

// FullBleed helper for edge-to-edge sections (w-screen hack removed)
function FullBleed({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn(BLEED_X, "w-full")}>
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </section>
  );
}

// Sanitize helpers
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

function AccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 min-h-[48px]"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProductDetailClient({ product, related, initialIsFavorite = false }: ProductDetailClientProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const { addItem } = useCart();

  // Derived values
  const descriptionHtml = product.description ?? product.shortDescription ?? "";
  const safeDescriptionHtml = useMemo(() => stripUnsafeHtml(descriptionHtml), [descriptionHtml]);
  const plainText = useMemo(() => htmlToPlainText(descriptionHtml), [descriptionHtml]);
  const shouldShowReadMore = plainText.length > 220;

  const displayPrice = product.salePrice ?? product.price ?? product.regularPrice ?? null;
  const primaryImage = product.images[0]?.src || null;

  const handleAddToCart = () => {
    if (!product) return;

    const priceCents = displayPrice ?? 0;

    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents,
        imageUrl: primaryImage,
      },
      1
    );

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 800);
  };

  return (
    <div className="relative z-50 min-h-screen bg-white dark:bg-background min-w-0 max-w-full overflow-x-clip pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-0">
      <div className="space-y-6">
        {/* (A) GALLERY */}
        <div className="bg-gray-50">
          <ProductGallery
            images={product.images}
            title={product.name}
            productId={product.id}
            initialIsFavorite={initialIsFavorite}
          />
        </div>

        {/* (B) INFO BLOCK */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {product.name}
          </h1>

          {/* Trust/Info Tags */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full">
            <span className="bg-gray-100 dark:bg-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap text-gray-700 dark:text-gray-300 flex-shrink-0">
              🚀 Hızlı Gönderim
            </span>
            <span className="bg-gray-100 dark:bg-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap text-gray-700 dark:text-gray-300 flex-shrink-0">
              🔒 Gizli Paket
            </span>
            <span className="bg-gray-100 dark:bg-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap text-gray-700 dark:text-gray-300 flex-shrink-0">
              ⭐ Çok Satan
            </span>
            <span className="bg-gray-100 dark:bg-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap text-gray-700 dark:text-gray-300 flex-shrink-0">
              🇹🇷 Yerli Üretim
            </span>
          </div>

          {/* Desktop inline CTA (md+) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-2xl font-bold text-black dark:text-white">
              {displayPrice !== null ? formatPrice(displayPrice) : "—"}
            </div>
            <FavoriteButton
              productId={product.id}
              initialIsFavorite={initialIsFavorite}
              size="md"
              className="h-12 w-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black flex items-center justify-center"
            />
            <button
              type="button"
              onClick={handleAddToCart}
              className="flex-1 h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{addedToCart ? "Eklendi" : "Sepete Ekle"}</span>
            </button>
          </div>
        </div>

        {/* (C) DESCRIPTION + READ MORE */}
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
                  className="text-sm font-semibold text-black dark:text-white py-3"
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
                    className="text-sm font-semibold text-black dark:text-white py-3"
                  >
                    Kapat
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* (D) ACCORDION SYSTEM */}
        <div>
          <AccordionItem title="📦 Teslimat ve İade Koşulları">
            <p>
              Siparişleriniz 1-3 iş günü içinde kargoya verilir. Ücretsiz iade
              hakkınız 14 gün içinde geçerlidir. Ürünler orijinal ambalajında ve
              kullanılmamış olmalıdır.
            </p>
          </AccordionItem>
          <AccordionItem title="🛡️ Gizlilik ve Paketleme Garantisi">
            <p>
              Tüm ürünlerimiz gizli paketleme ile gönderilir. Paket üzerinde
              ürün içeriği hakkında hiçbir bilgi bulunmaz. Kişisel verileriniz
              KVKK kapsamında korunmaktadır.
            </p>
          </AccordionItem>
        </div>

        {/* (E) CROSS-SELL HORIZONTAL SLIDER */}
        {related.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Bunlar da ilgini çekebilir
            </h2>
            <div className="flex overflow-x-auto gap-4 no-scrollbar max-w-full">
              {related.map((relatedProduct) => {
                const relatedPrice = relatedProduct.salePrice ?? relatedProduct.price ?? relatedProduct.regularPrice ?? 0;
                const relatedImages = relatedProduct.images.map((img) => img.src);

                return (
                  <div key={`related-${relatedProduct.id}-${relatedProduct.slug}`} className="flex-shrink-0 w-[170px]">
                    <ProductCard
                      product={{
                        id: relatedProduct.id,
                        name: relatedProduct.name,
                        slug: relatedProduct.slug,
                        price: relatedPrice,
                        images: relatedImages,
                        stockStatus: relatedProduct.stockStatus,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* (F) STICKY ACTION BAR - mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 p-4 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold text-black dark:text-white">
            {displayPrice !== null ? formatPrice(displayPrice) : "—"}
          </div>
          <FavoriteButton
            productId={product.id}
            initialIsFavorite={initialIsFavorite}
            className="h-12 w-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black flex items-center justify-center"
          />
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>{addedToCart ? "Eklendi" : "Sepete Ekle"}</span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

