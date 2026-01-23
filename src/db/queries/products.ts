import { db } from "@/db/connection";
import { products, productCategories } from "@/db/schema";
import { eq, and, ne, inArray, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function getRelatedProducts(
  categoryId: number,
  currentProductId: number,
  limit = 10
) {
  // Aynı kategorideki diğer ürünleri çek (mevcut ürünü hariç tut)
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
        ne(products.id, currentProductId),
        eq(productCategories.categoryId, categoryId)
      )
    )
    .orderBy(sql`RANDOM()`)
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

