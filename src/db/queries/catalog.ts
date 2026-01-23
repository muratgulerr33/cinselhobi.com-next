import { db } from "@/db/connection";
import { categories, products, productCategories, userFavorites } from "@/db/schema";
import { eq, and, desc, isNull, or, ne, inArray, lt, asc, gte, lte, between, SQL, sql, count } from "drizzle-orm";

export async function getTopCategories(limit = 8) {
  // Rollup hesaplama: parent + tüm child kategorilerindeki publish ürün sayısı
  // Her top-level kategori için parent ve child kategorilerindeki ürünleri say
  const topLevelCats = await db
    .select({
      id: categories.id,
      wcId: categories.wcId,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      parentWcId: categories.parentWcId,
    })
    .from(categories)
    .where(or(isNull(categories.parentWcId), eq(categories.parentWcId, 0)))
    .orderBy(categories.name)
    .limit(limit);

  // Her top-level kategori için rollup hesapla
  const result = await Promise.all(
    topLevelCats.map(async (topCat) => {
      // Child kategorileri bul
      const childCats = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentWcId, topCat.wcId));

      // Parent + child kategori ID'lerini birleştir
      const allCategoryIds = [topCat.id, ...childCats.map((c) => c.id)];

      // Rollup: parent + child kategorilerindeki publish ürün sayısı
      const rollupResult = await db
        .select({
          rollupPublish: sql<number>`COUNT(DISTINCT CASE WHEN ${products.status} = 'publish' THEN ${products.id} END)`.as('rollup_publish'),
        })
        .from(productCategories)
        .innerJoin(products, eq(productCategories.productId, products.id))
        .where(inArray(productCategories.categoryId, allCategoryIds));

      const rollupPublish = rollupResult[0]?.rollupPublish ?? 0;

      return {
        ...topCat,
        rollupPublish,
      };
    })
  );

  // Sadece rollup_publish > 0 olanları filtrele
  const filtered = result.filter((cat) => cat.rollupPublish > 0);

  // rollupPublish alanını kaldır, sadece kategori bilgilerini döndür
  return filtered.map(({ rollupPublish, ...rest }) => rest);
}

export async function getLatestProducts(limit = 12) {
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .where(eq(products.status, "publish"))
    .orderBy(desc(products.updatedAt))
    .limit(limit);

  return result;
}

export async function getCategoryBySlug(slug: string) {
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return result[0] || null;
}

export async function getChildCategoriesByParentWcId(parentWcId: number) {
  // Child kategorileri çek ve her birinin direct_publish sayısını hesapla
  // direct_publish = o kategoride doğrudan publish olan ürün sayısı
  const result = await db
    .select({
      id: categories.id,
      wcId: categories.wcId,
      name: categories.name,
      slug: categories.slug,
      directPublish: sql<number>`COUNT(DISTINCT CASE WHEN ${products.status} = 'publish' THEN ${products.id} END)`.as('direct_publish'),
    })
    .from(categories)
    .leftJoin(productCategories, eq(categories.id, productCategories.categoryId))
    .leftJoin(products, eq(productCategories.productId, products.id))
    .where(eq(categories.parentWcId, parentWcId))
    .groupBy(categories.id, categories.wcId, categories.name, categories.slug)
    .having(sql`COUNT(DISTINCT CASE WHEN ${products.status} = 'publish' THEN ${products.id} END) > 0`)
    .orderBy(categories.name);

  // directPublish alanını kaldır, sadece kategori bilgilerini döndür
  return result.map(({ directPublish, ...rest }) => rest);
}

export async function getProductsByCategorySlug(slug: string, limit = 24) {
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .innerJoin(productCategories, eq(products.id, productCategories.productId))
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(and(eq(categories.slug, slug), eq(products.status, "publish")))
    .orderBy(desc(products.updatedAt))
    .limit(limit);

  return result;
}

export async function getProductBySlug(slug: string) {
  const result = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  return result[0] || null;
}

export async function getCategoriesForProduct(productId: number) {
  const result = await db
    .select({
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .innerJoin(productCategories, eq(categories.id, productCategories.categoryId))
    .where(eq(productCategories.productId, productId));

  return result;
}

export async function getRelatedProductsBySlug(slug: string, limit = 10) {
  // Önce mevcut ürünü bul
  const currentProduct = await getProductBySlug(slug);
  if (!currentProduct) {
    return [];
  }

  // Mevcut ürünün kategori ID'lerini çek
  const productCats = await db
    .select({
      categoryId: productCategories.categoryId,
    })
    .from(productCategories)
    .where(eq(productCategories.productId, currentProduct.id));

  if (productCats.length === 0) {
    return [];
  }

  const categoryIds = productCats.map((pc) => pc.categoryId);

  // Aynı kategorilerdeki diğer ürünleri çek (mevcut ürünü hariç tut)
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      regularPrice: products.regularPrice,
      salePrice: products.salePrice,
      currency: products.currency,
      images: products.images,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .innerJoin(productCategories, eq(products.id, productCategories.productId))
    .where(
      and(
        eq(products.status, "publish"),
        ne(products.id, currentProduct.id),
        inArray(productCategories.categoryId, categoryIds)
      )
    )
    .orderBy(desc(products.updatedAt))
    .limit(limit);

  // Duplicate'leri kaldır (aynı ürün birden fazla kategoriye bağlı olabilir)
  const seen = new Set<number>();
  const unique = result.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return unique;
}

export async function getLatestProductsCursor(opts: { limit: number; cursor?: number | null; userId?: string | null }) {
  const { limit, cursor, userId } = opts;
  
  // Where koşullarını oluştur
  const whereConditions = [eq(products.status, "publish")];
  if (cursor !== null && cursor !== undefined) {
    whereConditions.push(lt(products.wcId, cursor));
  }

  // Query builder - leftJoin'i zincirin başına taşı
  const result = await db
    .select({
      id: products.id,
      wcId: products.wcId,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
      stockStatus: products.stockStatus,
      favoriteUserId: userFavorites.userId,
    })
    .from(products)
    .leftJoin(
      userFavorites,
      and(
        eq(userFavorites.productId, products.id),
        eq(userFavorites.userId, userId ?? '')
      )
    )
    .where(and(...whereConditions))
    .orderBy(desc(products.wcId))
    .limit(limit);

  // isFavorite boolean'a çevir
  return result.map((row) => {
    const { favoriteUserId, ...rest } = row;
    return {
      ...rest,
      isFavorite: userId ? favoriteUserId !== null : false,
    };
  });
}

export type SortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

/**
 * Resolves category scope IDs for product listing.
 * 
 * Logic:
 * - If subCategoryIds exists -> scope = subCategoryIds (only those children)
 * - Else if category is top-level (parentWcId is null or 0):
 *   - scope = [parent.id, ...allChildIds] (rollup)
 * - Else (non-top-level leaf) -> scope = [category.id] (only that category)
 * 
 * @param slug Category slug
 * @param subCategoryIds Optional array of child category IDs (internal IDs)
 * @returns Array of category IDs to use in product query scope
 */
export async function resolveCategoryScopeIds(
  slug: string,
  subCategoryIds: number[] | null | undefined
): Promise<number[] | null> {
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return null;
  }

  // If subCategoryIds provided, use only those (child filter is active)
  // Treat subCategoryIds=[] as "no sub selected" - use subCategoryIds?.length check
  if (subCategoryIds?.length) {
    return subCategoryIds;
  }

  // Check if category is top-level (parentWcId is null or 0)
  const isTopLevel = category.parentWcId === null || category.parentWcId === 0;

  if (isTopLevel) {
    // Top-level: include parent + all direct children (depth=1)
    // Fetch children with: WHERE parent_wc_id = parent.wc_id
    const childCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentWcId, category.wcId));

    // Return scopeIds: [parent.id, ...children.map(c => c.id)]
    return [category.id, ...childCategories.map((c) => c.id)];
  } else {
    // Non-top-level leaf: only this category
    return [category.id];
  }
}

export interface GetProductsCursorOptions {
  limit: number;
  cursor?: number | null;
  categorySlug?: string | null;
  sort?: SortOption;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean | null;
  subCategoryIds?: number[] | null;
  userId?: string | null;
}

export async function getProductsCursor(opts: GetProductsCursorOptions) {
  const {
    limit,
    cursor,
    categorySlug,
    sort = "newest",
    minPrice,
    maxPrice,
    inStock,
    subCategoryIds,
    userId,
  } = opts;

  // Where koşullarını oluştur
  const whereConditions: SQL[] = [eq(products.status, "publish")];

  // Cursor koşulu
  if (cursor !== null && cursor !== undefined) {
    whereConditions.push(lt(products.wcId, cursor));
  }

  // Kategori filtresi - helper fonksiyon kullanarak scope'u belirle
  let categoryIds: number[] | null = null;
  if (categorySlug) {
    categoryIds = await resolveCategoryScopeIds(categorySlug, subCategoryIds);
  } else if (subCategoryIds && subCategoryIds.length > 0) {
    categoryIds = subCategoryIds;
  }

  // Fiyat aralığı filtresi
  if (minPrice !== null && minPrice !== undefined) {
    whereConditions.push(gte(products.price, minPrice));
  }
  if (maxPrice !== null && maxPrice !== undefined) {
    whereConditions.push(lte(products.price, maxPrice));
  }

  // Stok durumu filtresi
  if (inStock === true) {
    whereConditions.push(eq(products.stockStatus, "instock"));
  }

  // STEP 1: Get distinct product IDs first (to avoid JOIN duplicates affecting LIMIT)
  // This ensures LIMIT applies to unique products, not JOIN rows
  // Use GROUP BY to get distinct product IDs with their wcId for ordering
  let idQuery = db
    .select({
      id: products.id,
      wcId: products.wcId,
      price: products.price,
      name: products.name,
    })
    .from(products)
    .$dynamic();

  // Kategori join'i gerekliyse ekle (for filtering)
  if (categoryIds && categoryIds.length > 0) {
    idQuery = idQuery
      .innerJoin(productCategories, eq(products.id, productCategories.productId))
      .innerJoin(categories, eq(productCategories.categoryId, categories.id));
    
    whereConditions.push(inArray(categories.id, categoryIds));
  }

  // Where koşullarını uygula
  idQuery = idQuery.where(and(...whereConditions));

  // GROUP BY to ensure distinct products (needed when JOIN creates duplicates)
  if (categoryIds && categoryIds.length > 0) {
    // When we have category joins, we need GROUP BY to get distinct products
    idQuery = idQuery.groupBy(products.id, products.wcId, products.price, products.name);
  }

  // Sıralama (for cursor pagination and ordering)
  switch (sort) {
    case "newest":
      idQuery = idQuery.orderBy(desc(products.wcId));
      break;
    case "price_asc":
      idQuery = idQuery.orderBy(asc(products.price));
      break;
    case "price_desc":
      idQuery = idQuery.orderBy(desc(products.price));
      break;
    case "name_asc":
      idQuery = idQuery.orderBy(asc(products.name));
      break;
  }

  // Limit unique products
  idQuery = idQuery.limit(limit);

  const productIdsResult = await idQuery;
  // Deduplicate by ID (in case GROUP BY doesn't fully work)
  const seenIds = new Set<number>();
  const productIds = productIdsResult
    .filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    })
    .map((p) => p.id);

  // STEP 2: Fetch full product details with userFavorites join
  if (productIds.length === 0) {
    return [];
  }

  const result = await db
    .select({
      id: products.id,
      wcId: products.wcId,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
      stockStatus: products.stockStatus,
      favoriteUserId: userFavorites.userId,
    })
    .from(products)
    .leftJoin(
      userFavorites,
      and(
        eq(userFavorites.productId, products.id),
        eq(userFavorites.userId, userId ?? '')
      )
    )
    .where(inArray(products.id, productIds))
    .orderBy(
      // Preserve sort order from step 1
      sort === "newest" ? desc(products.wcId) :
      sort === "price_asc" ? asc(products.price) :
      sort === "price_desc" ? desc(products.price) :
      asc(products.name)
    );

  // isFavorite boolean'a çevir
  return result.map((row) => {
    const { favoriteUserId, ...rest } = row;
    return {
      ...rest,
      isFavorite: userId ? favoriteUserId !== null : false,
    };
  });
}

/**
 * Get next cursor for pagination.
 * For cursor-based pagination, if returned products < limit, there are no more products.
 * However, we also verify with a count query to ensure hasMore matches.
 */
export function getNextCursor(products: { wcId: number }[], limit: number): number | null {
  // If returned products < limit, there are no more products
  if (products.length < limit) {
    return null;
  }
  // Return the wcId of the last product as cursor for next page
  return products[products.length - 1].wcId;
}

/**
 * Count products matching the same scope as getProductsCursor.
 * Uses COUNT(DISTINCT p.id) and same scopeIds as list query.
 */
export async function countProductsInScope(opts: {
  categorySlug?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean | null;
  subCategoryIds?: number[] | null;
}): Promise<number> {
  const { categorySlug, minPrice, maxPrice, inStock, subCategoryIds } = opts;

  // Where koşullarını oluştur (same as getProductsCursor)
  const whereConditions: SQL[] = [eq(products.status, "publish")];

  // Kategori filtresi - helper fonksiyon kullanarak scope'u belirle (same as getProductsCursor)
  let categoryIds: number[] | null = null;
  if (categorySlug) {
    categoryIds = await resolveCategoryScopeIds(categorySlug, subCategoryIds);
  } else if (subCategoryIds && subCategoryIds.length > 0) {
    categoryIds = subCategoryIds;
  }

  // Fiyat aralığı filtresi (same as getProductsCursor)
  if (minPrice !== null && minPrice !== undefined) {
    whereConditions.push(gte(products.price, minPrice));
  }
  if (maxPrice !== null && maxPrice !== undefined) {
    whereConditions.push(lte(products.price, maxPrice));
  }

  // Stok durumu filtresi (same as getProductsCursor)
  if (inStock === true) {
    whereConditions.push(eq(products.stockStatus, "instock"));
  }

  // Build count query - use same scopeIds as list query
  let query = db
    .select({
      count: sql<number>`COUNT(DISTINCT ${products.id})`.as('count'),
    })
    .from(products)
    .$dynamic();

  // Kategori join'i gerekliyse ekle (same as getProductsCursor)
  if (categoryIds && categoryIds.length > 0) {
    query = query
      .innerJoin(productCategories, eq(products.id, productCategories.productId))
      .innerJoin(categories, eq(productCategories.categoryId, categories.id));
    
    whereConditions.push(inArray(categories.id, categoryIds));
  }

  // Where koşullarını uygula
  query = query.where(and(...whereConditions));

  const result = await query;
  return result[0]?.count ?? 0;
}
