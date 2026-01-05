import { db } from "@/db/connection";
import { userFavorites, products } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function listFavoritesByUserId(userId: string) {
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
    .from(userFavorites)
    .innerJoin(products, eq(userFavorites.productId, products.id))
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt));

  return result;
}

export async function isFavorite(userId: string, productId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(userFavorites)
    .where(and(eq(userFavorites.userId, userId), eq(userFavorites.productId, productId)))
    .limit(1);

  return result.length > 0;
}

export async function toggleFavorite(userId: string, productId: number): Promise<boolean> {
  // Önce mevcut durumu kontrol et
  const existing = await db
    .select()
    .from(userFavorites)
    .where(and(eq(userFavorites.userId, userId), eq(userFavorites.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    // Varsa sil - işlem sonrası artık favori DEĞİL -> return false
    await db
      .delete(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.productId, productId)));
    return false;
  } else {
    // Yoksa ekle - işlem sonrası artık favori -> return true
    await db.insert(userFavorites).values({
      userId,
      productId,
    });
    return true;
  }
}

export async function countFavorites(userId: string): Promise<number> {
  const result = await db
    .select()
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId));

  return result.length;
}

export async function listFavoriteProductIdsByUserId(userId: string): Promise<number[]> {
  const result = await db
    .select({
      productId: userFavorites.productId,
    })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId));

  return result.map((row) => row.productId);
}

