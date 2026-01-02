"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getMyFavoriteProductIdsAction } from "@/actions/favorites";
import { toggleFavoriteAction } from "@/actions/favorites";
import { FavoritesIntentConsumer } from "./favorites-intent-consumer";

interface FavoritesContextType {
  favoriteIds: Set<number>;
  hydrated: boolean;
  isFavorite: (productId: number) => boolean;
  toggle: (
    productId: number,
    pathname: string
  ) => Promise<{ ok: boolean; error?: string; isFavorite: boolean }>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate favorite IDs from server
  useEffect(() => {
    if (session?.user?.id) {
      getMyFavoriteProductIdsAction().then((result) => {
        if (result.ok) {
          setFavoriteIds(new Set(result.productIds));
        }
        // Hydration için sync setState gerekli
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHydrated(true);
      });
    } else {
      // Hydration için sync setState gerekli
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavoriteIds(new Set());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHydrated(true);
    }
  }, [session?.user?.id]);

  const isFavorite = useCallback(
    (productId: number) => {
      return favoriteIds.has(productId);
    },
    [favoriteIds]
  );

  const toggle = useCallback(
    async (productId: number, pathname: string) => {
      if (!session?.user?.id) {
        const callbackUrl = encodeURIComponent(pathname);
        window.location.href = `/login?callbackUrl=${callbackUrl}`;
        return { ok: false, error: "Unauthorized" as const, isFavorite: false };
      }

      // Optimistic update - use functional update to avoid dependency on favoriteIds
      let currentValue: boolean;
      setFavoriteIds((prev) => {
        currentValue = prev.has(productId);
        const next = new Set(prev);
        if (!currentValue) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
        return next;
      });

      // Server action
      const result = await toggleFavoriteAction(productId);

      if (!result.ok) {
        // Rollback on error
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (currentValue!) {
            next.add(productId);
          } else {
            next.delete(productId);
          }
          return next;
        });

        if (result.error === "Unauthorized") {
          const callbackUrl = encodeURIComponent(pathname);
          window.location.href = `/login?callbackUrl=${callbackUrl}`;
          return result;
        }

        console.error("Favori ekleme/çıkarma hatası:", result.error);
        alert("Bir hata oluştu. Lütfen tekrar deneyin.");
        return result;
      } else {
        // Final state from server (truth)
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (result.isFavorite) {
            next.add(productId);
          } else {
            next.delete(productId);
          }
          return next;
        });
        return result;
      }
    },
    [session?.user?.id]
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds, hydrated, isFavorite, toggle }}>
      {children}
      <FavoritesIntentConsumer />
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}

