"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/components/favorites/favorites-provider";
import { getFavoriteIntent, consumeFavoriteIntent } from "@/lib/favorites-intent";
import { toast } from "sonner";

/**
 * FavoritesIntentConsumer
 * 
 * Auth sonrası callbackUrl ile geri dönülen sayfada intent'i tüketip
 * favoriyi ekler ve toast gösterir.
 */
export function FavoritesIntentConsumer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    // Auth değilse hiçbir şey yapma
    if (!isAuthenticated) {
      return;
    }

    // Intent'i oku
    const intent = getFavoriteIntent();
    if (!intent) {
      return;
    }

    // Mevcut sayfayı oluştur: pathname + search + hash
    const search = searchParams.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const current = pathname + (search ? `?${search}` : "") + hash;

    // Intent'teki `from` ile mevcut sayfa eşleşmiyorsa hiçbir şey yapma
    // (toast yanlış sayfada patlamasın)
    if (current !== intent.from) {
      return;
    }

    // Ürün zaten favoride mi kontrol et
    const alreadyFavorite = isFavorite(intent.productId);

    // Favoride değilse ekle
    if (!alreadyFavorite) {
      toggle(intent.productId, pathname)
        .then((result) => {
          if (result.ok) {
            toast.success("Ürününüz favorilere eklendi.");
            // Intent'i tüket (sil)
            consumeFavoriteIntent();
          }
        })
        .catch((error) => {
          console.error("[FavoritesIntentConsumer] Favori ekleme hatası:", error);
        });
    } else {
      // Zaten favorideyse sadece intent'i tüket
      consumeFavoriteIntent();
    }
  }, [isAuthenticated, pathname, searchParams, isFavorite, toggle]);

  // Bu component görsel bir şey render etmez
  return null;
}

