import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getProductBySlug, getPrimaryCategoryForBreadcrumb } from "@/db/queries/catalog";
import { ProductView, ProductType } from "@/components/product/product-view";
import { RelatedProducts } from "@/components/product/detail/related-products";
import { db } from "@/db/connection";
import { productCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCanonicalBaseUrl } from "@/lib/seo/canonical";

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
      images: ["/og/cinselhobi-share-2026-02-13.jpg"],
      title: product.name,
      description: cleanDesc.length > 160 ? cleanDesc.slice(0, 157) + "..." : cleanDesc,
    },
    twitter: {
      card: "summary_large_image",
      images: ["/og/cinselhobi-share-2026-02-13.jpg"],
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

  const baseUrl = getCanonicalBaseUrl();
  const productUrl = `${baseUrl}/urun/${slug}`;
  const productImages = normalizeImages(rawProduct.images);
  const firstImage = productImages[0]?.src;
  const imageUrl = firstImage?.startsWith("http") ? firstImage : firstImage ? `${baseUrl}${firstImage.startsWith("/") ? "" : "/"}${firstImage}` : undefined;

  // JSON-LD BreadcrumbList (invisible, SEO only). Category route: /[slug]
  const primaryCategory = await getPrimaryCategoryForBreadcrumb(Number(rawProduct.id));
  const breadcrumbItems: Array<{ position: number; name: string; item: string }> = [
    { position: 1, name: "Ana Sayfa", item: `${baseUrl}/` },
  ];
  let position = 2;
  if (primaryCategory) {
    breadcrumbItems.push({
      position: position++,
      name: primaryCategory.name,
      item: `${baseUrl}/${primaryCategory.slug}`,
    });
  }
  breadcrumbItems.push({
    position,
    name: String(rawProduct.name),
    item: productUrl,
  });
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      item: item.item,
    })),
  };

  // JSON-LD Product (kanıtlı alanlar: name, image, description, sku, offers). aggregateRating/brand yok.
  const availability = rawProduct.stockStatus === "instock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: String(rawProduct.name),
    description: stripHtml(rawProduct.shortDescription || rawProduct.description || "").slice(0, 500) || undefined,
    url: productUrl,
    ...(imageUrl && { image: imageUrl }),
    ...(rawProduct.sku && { sku: String(rawProduct.sku) }),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: String(rawProduct.currency || "TRY"),
      price: rawProduct.price != null ? Number(rawProduct.price) / 100 : undefined,
      availability,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
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
