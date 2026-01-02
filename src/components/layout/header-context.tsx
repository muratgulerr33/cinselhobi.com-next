"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface CategoryInfo {
  slug: string;
  childCategories?: Array<{ id: number; wcId: number; name: string; slug: string }>;
  childKey?: string;
}

interface HeaderContextType {
  title: string | null;
  setTitle: (title: string) => void;
  clearTitle: () => void;
  categoryInfo: CategoryInfo | null;
  setCategoryInfo: (info: CategoryInfo | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState<string | null>(null);
  const [categoryInfo, setCategoryInfoState] = useState<CategoryInfo | null>(null);
  const pathname = usePathname();

  // Route değişince title ve category info'yu sıfırla
  useEffect(() => {
    // Reset için sync setState gerekli - route değişiminde state temizleme
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitleState(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryInfoState(null);
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

  const value = useMemo(
    () => ({ title, setTitle, clearTitle, categoryInfo, setCategoryInfo }),
    [title, categoryInfo, setCategoryInfo]
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

