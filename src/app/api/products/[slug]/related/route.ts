import { NextRequest, NextResponse } from "next/server";
import { getRelatedProductsBySlug } from "@/db/queries/catalog";

export const dynamic = "force-dynamic";

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
  const { slug } = await params;
  
  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  const relatedProducts = await getRelatedProductsBySlug(slug, 10);

  const normalized = relatedProducts.map((product) => {
    const images = normalizeImages(product.images);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      currency: product.currency || "TRY",
      images: images.length > 0 ? [images[0]] : [], // Sadece ilk görsel
      stockStatus: product.stockStatus || null,
    };
  });

  return NextResponse.json(normalized);
}

