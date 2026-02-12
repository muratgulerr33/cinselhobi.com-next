"use client";

import { useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useFavorites } from "@/components/favorites/favorites-provider";
import { useAuth } from "@/hooks/use-auth";
import { saveFavoriteIntent } from "@/lib/favorites-intent";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  productId: number;
  initialIsFavorite?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FavoriteButton({
  productId,
  initialIsFavorite = false,
  className,
  size = "md",
}: FavoriteButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isFavorite: isFavoriteFromContext, hydrated, toggle } = useFavorites();
  const { isAuthenticated } = useAuth();

  // Context'ten gelen değeri kullan, yoksa prop'u kullan
  const computedIsFavorite = useMemo(() => {
    return hydrated ? isFavoriteFromContext(productId) : initialIsFavorite;
  }, [hydrated, productId, initialIsFavorite, isFavoriteFromContext]);

  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isAuthenticated) {
        // Tam URL'yi tıklama anında al (useSearchParams kullanmıyoruz; static/ISR uyumu için)
        const from =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search + window.location.hash
            : pathname;

        saveFavoriteIntent({
          productId,
          from,
          createdAt: Date.now(),
        });

        const callbackUrl = encodeURIComponent(from);
        router.push(`/login?callbackUrl=${callbackUrl}`);
        return;
      }

      setIsLoading(true);
      try {
        await toggle(productId, pathname);
      } catch (error) {
        console.error("Favori ekleme/çıkarma hatası (network):", error);
        alert("Bağlantı hatası oluştu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
      } finally {
        setIsLoading(false);
      }
    },
    [productId, pathname, router, isAuthenticated, toggle]
  );

  const sizeClasses = useMemo(() => ({
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }), []);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "relative grid h-11 w-11 place-items-center bg-transparent hover:bg-foreground/5 dark:hover:bg-foreground/10 transition-colors transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isLoading && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={computedIsFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
      aria-busy={isLoading}
    >
      <Heart
        strokeWidth={1.75}
        fill={computedIsFavorite ? "currentColor" : "none"}
        className={cn(
          sizeClasses[size],
          computedIsFavorite
            ? "text-primary fav-icon-halo"
            : "text-foreground/90 fav-icon-halo",
          isLoading && "animate-pulse"
        )}
      />
    </button>
  );
}
