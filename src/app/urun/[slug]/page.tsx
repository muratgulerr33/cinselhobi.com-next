import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getProductBySlug } from "@/db/queries/catalog";
import { ProductView, ProductType } from "@/components/product/product-view";
import { RelatedProducts } from "@/components/product/detail/related-products";
import { db } from "@/db/connection";
import { productCategories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const revalidate = 600;

// --- YARDIMCI 1: Fiyat Dönüştürücü ---
function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

// --- YARDIMCI 2: Görsel Temizleyici ---
function normalizeImages(images: unknown): Array<{ src: string; alt?: string }> {
  if (!images || !Array.isArray(images)) return [];
  
  return images
    .map((img: unknown) => {
      if (typeof img === "string") return { src: img.trim() };
      if (img && typeof img === "object" && img !== null && "src" in img) {
        const imgObj = img as { src: unknown; alt?: unknown };
        return {
          src: String(imgObj.src).trim(),
          alt: imgObj.alt ? String(imgObj.alt).trim() : undefined,
        };
      }
      return null;
    })
    .filter((item): item is { src: string; alt?: string } => 
      item !== null && item.src.length > 0
    );
}

// --- YARDIMCI 3: HTML TEMİZLEYİCİ (YENİ) ---
// Açıklamayı Google için temiz metne çevirir. <br> leri siler, düz yazı yapar.
function stripHtml(html: string | null): string {
  if (!html) return "";
  // 1. HTML taglerini sil
  const stripped = html.replace(/<[^>]+>/g, " ");
  // 2. Fazla boşlukları tek boşluğa indir
  return stripped.replace(/\s+/g, " ").trim();
}

// --- SEO (Metadata) ---
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Ürün Bulunamadı" };
  }

  // HTML'i temizle ve temiz metin al
  const rawDesc = product.shortDescription || product.description || "";
  const cleanDesc = stripHtml(rawDesc);

  return {
    title: product.name,
    // Temiz metni 160 karakterde kes ve sonuna ... koy
    description: cleanDesc.length > 160 ? cleanDesc.slice(0, 157) + "..." : cleanDesc,
    openGraph: {
      images: ["/og.png"],
      title: product.name,
      description: cleanDesc.length > 160 ? cleanDesc.slice(0, 157) + "..." : cleanDesc,
    },
    twitter: {
      card: "summary_large_image",
      images: ["/og.png"],
    },
  };
}

// --- ANA SAYFA (Server Component) ---
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const rawProduct = await getProductBySlug(slug);

  if (!rawProduct) {
    notFound();
  }

  // Type Casting (Nükleer Yöntem)
  const productData = {
    id: Number(rawProduct.id),
    wcId: Number(rawProduct.wcId || 0),
    slug: String(rawProduct.slug),
    name: String(rawProduct.name),
    description: rawProduct.description || null,
    shortDescription: rawProduct.shortDescription || null,
    
    price: toNum(rawProduct.price),
    regularPrice: toNum(rawProduct.regularPrice),
    salePrice: toNum(rawProduct.salePrice),
    
    currency: String(rawProduct.currency || "TRY"),
    images: normalizeImages(rawProduct.images),
    
    stockStatus: rawProduct.stockStatus ? String(rawProduct.stockStatus) : null
  } as unknown as ProductType;

  // Kategori ID'lerini al (ilk kategori ID'sini kullan)
  const productCats = await db
    .select({
      categoryId: productCategories.categoryId,
    })
    .from(productCategories)
    .where(eq(productCategories.productId, Number(rawProduct.id)))
    .limit(1);
  
  const categoryId = productCats.length > 0 ? productCats[0].categoryId : null;

  return (
    <>
      <ProductView product={productData} />
      <div className="w-full py-8 lg:py-6">
        <RelatedProducts 
          productId={Number(rawProduct.id)} 
          categoryId={categoryId}
          slug={slug}
        />
      </div>
    </>
  );
}
