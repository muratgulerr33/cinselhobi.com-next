"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useHeaderContext } from "@/components/layout/header-context";
import type { CatalogParamsFromUrl } from "@/components/layout/header-context";

const validSorts = ["newest", "price_asc", "price_desc", "name_asc"];

interface ChildCategory {
  id: number;
  wcId: number;
  name: string;
  slug: string;
}

function parseCatalogParamsFromSearchParams(
  searchParams: URLSearchParams,
  childCategories: ChildCategory[] = []
): CatalogParamsFromUrl {
  const sortParam = searchParams.get("sort");
  const sort =
    sortParam && validSorts.includes(sortParam)
      ? (sortParam as CatalogParamsFromUrl["sort"])
      : "newest";

  const minPriceParam = searchParams.get("min");
  let minPrice: number | null = null;
  if (minPriceParam) {
    const parsed = Number(minPriceParam);
    if (!Number.isNaN(parsed) && parsed >= 0) minPrice = parsed;
  }

  const maxPriceParam = searchParams.get("max");
  let maxPrice: number | null = null;
  if (maxPriceParam) {
    const parsed = Number(maxPriceParam);
    if (!Number.isNaN(parsed) && parsed >= 0) maxPrice = parsed;
  }

  const inStockParam = searchParams.get("inStock");
  const inStock =
    inStockParam === "1" || inStockParam === "true" ? true : inStockParam === "0" || inStockParam === "false" ? false : null;

  let subCategoryIds: number[] | null = null;
  const subParam = searchParams.get("sub");
  if (subParam) {
    const wcIdToInternalIdMap = new Map(childCategories.map((category) => [category.wcId, category.id]));
    const ids = subParam
      .split(",")
      .map((wcId) => {
        const parsed = Number(wcId.trim());
        if (Number.isNaN(parsed)) return null;
        return wcIdToInternalIdMap.get(parsed) ?? null;
      })
      .filter((id): id is number => id !== null);
    if (ids.length > 0) subCategoryIds = ids;
  }

  const subCategoryIdsParam = searchParams.get("subCategoryIds");
  if (subCategoryIds === null && subCategoryIdsParam) {
    const ids = subCategoryIdsParam
      .split(",")
      .map((id) => {
        const parsed = Number(id.trim());
        return !Number.isNaN(parsed) ? parsed : null;
      })
      .filter((id): id is number => id !== null);
    if (ids.length > 0) subCategoryIds = ids;
  }

  return { sort, minPrice, maxPrice, inStock, subCategoryIds };
}

/**
 * Rendered only on category ([slug]) page. Syncs URL search params to header context
 * so the header can show CatalogControls without using useSearchParams in the root layout.
 */
export function CategoryCatalogParamsSync({ childCategories = [] }: { childCategories?: ChildCategory[] }) {
  const searchParams = useSearchParams();
  const { setCatalogParams } = useHeaderContext();

  useEffect(() => {
    setCatalogParams(parseCatalogParamsFromSearchParams(searchParams, childCategories));
  }, [searchParams, setCatalogParams, childCategories]);

  return null;
}
