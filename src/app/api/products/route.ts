import { NextRequest } from "next/server";
import { getLatestProductsCursor, getProductsCursor, getNextCursor, countProductsInScope, type SortOption } from "@/db/queries/catalog";
import { PRODUCTS_PER_PAGE } from "@/config/catalog";
import { db } from "@/db/connection";
import { categories } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  
  const searchParams = request.nextUrl.searchParams;
  const limitParam = searchParams.get("limit");
  // Cursor = wcId (legacy WooCommerce id). Accept both names for clarity and backward compat.
  const cursorParam = searchParams.get("cursorWcId") ?? searchParams.get("cursor");
  const categorySlug = searchParams.get("categorySlug");
  const sortParam = searchParams.get("sort");
  const minPriceParam = searchParams.get("min");
  const maxPriceParam = searchParams.get("max");
  const inStockParam = searchParams.get("inStock");
  const subParam = searchParams.get("sub");
  // Eski subCategoryIds parametresini de destekle (geriye dönük uyumluluk)
  const subCategoryIdsParam = searchParams.get("subCategoryIds");

  // Limit'i parse et ve clamp et (1..50)
  let limit = PRODUCTS_PER_PAGE;
  if (limitParam) {
    const parsed = Number(limitParam);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.max(1, Math.min(Math.floor(parsed), 50));
    }
  }

  // Cursor = wcId (orderBy wcId DESC, WHERE wcId < cursor). Parse cursorWcId or cursor.
  let cursor: number | null = null;
  if (cursorParam) {
    const parsed = Number(cursorParam);
    if (!Number.isNaN(parsed)) {
      cursor = Math.floor(parsed);
    }
  }

  // Sort'u parse et
  const validSorts: SortOption[] = ["newest", "price_asc", "price_desc", "name_asc"];
  let sort: SortOption = "newest";
  if (sortParam && validSorts.includes(sortParam as SortOption)) {
    sort = sortParam as SortOption;
  }

  // TL -> kuruş dönüşümü
  let minPriceKurus: number | null = null;
  if (minPriceParam) {
    const minTl = Number(minPriceParam);
    if (Number.isFinite(minTl) && minTl >= 0) {
      minPriceKurus = Math.round(minTl * 100);
    }
  }

  let maxPriceKurus: number | null = null;
  if (maxPriceParam) {
    const maxTl = Number(maxPriceParam);
    if (Number.isFinite(maxTl) && maxTl >= 0) {
      maxPriceKurus = Math.round(maxTl * 100);
    }
  }

  // Stok durumunu parse et
  let inStock: boolean | null = null;
  if (inStockParam === "1" || inStockParam === "true") {
    inStock = true;
  }

  // sub parametresini parse et (wcId'ler virgülle ayrılmış)
  let subCategoryIds: number[] | null = null;
  if (subParam) {
    const wcIds = subParam.split(",").map((id) => {
      const parsed = Number(id.trim());
      return !Number.isNaN(parsed) ? parsed : null;
    }).filter((id): id is number => id !== null);
    
    if (wcIds.length > 0) {
      // wcId'lerden internal id'lere çevir
      const categoryRecords = await db
        .select({ id: categories.id })
        .from(categories)
        .where(inArray(categories.wcId, wcIds));
      
      subCategoryIds = categoryRecords.map((c) => c.id);
    }
  } else if (subCategoryIdsParam) {
    // Eski subCategoryIds parametresini destekle (geriye dönük uyumluluk)
    const ids = subCategoryIdsParam.split(",").map((id) => {
      const parsed = Number(id.trim());
      return !Number.isNaN(parsed) ? parsed : null;
    }).filter((id): id is number => id !== null);
    
    if (ids.length > 0) {
      subCategoryIds = ids;
    }
  }

  // Eğer hiçbir filtre yoksa eski fonksiyonu kullan (geriye dönük uyumluluk)
  const hasFilters = categorySlug || sort !== "newest" || minPriceKurus !== null || maxPriceKurus !== null || inStock !== null || subCategoryIds !== null;

  let products;
  if (hasFilters) {
    products = await getProductsCursor({
      limit,
      cursor,
      categorySlug: categorySlug || null,
      sort,
      minPrice: minPriceKurus,
      maxPrice: maxPriceKurus,
      inStock,
      subCategoryIds,
      userId,
    });
  } else {
    products = await getLatestProductsCursor({ limit, cursor, userId });
  }
  
  // Next cursor'ı hesapla
  const nextCursor = getNextCursor(products, limit);

  const responseData = { products, nextCursor };
  
  return new Response(JSON.stringify(responseData), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

