/**
 * Adapters to convert database types to search types
 */

import { getPrimaryImageUrl } from "@/lib/format";
import { getCategoriesForProduct } from "@/db/queries/catalog";
import type { SearchProduct, SearchCategory } from "./search-utils";

/**
 * Get product thumbnail image URL
 */
export function getProductThumb(product: { images: unknown }): string | null {
  return getPrimaryImageUrl(product.images);
}

/**
 * Get category slugs for a product
 * This is async because it needs to query the database
 */
export async function getProductCategorySlugs(
  productId: number
): Promise<string[]> {
  const categories = await getCategoriesForProduct(productId);
  return categories.map((cat) => cat.slug);
}

/**
 * Convert database product to search product
 * Note: categorySlugs will need to be populated separately if needed
 */
export function toSearchProduct(
  product: {
    id: number;
    name: string;
    slug: string;
    price: number | null;
    images: unknown;
  },
  categorySlugs?: string[]
): SearchProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    images: product.images,
    categorySlugs: categorySlugs || [],
  };
}

/**
 * Convert database category to search category
 */
export function toSearchCategory(category: {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
}): SearchCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    imageUrl: category.imageUrl,
  };
}

