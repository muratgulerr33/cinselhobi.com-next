"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useHeaderContext } from "@/components/layout/header-context";
import { useMemo } from "react";

export function ActiveFiltersBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categoryInfo } = useHeaderContext();

  // Sadece kategori sayfalarında göster (home'da değil)
  const isCategoryPage = useMemo(() => {
    return pathname !== "/" && !pathname.startsWith("/search") && !pathname.startsWith("/account");
  }, [pathname]);

  // Search params'ı oku
  const sort = searchParams.get("sort");
  const min = searchParams.get("min");
  const max = searchParams.get("max");
  const inStock = searchParams.get("inStock");
  const sub = searchParams.get("sub");

  // childCategories'dan wcId->name map oluştur
  const wcIdToNameMap = useMemo(() => {
    if (!categoryInfo?.childCategories) return new Map<number, string>();
    const map = new Map<number, string>();
    categoryInfo.childCategories.forEach((cat) => {
      map.set(cat.wcId, cat.name);
    });
    return map;
  }, [categoryInfo]);

  // Aktif filtreleri topla
  const activeFilters = useMemo(() => {
    const filters: Array<{ type: string; label: string; removeFn: () => void }> = [];

    // Sort chip
    if (sort) {
      let sortLabel = "";
      switch (sort) {
        case "newest":
          sortLabel = "Yeni";
          break;
        case "price_asc":
          sortLabel = "Fiyat ↑";
          break;
        case "price_desc":
          sortLabel = "Fiyat ↓";
          break;
        case "name_asc":
          sortLabel = "A→Z";
          break;
        default:
          sortLabel = sort;
      }
      filters.push({
        type: "sort",
        label: sortLabel,
        removeFn: () => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("sort");
          router.push(`${pathname}?${params.toString()}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    }

    // Fiyat chip
    if (min || max) {
      let priceLabel = "";
      if (min && max) {
        priceLabel = `${min}–${max} TL`;
      } else if (min) {
        priceLabel = `${min} TL+`;
      } else if (max) {
        priceLabel = `${max} TL-`;
      }
      filters.push({
        type: "price",
        label: priceLabel,
        removeFn: () => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("min");
          params.delete("max");
          router.push(`${pathname}?${params.toString()}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    }

    // Stok chip
    if (inStock === "1" || inStock === "true") {
      filters.push({
        type: "inStock",
        label: "Stokta",
        removeFn: () => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("inStock");
          router.push(`${pathname}?${params.toString()}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    }

    // Sub (alt kategori) chip'leri
    if (sub) {
      const wcIds = sub.split(",").map((id) => Number(id.trim())).filter((id) => !Number.isNaN(id));
      wcIds.forEach((wcId) => {
        const name = wcIdToNameMap.get(wcId) || `Alt kategori ${wcId}`;
        filters.push({
          type: "sub",
          label: name,
          removeFn: () => {
            const params = new URLSearchParams(searchParams.toString());
            const currentSub = params.get("sub");
            if (currentSub) {
              const remainingIds = currentSub
                .split(",")
                .map((id) => Number(id.trim()))
                .filter((id) => !Number.isNaN(id) && id !== wcId);
              
              if (remainingIds.length > 0) {
                params.set("sub", remainingIds.join(","));
              } else {
                params.delete("sub");
              }
            }
            router.push(`${pathname}?${params.toString()}`);
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
        });
      });
    }

    return filters;
  }, [sort, min, max, inStock, sub, wcIdToNameMap, searchParams, pathname, router]);

  // "Temizle" fonksiyonu
  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sort");
    params.delete("min");
    params.delete("max");
    params.delete("inStock");
    params.delete("sub");
    router.push(`${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Boş state: hiç aktif filtre yoksa null dön
  if (!isCategoryPage || activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
      {activeFilters.map((filter, index) => (
        <button
          key={`${filter.type}-${index}`}
          onClick={filter.removeFn}
          className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border border-border bg-background/80 backdrop-blur hover:opacity-90 transition whitespace-nowrap"
        >
          <span>{filter.label}</span>
          <span className="text-muted-foreground">×</span>
        </button>
      ))}
      <button
        onClick={clearAll}
        className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border border-red-200 text-red-500 bg-background/80 backdrop-blur hover:opacity-90 transition whitespace-nowrap"
      >
        <span>Temizle</span>
      </button>
    </div>
  );
}

