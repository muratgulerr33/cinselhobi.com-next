"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/favorites/favorite-button";

// Timing sabitleri
const GALLERY_INTERVAL_MS = 1000;
const PRESS_PREVIEW_DELAY_MS = 150;
const PRESS_MAX_MOVE_PX = 10;

export interface ProductCardProps {
  productId: number;
  slug: string;
  title: string;
  price: number; // kuruş cinsinden (priceCents)
  currency?: string;
  images: string[];
  isNew?: boolean;
  priority?: boolean;
  className?: string;
  onQuickAdd?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (next: boolean) => void;
}

export function ProductCard({
  productId,
  slug,
  title,
  price,
  currency = "TRY",
  images,
  isNew = false,
  priority = false,
  className,
  onQuickAdd,
  isFavorite,
  onToggleFavorite,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Press-preview için ref'ler
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const didPreviewRef = useRef(false);
  const isPressingRef = useRef(false);

  const safeImages = images?.filter(Boolean) ?? [];
  const hasMultipleImages = safeImages.length > 1;

  // Press timer temizleme yardımcısı
  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Hover/Long-press gallery effect
  useEffect(() => {
    if (!isHovered || !hasMultipleImages) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % safeImages.length);
    }, GALLERY_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isHovered, hasMultipleImages, safeImages.length]);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onQuickAdd) {
      onQuickAdd();
    } else {
      addItem(
        {
          productId,
          slug,
          name: title,
          priceCents: price,
          imageUrl: safeImages[0] || null,
        },
        1
      );
    }
  };

  // Desktop hover handlers
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentImageIndex(0);
  };

  // Pointer event handlers (mobil press-preview için)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Mouse için değil, sadece touch için
    if (e.pointerType === "mouse") return;

    isPressingRef.current = true;
    didPreviewRef.current = false;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    clearPressTimer();

    pressTimerRef.current = setTimeout(() => {
      didPreviewRef.current = true;
      if (safeImages.length > 1) {
        setCurrentImageIndex(1);
      }
      setIsHovered(true);
    }, PRESS_PREVIEW_DELAY_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPressingRef.current || !pressStartRef.current) return;

    const dx = e.clientX - pressStartRef.current.x;
    const dy = e.clientY - pressStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > PRESS_MAX_MOVE_PX) {
      clearPressTimer();
      isPressingRef.current = false;
      setIsHovered(false);
      didPreviewRef.current = false;
    }
  };

  const handlePointerUp = () => {
    clearPressTimer();
    isPressingRef.current = false;
    setIsHovered(false);
    setCurrentImageIndex(0);
    didPreviewRef.current = false;
    pressStartRef.current = null;
  };

  const handlePointerCancel = () => {
    clearPressTimer();
    isPressingRef.current = false;
    setIsHovered(false);
    setCurrentImageIndex(0);
    didPreviewRef.current = false;
    pressStartRef.current = null;
  };

  // Link onClick - preview yaptıktan sonra navigation'ı engelle
  const handleLinkClick = (e: React.MouseEvent) => {
    if (didPreviewRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didPreviewRef.current = false;
    }
  };

  const currentImage = safeImages[currentImageIndex] || safeImages[0] || null;

  // Title normalizasyonu: FULL CAPS ise lowercase'e çevir ve capitalize uygula
  const rawTitle = (title ?? "").trim();
  const isAllCaps = rawTitle.length > 0 && rawTitle === rawTitle.toLocaleUpperCase("tr-TR");
  const normalizedTitle = isAllCaps ? rawTitle.toLocaleLowerCase("tr-TR") : rawTitle;

  return (
    <>
      <style jsx>{`
        @keyframes chFadeIn {
          from {
            opacity: 0.85;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      <Link
        href={`/urun/${slug}`}
        className={`block h-full flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden dark:bg-zinc-900/40 transition-transform duration-200 active:scale-[0.99] touch-pan-y ${className || ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleLinkClick}
      >
        {/* Image Area */}
        <div
          className="relative aspect-[4/5] overflow-hidden bg-gray-50 rounded-xl select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [user-select:none] [touch-action:pan-y]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {currentImage ? (
            <div className="absolute inset-0 p-4">
              <Image
                src={currentImage}
                alt={title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-contain mix-blend-multiply dark:mix-blend-normal"
                priority={priority}
                draggable={false}
                style={{ animation: "chFadeIn 180ms ease-out" }}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-zinc-800 dark:to-zinc-900" />
          )}

          {/* New Badge */}
          {isNew && (
            <div className="absolute top-3 left-3 rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide bg-white/70 text-black backdrop-blur dark:bg-black/40 dark:text-white">
              YENİ
            </div>
          )}

          {/* Favorite Button */}
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton
              productId={productId}
              initialIsFavorite={isFavorite ?? false}
              size="md"
            />
          </div>

          {/* Quick Add Button */}
          <button
            type="button"
            onClick={handleQuickAdd}
            className="absolute bottom-3 right-3 rounded-full w-9 h-9 bg-black text-white grid place-items-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30 transition-transform active:scale-95"
            aria-label="Sepete ekle"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Info Area */}
        <div className="flex flex-col px-3 pb-3">
          <h3 className={cn("mt-3 text-sm font-medium leading-tight text-gray-900 dark:text-gray-100 line-clamp-2", isAllCaps && "capitalize")}>{normalizedTitle}</h3>
          <div className="text-base font-bold text-black dark:text-white mt-1.5">
            {formatPrice(price)}
          </div>
        </div>
      </Link>
    </>
  );
}

