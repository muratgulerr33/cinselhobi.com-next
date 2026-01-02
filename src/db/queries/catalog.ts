import { db } from "@/db/connection";
import { categories, products, productCategories, userFavorites } from "@/db/schema";
import { eq, and, desc, isNull, or, ne, inArray, lt, asc, gte, lte, between, SQL } from "drizzle-orm";

export async function getTopCategories(limit = 8) {
  const result = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      parentWcId: categories.parentWcId,
    })
    .from(categories)
    .where(or(isNull(categories.parentWcId), eq(categories.parentWcId, 0)))
    .orderBy(categories.name)
    .limit(limit);

  return result;
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
  const result = await db
    .select({
      id: categories.id,
      wcId: categories.wcId,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .where(eq(categories.parentWcId, parentWcId))
    .orderBy(categories.name);

  return result;
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

  // Kategori filtresi
  let categoryIds: number[] | null = null;
  if (categorySlug) {
    const category = await getCategoryBySlug(categorySlug);
    if (category) {
      categoryIds = [category.id];
      
      // Alt kategori filtreleme
      if (subCategoryIds && subCategoryIds.length > 0) {
        categoryIds = subCategoryIds;
      } else {
        // Eğer subCategoryIds yoksa, parent'ın child'larını da dahil et
        const childCategories = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.parentWcId, category.wcId));
        
        if (childCategories.length > 0) {
          categoryIds = [category.id, ...childCategories.map((c) => c.id)];
        }
      }
    }
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

  // Query builder - leftJoin'i zincirin başına taşı
  let query = db
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
    .$dynamic(); // Dinamik sorgu için - sonradan where/join eklenebilir

  // Kategori join'i gerekliyse ekle
  if (categoryIds && categoryIds.length > 0) {
    query = query
      .innerJoin(productCategories, eq(products.id, productCategories.productId))
      .innerJoin(categories, eq(productCategories.categoryId, categories.id));
    
    whereConditions.push(inArray(categories.id, categoryIds));
  }

  // Where koşullarını uygula
  query = query.where(and(...whereConditions));

  // Sıralama
  switch (sort) {
    case "newest":
      query = query.orderBy(desc(products.wcId));
      break;
    case "price_asc":
      query = query.orderBy(asc(products.price));
      break;
    case "price_desc":
      query = query.orderBy(desc(products.price));
      break;
    case "name_asc":
      query = query.orderBy(asc(products.name));
      break;
  }

  // Limit
  query = query.limit(limit);

  const result = await query;

  // Duplicate'leri kaldır (aynı ürün birden fazla kategoriye bağlı olabilir)
  const seen = new Set<number>();
  const unique = result.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // isFavorite boolean'a çevir
  return unique.map((row) => {
    const { favoriteUserId, ...rest } = row;
    return {
      ...rest,
      isFavorite: userId ? favoriteUserId !== null : false,
    };
  });
}

export function getNextCursor(products: { wcId: number }[], limit: number): number | null {
  if (products.length < limit) {
    return null;
  }
  return products[products.length - 1].wcId;
}
