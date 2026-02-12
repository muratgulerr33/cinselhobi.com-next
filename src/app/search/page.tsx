import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/db/connection";
import { products, categories, productCategories } from "@/db/schema";
import { eq, and, or, ilike, inArray } from "drizzle-orm";
import { searchCatalog, tokenize } from "@/lib/search/search-utils";
import { toSearchProduct, toSearchCategory } from "@/lib/search/catalog-adapters";
import { SearchResultItem } from "@/components/search/search-result-item";
import { formatPrice, getPrimaryImageUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function SearchResults({ query }: { query: string }) {
  // Tokenize query for SQL filtering
  const queryTokens = tokenize(query);
  
  // If no valid tokens, return empty results
  if (queryTokens.length === 0) {
    return (
      <div className="py-8 text-center space-y-4">
        <p className="text-muted-foreground">Sonuç bulunamadı</p>
        <p className="text-sm text-muted-foreground">
          Yazımı kontrol edin veya{" "}
          <Link href="/hub" className="text-primary hover:underline">
            kategorilere göz atın
          </Link>
        </p>
      </div>
    );
  }

  // Build SQL WHERE clause for products: each token must match in name OR slug
  const productConditions = queryTokens.map((token) => {
    const pattern = `%${token}%`;
    return or(
      ilike(products.name, pattern),
      ilike(products.slug, pattern)
    );
  });
  
  const productWhere = and(
    eq(products.status, "publish"),
    ...productConditions
  );

  // Get filtered products with LIMIT (200 is enough since searchCatalog limits to 20)
  const filteredProducts = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
    })
    .from(products)
    .where(productWhere)
    .limit(200);

  // Build SQL WHERE clause for categories: each token must match in name OR slug
  const categoryConditions = queryTokens.map((token) => {
    const pattern = `%${token}%`;
    return or(
      ilike(categories.name, pattern),
      ilike(categories.slug, pattern)
    );
  });
  
  const categoryWhere = and(...categoryConditions);

  // Get filtered categories with LIMIT (100 is enough since searchCatalog limits to 8)
  const filteredCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
    })
    .from(categories)
    .where(categoryWhere)
    .limit(100);

  // Get product-category relationships only for filtered products (reduces join size)
  const productIds = filteredProducts.map((p) => p.id);
  const productCategoryMap = new Map<number, string[]>();
  
  if (productIds.length > 0) {
    const filteredProductCategories = await db
      .select({
        productId: productCategories.productId,
        categorySlug: categories.slug,
      })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(inArray(productCategories.productId, productIds));

    // Build map: productId -> categorySlugs[]
    for (const pc of filteredProductCategories) {
      const existing = productCategoryMap.get(pc.productId) || [];
      existing.push(pc.categorySlug);
      productCategoryMap.set(pc.productId, existing);
    }
  }

  // Attach category slugs to products
  const productsWithCategories = filteredProducts.map((product) => {
    const categorySlugs = productCategoryMap.get(product.id) || [];
    return toSearchProduct(product, categorySlugs);
  });

  const searchCategories = filteredCategories.map(toSearchCategory);

  // Perform search (searchCatalog will do fine-grained scoring and filtering)
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
          <Link href="/hub" className="text-primary hover:underline">
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
