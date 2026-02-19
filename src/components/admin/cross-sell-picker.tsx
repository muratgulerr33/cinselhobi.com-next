"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateProductCrossSell } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SafeImage } from "@/components/ui/safe-image";
import { getPrimaryImageUrl } from "@/lib/format";

const MAX_CROSS_SELL_ITEMS = 10;
const SEARCH_DEBOUNCE_MS = 250;

interface CrossSellProductItem {
  id: number;
  slug: string;
  name: string;
  price: number | null;
  salePrice: number | null;
  regularPrice: number | null;
  currency: string;
  images: unknown;
  stockStatus: string | null;
}

interface CrossSellPickerProps {
  productId: number;
  productSlug: string;
  initialSelectedIds?: number[] | null;
  onSaved?: () => void;
}

function normalizeIds(ids: number[] | null | undefined, currentProductId: number): number[] {
  if (!ids?.length) return [];

  const normalized: number[] = [];
  const seen = new Set<number>();

  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) continue;
    if (id === currentProductId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
    if (normalized.length >= MAX_CROSS_SELL_ITEMS) break;
  }

  return normalized;
}

async function fetchCrossSellProducts(params: {
  q?: string;
  ids?: number[];
  excludeProductId?: number;
  limit?: number;
}): Promise<CrossSellProductItem[]> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.ids && params.ids.length > 0) searchParams.set("ids", params.ids.join(","));
  if (typeof params.excludeProductId === "number") {
    searchParams.set("excludeProductId", String(params.excludeProductId));
  }
  if (typeof params.limit === "number") searchParams.set("limit", String(params.limit));

  const response = await fetch(`/api/admin/products/search?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Ürün araması başarısız oldu");
  }

  const data = (await response.json()) as { items?: CrossSellProductItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export function CrossSellPicker({
  productId,
  productSlug,
  initialSelectedIds,
  onSaved,
}: CrossSellPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CrossSellProductItem[]>([]);
  const [selected, setSelected] = useState<CrossSellProductItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [didLoadInitial, setDidLoadInitial] = useState(false);
  const [isSaving, startSavingTransition] = useTransition();

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);
  const normalizedInitialIds = useMemo(
    () => normalizeIds(initialSelectedIds, productId),
    [initialSelectedIds, productId]
  );
  const isInitialLoading = open && !didLoadInitial && normalizedInitialIds.length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      if (!didLoadInitial && normalizedInitialIds.length === 0) {
        setDidLoadInitial(true);
        setSelected([]);
      }
      return;
    }

    setQuery("");
    setSearchResults([]);
    setIsSearching(false);
  };

  useEffect(() => {
    if (!open || didLoadInitial || normalizedInitialIds.length === 0) {
      return;
    }

    let cancelled = false;

    fetchCrossSellProducts({ ids: normalizedInitialIds, excludeProductId: productId })
      .then((items) => {
        if (cancelled) return;
        setSelected(items.slice(0, MAX_CROSS_SELL_ITEMS));
        setDidLoadInitial(true);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Seçili çapraz satış ürünleri yüklenemedi");
        setDidLoadInitial(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, didLoadInitial, normalizedInitialIds, productId]);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (!q) {
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      fetchCrossSellProducts({ q, excludeProductId: productId, limit: 20 })
        .then((items) => {
          if (cancelled) return;
          setSearchResults(items);
        })
        .catch(() => {
          if (cancelled) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [open, query, productId]);

  const handleAdd = (item: CrossSellProductItem) => {
    if (item.id === productId) return;
    if (selectedIds.has(item.id)) return;
    if (selected.length >= MAX_CROSS_SELL_ITEMS) {
      toast.error(`En fazla ${MAX_CROSS_SELL_ITEMS} ürün seçebilirsiniz`);
      return;
    }
    setSelected((prev) => [...prev, item]);
  };

  const handleRemove = (id: number) => {
    setSelected((prev) => prev.filter((item) => item.id !== id));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    setSelected((prev) => {
      const next = [...prev];
      if (direction === "up" && index > 0) {
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
      }
      if (direction === "down" && index < next.length - 1) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
      return next;
    });
  };

  const handleSave = () => {
    const payloadIds = selected.map((item) => item.id);

    startSavingTransition(async () => {
      const result = await updateProductCrossSell(
        productId,
        payloadIds.length > 0 ? payloadIds : null
      );

      if (!result.success) {
        toast.error(result.error || "Kaydetme sırasında bir hata oluştu");
        return;
      }

      const persistedIds = normalizeIds(result.crossSellIds ?? null, productId);
      if (persistedIds.length === 0) {
        setSelected([]);
      } else {
        try {
          const refreshed = await fetchCrossSellProducts({
            ids: persistedIds,
            excludeProductId: productId,
          });
          setSelected(refreshed.slice(0, MAX_CROSS_SELL_ITEMS));
        } catch {
          setSelected((prev) => prev.filter((item) => persistedIds.includes(item.id)));
        }
      }

      toast.success("Çapraz satış seçimleri kaydedildi");
      onSaved?.();
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Çapraz Satış
      </Button>

      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Çapraz Satış Yönetimi</DrawerTitle>
            <DrawerDescription className="text-xs sm:text-sm">
              Ürün: /{productSlug} ({productId})
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              <label htmlFor={`cross-sell-search-${productId}`} className="text-sm font-medium">
                Ürün Ara
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`cross-sell-search-${productId}`}
                  type="search"
                  placeholder="Ürün adı veya slug"
                  value={query}
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    setQuery(nextQuery);
                    if (!nextQuery.trim()) {
                      setSearchResults([]);
                      setIsSearching(false);
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                En fazla {MAX_CROSS_SELL_ITEMS} ürün seçebilirsiniz.
              </p>
            </div>

            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2 text-sm font-medium">
                Arama Sonuçları
              </div>
              <div className="max-h-56 overflow-y-auto">
                {!query.trim() ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Arama yapın.</p>
                ) : isSearching ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Aranıyor...</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Sonuç bulunamadı.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {searchResults.map((item) => {
                      const imageUrl = getPrimaryImageUrl(item.images);
                      const alreadySelected = selectedIds.has(item.id);

                      return (
                        <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                          <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border bg-muted">
                            {imageUrl ? (
                              <SafeImage
                                src={imageUrl}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              /{item.slug} ({item.id})
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAdd(item)}
                            disabled={alreadySelected || selected.length >= MAX_CROSS_SELL_ITEMS}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium">Seçilenler</span>
                <span className="text-xs text-muted-foreground">
                  {selected.length}/{MAX_CROSS_SELL_ITEMS}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {isInitialLoading ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Yükleniyor...</p>
                ) : selected.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    Henüz ürün seçilmedi.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {selected.map((item, index) => {
                      const imageUrl = getPrimaryImageUrl(item.images);

                      return (
                        <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                          <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
                          <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border bg-muted">
                            {imageUrl ? (
                              <SafeImage
                                src={imageUrl}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              /{item.slug} ({item.id})
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => moveItem(index, "up")}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => moveItem(index, "down")}
                              disabled={index === selected.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemove(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t border-border">
            <Button type="button" onClick={handleSave} disabled={isSaving || isInitialLoading}>
              <Save className="h-4 w-4" />
              {isSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
