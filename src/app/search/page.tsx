import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/db/connection";
import { products, categories, productCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchCatalog } from "@/lib/search/search-utils";
import { toSearchProduct, toSearchCategory } from "@/lib/search/catalog-adapters";
import { SearchResultItem } from "@/components/search/search-result-item";
import { formatPrice, getPrimaryImageUrl } from "@/lib/format";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function SearchResults({ query }: { query: string }) {
  // Get all published products
  const allProducts = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
    })
    .from(products)
    .where(eq(products.status, "publish"));

  // Get all categories
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
    })
    .from(categories);

  // Get all product-category relationships in one query
  const allProductCategories = await db
    .select({
      productId: productCategories.productId,
      categorySlug: categories.slug,
    })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id));

  // Build map: productId -> categorySlugs[]
  const productCategoryMap = new Map<number, string[]>();
  for (const pc of allProductCategories) {
    const existing = productCategoryMap.get(pc.productId) || [];
    existing.push(pc.categorySlug);
    productCategoryMap.set(pc.productId, existing);
  }

  // Attach category slugs to products
  const productsWithCategories = allProducts.map((product) => {
    const categorySlugs = productCategoryMap.get(product.id) || [];
    return toSearchProduct(product, categorySlugs);
  });

  const searchCategories = allCategories.map(toSearchCategory);

  // Perform search
  const searchResult = searchCatalog({
    query,
    products: productsWithCategories,
    categories: searchCategories,
  });

  // Defensive guards: ensure arrays are never undefined
  const resultProducts = searchResult?.products ?? [];
  const resultCategories = searchResult?.categories ?? [];
  const fallbackItems = searchResult?.fallbackItems ?? [];

  const hasResults = resultProducts.length > 0 || resultCategories.length > 0 || fallbackItems.length > 0;

  if (!hasResults) {
    return (
      <div className="py-8 text-center space-y-4">
        <p className="text-muted-foreground">Sonuç bulunamadı</p>
        <p className="text-sm text-muted-foreground">
          Yazımı kontrol edin veya{" "}
          <Link href="/categories" className="text-primary hover:underline">
            kategorilere göz atın
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Kategoriler */}
      {resultCategories.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Kategoriler</h2>
          <div className="space-y-2">
            {resultCategories.map((category) => (
              <SearchResultItem
                key={category.id}
                title={category.name}
                href={`/${category.slug}`}
                imageUrl={category.imageUrl}
              />
            ))}
          </div>
        </div>
      )}

      {/* Ürünler veya Fallback Ürünler */}
      {(resultProducts.length > 0 || fallbackItems.length > 0) && (
        <div>
          {searchResult.fallbackCategory && resultProducts.length === 0 ? (
            <h2 className="mb-4 text-lg font-semibold">
              {searchResult.fallbackCategory.name} kategorisindeki ürünler
            </h2>
          ) : (
            <h2 className="mb-4 text-lg font-semibold">
              Ürünler ({resultProducts.length > 0 ? resultProducts.length : fallbackItems.length})
            </h2>
          )}
          <div className="space-y-2">
            {(resultProducts.length > 0 ? resultProducts : fallbackItems).map((item) => {
              const imageUrl = getPrimaryImageUrl(item.images);
              return (
                <SearchResultItem
                  key={item.id}
                  title={item.name}
                  subtitle={item.price !== null ? formatPrice(item.price) : undefined}
                  href={`/urun/${item.slug}`}
                  imageUrl={imageUrl}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = params.q?.trim();

  return (
    <div className="py-8">
      <h1 className="mb-4 text-2xl font-semibold">Arama</h1>
      {!q ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">Arama yapmak için bir sorgu girin</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Aranıyor...</p>
            </div>
          }
        >
          <SearchResults query={q} />
        </Suspense>
      )}
    </div>
  );
}
