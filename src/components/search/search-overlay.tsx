"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search as SearchIcon, Mic } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DialogFullscreenContent } from "@/components/ui/dialog-fullscreen";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSearch } from "./search-provider";
import { formatPrice, getPrimaryImageUrl } from "@/lib/format";
import { SearchResultItem } from "./search-result-item";
import { POPULAR_QUERIES } from "@/lib/search/popular";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import { useIsHydrated } from "@/hooks/use-is-hydrated";

const RECENT_SEARCHES_KEY = "ch_recent_searches";
const MAX_RECENT_SEARCHES = 8;
const DEBOUNCE_MS = 200;

interface SearchResult {
  id: number;
  name: string;
  slug: string;
  price: number | null;
  images: unknown;
}

interface SearchCategory {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

interface SearchResponse {
  items: SearchResult[];
  categories: SearchCategory[];
  fallbackCategory: SearchCategory | null;
  fallbackItems: SearchResult[];
}

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined" || !query.trim()) return;
  try {
    const recent = getRecentSearches();
    const filtered = recent.filter((q) => q !== query);
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function SearchOverlay() {
  const { open, query, setQuery, closeSearch } = useSearch();
  const router = useRouter();
  const hydrated = useIsHydrated();
  const { isListening, isSupported, startListening } = useVoiceSearch({
    onResult: () => {
      closeSearch(); // Dialog'u kapatır
    },
  });
  const [searchData, setSearchData] = useState<SearchResponse>({
    items: [],
    categories: [],
    fallbackCategory: null,
    fallbackItems: [],
  });
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [vvh, setVvh] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldShowVoiceButton = hydrated && isSupported;

  // Recent searches'i yükle
  useEffect(() => {
    if (!open) {
      setRecentSearches([]);
      return;
    }
    if (!hydrated) {
      return;
    }
    setRecentSearches(getRecentSearches());
  }, [open, hydrated]);

  // VisualViewport fallback (Android/iOS keyboard animasyonu)
  useEffect(() => {
    if (!open) {
      setVvh(null);
      return;
    }

    const update = () => {
      const vv = window.visualViewport;
      setVvh(vv?.height ?? window.innerHeight);
    };

    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Autofocus & scroll stability
  useEffect(() => {
    if (!open) return;

    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // rAF ile focus
    requestAnimationFrame(focusInput);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchData({
        items: [],
        categories: [],
        fallbackCategory: null,
        fallbackItems: [],
      });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchData({
            items: data.items || [],
            categories: data.categories || [],
            fallbackCategory: data.fallbackCategory || null,
            fallbackItems: data.fallbackItems || [],
          });
        } else {
          setSearchData({
            items: [],
            categories: [],
            fallbackCategory: null,
            fallbackItems: [],
          });
        }
      } catch {
        setSearchData({
          items: [],
          categories: [],
          fallbackCategory: null,
          fallbackItems: [],
        });
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // ESC ile kapatma
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, closeSearch]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      saveRecentSearch(query.trim());
      closeSearch();
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    [query, closeSearch, router]
  );

  const handleRecentClick = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
    },
    [setQuery]
  );

  const handlePopularClick = useCallback(
    (popularQuery: string) => {
      setQuery(popularQuery);
    },
    [setQuery]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeSearch()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60" />
        <DialogFullscreenContent
          style={{ height: vvh ? `${vvh}px` : undefined }}
          className="bg-background"
          onInteractOutside={(e) => {
            e.preventDefault();
            closeSearch();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            closeSearch();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            closeSearch();
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle asChild>
              <VisuallyHidden>Arama</VisuallyHidden>
            </DialogTitle>
            <DialogDescription asChild>
              <VisuallyHidden>Ürün ve kategori araması yapın.</VisuallyHidden>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header (sticky top-0): close + input + button — SCROLL YOK */}
            <div
              className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            >
              <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={closeSearch}
                  aria-label="Kapat"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-accent active:scale-[0.98]"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ürün, kategori ara…"
                    className="h-10 w-full rounded-xl border border-input bg-muted/50 pl-10 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label="Arama"
                  />
                  {shouldShowVoiceButton && (
                    <button
                      type="button"
                      onClick={startListening}
                      aria-label="Sesli arama"
                      className={`absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 grid place-items-center rounded-xl transition-colors active:scale-[0.98] ${
                        isListening
                          ? "bg-destructive text-destructive-foreground animate-pulse ring-2 ring-destructive ring-offset-2"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Mic className={`h-5 w-5 ${isListening ? "text-destructive-foreground" : ""}`} />
                    </button>
                  )}
                </div>
                {query.trim() && (
                  <button
                    type="submit"
                    aria-label="Ara"
                    className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
                  >
                    Ara
                  </button>
                )}
              </form>
            </div>

            {/* Body (flex-1 overflow-y-auto): sonuçlar — TEK SCROLL BURADA */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain p-4"
              style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
            >
            {!query.trim() ? (
              /* Boş durum: Son aramalar */
              <div className="space-y-4">
                {recentSearches.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                      Son Aramalar
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((recentQuery, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecentClick(recentQuery)}
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent active:scale-[0.98]"
                        >
                          {recentQuery}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Popüler
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_QUERIES.map((popularQuery, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePopularClick(popularQuery)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent active:scale-[0.98]"
                      >
                        {popularQuery}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : loading ? (
              /* Yükleniyor */
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 min-h-[72px]"
                  >
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-muted animate-pulse" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchData.items.length > 0 || searchData.categories.length > 0 || searchData.fallbackItems.length > 0 ? (
              /* Sonuçlar */
              <div className="space-y-4">
                {/* Kategoriler */}
                {searchData.categories.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                      Kategoriler
                    </h3>
                    <div className="space-y-2">
                      {searchData.categories.map((category) => (
                        <SearchResultItem
                          key={category.id}
                          title={category.name}
                          href={`/${category.slug}`}
                          imageUrl={category.imageUrl}
                          onSelect={closeSearch}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Ürünler veya Fallback Ürünler */}
                {(searchData.items.length > 0 || searchData.fallbackItems.length > 0) && (
                  <div>
                    {searchData.fallbackCategory && searchData.items.length === 0 ? (
                      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                        {searchData.fallbackCategory.name} kategorisindeki ürünler
                      </h3>
                    ) : (
                      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                        Ürünler
                      </h3>
                    )}
                    <div className="space-y-2">
                      {(searchData.items.length > 0 ? searchData.items : searchData.fallbackItems).map((item) => {
                        const imageUrl = getPrimaryImageUrl(item.images);
                        return (
                          <SearchResultItem
                            key={item.id}
                            title={item.name}
                            subtitle={item.price !== null ? formatPrice(item.price) : undefined}
                            href={`/urun/${item.slug}`}
                            imageUrl={imageUrl}
                            onSelect={closeSearch}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Sonuç yok */
              <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-border bg-card px-4">
                <p className="text-sm font-medium text-foreground">
                  Sonuç bulunamadı
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Yazımı kontrol edin veya farklı bir kelime deneyin
                </p>
              </div>
            )}
          </div>
          </div>
        </DialogFullscreenContent>
      </DialogPortal>
    </Dialog>
  );
}
