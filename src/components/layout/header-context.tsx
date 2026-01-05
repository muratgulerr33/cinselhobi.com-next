"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CategoryInfo {
  slug: string;
  childCategories?: Array<{ id: number; wcId: number; name: string; slug: string }>;
  childKey: string;
}

interface HeaderContextType {
  categoryInfo: CategoryInfo | null;
  setCategoryInfo: (info: CategoryInfo | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);

  return (
    <HeaderContext.Provider value={{ categoryInfo, setCategoryInfo }}>
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

