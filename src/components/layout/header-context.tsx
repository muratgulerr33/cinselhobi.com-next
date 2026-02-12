"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface CategoryInfo {
  slug: string;
  childCategories?: Array<{ id: number; wcId: number; name: string; slug: string }>;
  childKey?: string;
}

export interface CatalogParamsFromUrl {
  sort: "newest" | "price_asc" | "price_desc" | "name_asc";
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean | null;
  subCategoryIds: number[] | null;
}

const DEFAULT_CATALOG_PARAMS: CatalogParamsFromUrl = {
  sort: "newest",
  minPrice: null,
  maxPrice: null,
  inStock: null,
  subCategoryIds: null,
};

interface HeaderContextType {
  title: string | null;
  setTitle: (title: string) => void;
  clearTitle: () => void;
  categoryInfo: CategoryInfo | null;
  setCategoryInfo: (info: CategoryInfo | null) => void;
  catalogParams: CatalogParamsFromUrl;
  setCatalogParams: (params: CatalogParamsFromUrl) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState<string | null>(null);
  const [categoryInfo, setCategoryInfoState] = useState<CategoryInfo | null>(null);
  const [catalogParams, setCatalogParamsState] = useState<CatalogParamsFromUrl>(DEFAULT_CATALOG_PARAMS);
  const pathname = usePathname();

  // Route değişince title, category info ve catalog params sıfırla
  useEffect(() => {
    // Reset için sync setState gerekli - route değişiminde state temizleme
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitleState(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryInfoState(null);
    setCatalogParamsState(DEFAULT_CATALOG_PARAMS);
  }, [pathname]);

  const setTitle = (newTitle: string) => {
    setTitleState(newTitle);
  };

  const clearTitle = () => {
    setTitleState(null);
  };

  const setCategoryInfo = useCallback((next: CategoryInfo | null) => {
    setCategoryInfoState((prev) => {
      if (prev === next) return prev;
      if (!prev || !next) return next;

      // childKey karşılaştırması
      const prevKey = prev.childKey ?? "";
      const nextKey = next.childKey ?? "";

      if (prev.slug === next.slug && prevKey === nextKey) {
        return prev; // aynı bilgi -> update yok
      }
      return next;
    });
  }, []);

  const setCatalogParams = useCallback((next: CatalogParamsFromUrl) => {
    setCatalogParamsState((prev) => (
      prev.sort === next.sort &&
      prev.minPrice === next.minPrice &&
      prev.maxPrice === next.maxPrice &&
      prev.inStock === next.inStock &&
      JSON.stringify(prev.subCategoryIds) === JSON.stringify(next.subCategoryIds)
        ? prev
        : next
    ));
  }, []);

  const value = useMemo(
    () => ({ title, setTitle, clearTitle, categoryInfo, setCategoryInfo, catalogParams, setCatalogParams }),
    [title, categoryInfo, setCategoryInfo, catalogParams, setCatalogParams]
  );

  return (
    <HeaderContext.Provider value={value}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderContext() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error("useHeaderContext must be used within a HeaderProvider");
  }
  return context;
}


