import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProductBySlug, getRelatedProductsBySlug } from "@/db/queries/catalog";
import { isFavorite } from "@/db/queries/favorites";
import { ProductDetailClient } from "@/components/product/detail/ProductDetailClient";
import type { Product, RelatedProduct, ProductImage } from "@/components/product/detail/types";

export const dynamic = "force-dynamic";

// Normalize images from DB to ProductImage[]
function normalizeImages(images: unknown): ProductImage[] {
  if (!images) return [];
  if (!Array.isArray(images)) return [];

  const result: ProductImage[] = [];
  for (const img of images) {
    if (typeof img === "string") {
      const trimmed = img.trim();
      if (trimmed) {
        result.push({ src: trimmed, alt: undefined });
      }
    } else if (typeof img === "object" && img !== null) {
      const src = "src" in img && typeof img.src === "string" ? img.src.trim() : "";
      if (src) {
        const alt = "alt" in img && typeof img.alt === "string" ? img.alt.trim() : undefined;
        result.push({ src, alt });
      }
    }
  }
  return result;
}

// Normalize product from DB to Product type
function normalizeProduct(dbProduct: Awaited<ReturnType<typeof getProductBySlug>>): Product | null {
  if (!dbProduct) return null;

  return {
    id: dbProduct.id,
    wcId: dbProduct.wcId,
    slug: dbProduct.slug,
    name: dbProduct.name,
    description: dbProduct.description,
    shortDescription: dbProduct.shortDescription,
    price: dbProduct.price,
    regularPrice: dbProduct.regularPrice,
    salePrice: dbProduct.salePrice,
    currency: dbProduct.currency || "TRY",
    images: normalizeImages(dbProduct.images),
    sku: dbProduct.sku,
    stockStatus: dbProduct.stockStatus,
    stockQuantity: dbProduct.stockQuantity,
  };
}

// Normalize related products from DB to RelatedProduct[]
function normalizeRelatedProducts(
  dbProducts: Awaited<ReturnType<typeof getRelatedProductsBySlug>>
): RelatedProduct[] {
  return dbProducts.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    regularPrice: p.regularPrice,
    salePrice: p.salePrice,
    currency: p.currency || "TRY",
    images: normalizeImages(p.images),
    stockStatus: p.stockStatus,
  }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  // Fetch product data
  const dbProduct = await getProductBySlug(slug);
  if (!dbProduct) {
    notFound();
  }

  // Fetch related products
  const dbRelated = await getRelatedProductsBySlug(slug, 10);

  // Normalize data
  const product = normalizeProduct(dbProduct);
  if (!product) {
    notFound();
  }

  const related = normalizeRelatedProducts(dbRelated);

  // Check if product is favorite (if user is logged in)
  const session = await auth();
  const initialIsFavorite = session?.user?.id
    ? await isFavorite(session.user.id, product.id)
    : false;

  return <ProductDetailClient product={product} related={related} initialIsFavorite={initialIsFavorite} />;
}

