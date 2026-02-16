import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getProductBySlug } from "@/db/queries/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ImageItem {
  id?: number;
  src: string;
  alt?: string | null;
}

function normalizeImages(images: unknown): Array<{ src: string; alt?: string }> {
  if (!images) return [];
  
  if (Array.isArray(images)) {
    return images
      .map((img: unknown) => {
        if (typeof img === "string") {
          return { src: img.trim() };
        }
        if (typeof img === "object" && img !== null) {
          const obj = img as ImageItem;
          if (typeof obj.src === "string") {
            return {
              src: (obj.src ?? "").trim(),
              alt: (obj.alt ?? "").trim() || undefined,
            };
          }
        }
        return null;
      })
      .filter((item): item is { src: string; alt?: string } => item !== null)
      .filter((img) => img.src.length > 0);
  }
  
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  noStore();
  const { slug } = await params;
  console.log("[api/products/[slug]] HIT", slug);

  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  const product = await getProductBySlug(slug);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Görsel kaynağı SADECE product.images. raw fallback / cover.webp / g1.webp yok.
  const dbImages = product.images;
  const useDbImages =
    Array.isArray(dbImages) && dbImages.length >= 1;
  const images = useDbImages
    ? normalizeImages(dbImages)
    : [];

  // LOCAL debug only (prod'a taşınmayacak)
  if (process.env.NODE_ENV === "development") {
    console.log(
      "[api/products/[slug]] DB images type =",
      typeof product.images,
      Array.isArray(product.images)
    );
    console.log(
      "[api/products/[slug]] DB first src =",
      (Array.isArray(product.images) ? (product.images as Array<{ src?: string }>)?.[0]?.src : null) ??
        "(none)"
    );
    console.log(
      "[api/products/[slug]] RESP first src =",
      images[0]?.src ?? "(none)"
    );
  }

  const response = NextResponse.json({
    id: product.id,
    wcId: product.wcId,
    slug: product.slug,
    name: product.name,
    description: product.description || null,
    shortDescription: product.shortDescription || null,
    price: product.price,
    regularPrice: product.regularPrice,
    salePrice: product.salePrice,
    currency: product.currency || "TRY",
    images,
    sku: product.sku || null,
    stockStatus: product.stockStatus || null,
    stockQuantity: product.stockQuantity || null,
  });
  response.headers.set("x-api-source", "local-route");
  return response;
}

