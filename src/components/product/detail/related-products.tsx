import { getRelatedProductsBySlug } from "@/db/queries/catalog";
import { RelatedProductsCarousel } from "./related-products-carousel";
import type { RelatedProduct } from "./types";

interface RelatedProductsProps {
  productId: number;
  categoryId?: number | null;
  slug: string;
}

function normalizeImages(images: unknown): Array<{ src: string; alt?: string }> {
  if (Array.isArray(images)) {
    return images
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((img: any) => {
        if (typeof img === "string") return { src: img.trim() };
        if (img && typeof img === "object" && "src" in img) {
          return {
            src: String(img.src).trim(),
            alt: img.alt ? String(img.alt).trim() : undefined,
          };
        }
        return null;
      })
      .filter(
        (item): item is { src: string; alt?: string } =>
          item !== null && item.src.length > 0
      );
  }
  return [];
}

export async function RelatedProducts({ productId, categoryId, slug }: RelatedProductsProps) {
  // Slug kullanarak ilgili ürünleri çek (getRelatedProductsBySlug zaten kategori kontrolü yapıyor)
  const relatedProducts = await getRelatedProductsBySlug(slug, 10);

  // Debug: Eğer ürün yoksa debug mesajı göster
  if (relatedProducts.length === 0) {
    return (
      <div className="p-4 border border-red-500">
        Slider Yüklendi ama Ürün Yok (Debug Modu)
      </div>
    );
  }

  // Veriyi normalize et
  const normalized: RelatedProduct[] = relatedProducts.map((product) => {
    const images = normalizeImages(product.images);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      currency: product.currency || "TRY",
      images: images,
      stockStatus: product.stockStatus || null,
    };
  });

  return <RelatedProductsCarousel products={normalized} />;
}

