"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SearchContextType {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  openSearch: (initialQuery?: string) => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState("");

  const setQuery = (q: string) => {
    setQueryState(q);
  };

  const openSearch = (initialQuery?: string) => {
    if (initialQuery) {
      setQueryState(initialQuery);
    }
    setOpen(true);
  };

  const closeSearch = () => {
    setOpen(false);
    setQueryState("");
  };

  return (
    <SearchContext.Provider
      value={{
        open,
        query,
        setQuery,
        openSearch,
        closeSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}

