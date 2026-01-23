"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ArrowUpDown } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeCategoryName } from "@/lib/format/normalize-category-name";

type SortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

interface ChildCategory {
  id: number;
  wcId: number;
  name: string;
  slug: string;
}

interface CatalogControlsProps {
  categorySlug: string;
  childCategories?: ChildCategory[];
  initialSort?: SortOption;
  initialMinPrice?: number | null;
  initialMaxPrice?: number | null;
  initialInStock?: boolean | null;
  initialSubCategoryIds?: number[] | null; // Deprecated: wcId array, will be replaced by sub param
}

type TabType = "filter" | "sort";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "En Yeni" },
  { value: "price_asc", label: "Fiyat: Düşükten Yükseğe" },
  { value: "price_desc", label: "Fiyat: Yüksekten Düşüğe" },
  { value: "name_asc", label: "İsim: A'dan Z'ye" },
];

export function CatalogControls({
  categorySlug,
  childCategories = [],
  initialSort = "newest",
  initialMinPrice = null,
  initialMaxPrice = null,
  initialInStock = false,
  initialSubCategoryIds = null,
}: CatalogControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("filter");

  // Form state
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [minPrice, setMinPrice] = useState<string>(initialMinPrice?.toString() || "");
  const [maxPrice, setMaxPrice] = useState<string>(initialMaxPrice?.toString() || "");
  const [inStock, setInStock] = useState<boolean>(initialInStock || false);
  const [selectedSubCategories, setSelectedSubCategories] = useState<number[]>(
    initialSubCategoryIds || []
  );

  // Aktif filtre sayısını hesapla
  const activeFilterCount = [
    minPrice,
    maxPrice,
    inStock,
    selectedSubCategories.length > 0,
  ].filter(Boolean).length;

  const openDrawer = (tab: TabType) => {
    setActiveTab(tab);
    setDrawerOpen(true);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Sort
    if (sort !== "newest") {
      params.set("sort", sort);
    } else {
      params.delete("sort");
    }

    // Fiyat aralığı
    if (minPrice) {
      const min = Number(minPrice);
      if (!Number.isNaN(min) && min >= 0) {
        params.set("min", String(min));
      } else {
        params.delete("min");
      }
    } else {
      params.delete("min");
    }

    if (maxPrice) {
      const max = Number(maxPrice);
      if (!Number.isNaN(max) && max >= 0) {
        params.set("max", String(max));
      } else {
        params.delete("max");
      }
    } else {
      params.delete("max");
    }

    // Stok durumu
    if (inStock) {
      params.set("inStock", "1");
    } else {
      params.delete("inStock");
    }

    // Alt kategoriler - wcId'leri sub parametresi olarak gönder
    if (selectedSubCategories.length > 0) {
      const selectedWcIds = childCategories
        .filter((cat) => selectedSubCategories.includes(cat.id))
        .map((cat) => cat.wcId);
      if (selectedWcIds.length > 0) {
        params.set("sub", selectedWcIds.join(","));
      } else {
        params.delete("sub");
      }
    } else {
      params.delete("sub");
    }
    
    // Eski subCategoryIds parametresini kaldır
    params.delete("subCategoryIds");

    router.push(`/${categorySlug}?${params.toString()}`);
    setDrawerOpen(false);
  };

  const clearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setSelectedSubCategories([]);
    setSort("newest");
    
    const params = new URLSearchParams();
    router.push(`/${categorySlug}`);
    setDrawerOpen(false);
  };

  const applySort = (selectedSort: SortOption) => {
    setSort(selectedSort);
    const params = new URLSearchParams(searchParams.toString());
    
    if (selectedSort !== "newest") {
      params.set("sort", selectedSort);
    } else {
      params.delete("sort");
    }

    router.push(`/${categorySlug}?${params.toString()}`);
    setDrawerOpen(false);
  };

  const toggleSubCategory = (categoryId: number) => {
    setSelectedSubCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => openDrawer("filter")}
          aria-label="Filtrele"
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-border bg-card/50 transition-all hover:bg-accent active:scale-[0.98]"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => openDrawer("sort")}
          aria-label="Sırala"
          className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card/50 transition-all hover:bg-accent active:scale-[0.98]"
        >
          <ArrowUpDown className="h-5 w-5" />
        </button>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {activeTab === "filter" ? "Filtrele" : "Sırala"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Segmented Control */}
            <div className="mb-6 flex rounded-lg border border-border bg-muted p-1">
              <button
                onClick={() => setActiveTab("filter")}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "filter"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Filtrele
              </button>
              <button
                onClick={() => setActiveTab("sort")}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "sort"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sırala
              </button>
            </div>

            {/* Filter Tab */}
            {activeTab === "filter" && (
              <div className="space-y-6">
                {/* Fiyat Aralığı */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Fiyat Aralığı</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Min (₺)
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Max (₺)
                      </label>
                      <Input
                        type="number"
                        placeholder="10000"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Stok Durumu */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={inStock}
                      onChange={(e) => setInStock(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm font-medium">Sadece stokta olanlar</span>
                  </label>
                </div>

                {/* Alt Kategoriler */}
                {childCategories.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Alt Kategoriler</h3>
                    <div className="space-y-2">
                      {childCategories.map((cat) => (
                        <label
                          key={cat.id}
                          className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSubCategories.includes(cat.id)}
                            onChange={() => toggleSubCategory(cat.id)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="text-sm">{normalizeCategoryName(cat.name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sort Tab */}
            {activeTab === "sort" && (
              <div className="space-y-2">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => applySort(option.value)}
                    className={cn(
                      "w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent",
                      sort === option.value && "border-primary bg-accent"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{option.label}</span>
                      {sort === option.value && (
                        <span className="text-primary">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DrawerFooter>
            {activeTab === "filter" && (
              <>
                <Button onClick={applyFilters} className="w-full">
                  Uygula
                </Button>
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                >
                  Temizle
                </Button>
              </>
            )}
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                Kapat
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

