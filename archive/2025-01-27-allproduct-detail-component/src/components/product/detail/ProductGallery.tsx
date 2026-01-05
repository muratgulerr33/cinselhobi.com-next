"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import type { ProductImage } from "./types";

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
  productId: number;
  initialIsFavorite?: boolean;
}

export function ProductGallery({
  images,
  title,
  productId,
  initialIsFavorite = false,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const validImages = images.filter((img) => img.src && img.src.trim().length > 0);
  const hasMultipleImages = validImages.length > 1;

  // Native scroll handler - calculate activeIndex from scrollLeft
  const handleScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setActiveIndex(Math.max(0, Math.min(idx, validImages.length - 1)));
    });
  };

  // Scroll to specific index
  const scrollToIndex = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: i * w, behavior: "smooth" });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Render modes
  if (validImages.length === 0) {
    return (
      <div className="relative h-[clamp(320px,55vh,620px)] w-full bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        Görsel yok
      </div>
    );
  }

  if (validImages.length === 1) {
    return (
      <div className="relative h-[clamp(320px,55vh,620px)] w-full bg-gray-50">
        <div className="absolute inset-0 p-4 sm:p-6">
          <Image
            src={validImages[0].src}
            alt={validImages[0].alt || title}
            fill
            sizes="100vw"
            className="object-contain object-center mix-blend-multiply dark:mix-blend-normal"
            priority
          />
        </div>
        <div className="absolute bottom-4 right-4 z-30 p-2 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm">
          <FavoriteButton
            productId={productId}
            initialIsFavorite={initialIsFavorite}
            size="lg"
          />
        </div>
      </div>
    );
  }

  // Multiple images - native scroll-snap slider
  return (
    <div className="relative h-[clamp(320px,55vh,620px)] w-full bg-gray-50">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="relative w-full h-full overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory no-scrollbar touch-pan-x"
      >
        <div className="flex h-full w-full">
          {validImages.map((img, idx) => (
            <div key={`${img.src}-${idx}`} className="relative h-full w-full shrink-0 snap-start">
              <div className="absolute inset-0 p-4 sm:p-6">
                <Image
                  src={img.src}
                  alt={img.alt || title}
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
        {activeIndex + 1}/{validImages.length}
      </div>

      {/* Bottom-center dots (tap to jump) */}
      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/35 px-2 py-1 backdrop-blur">
        <div className="flex items-center gap-1.5">
          {validImages.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Görsel ${i + 1}`}
              onClick={() => scrollToIndex(i)}
              className="h-11 w-11 flex items-center justify-center"
            >
              <div
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Desktop arrows (md+) */}
      <button
        type="button"
        aria-label="Önceki görsel"
        onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
        className="hidden md:flex absolute left-3 top-1/2 z-20 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Sonraki görsel"
        onClick={() => scrollToIndex(Math.min(validImages.length - 1, activeIndex + 1))}
        className="hidden md:flex absolute right-3 top-1/2 z-20 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
      >
        ›
      </button>

      {/* Heart overlay */}
      <div className="absolute bottom-4 right-4 z-30 p-2 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm">
        <FavoriteButton
          productId={productId}
          initialIsFavorite={initialIsFavorite}
        />
      </div>

      <style jsx>{`
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

