import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connection";
import { products, categories, productCategories } from "@/db/schema";
import { eq, and, or, ilike, inArray, isNull, ne } from "drizzle-orm";
import { searchCatalog, tokenize } from "@/lib/search/search-utils";
import { toSearchProduct, toSearchCategory } from "@/lib/search/catalog-adapters";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");
  const limitParam = searchParams.get("limit");

  if (!q || !q.trim()) {
    return NextResponse.json({ 
      items: [],
      categories: [],
      fallbackCategory: null,
      fallbackItems: [],
    });
  }

  const limit = Math.min(parseInt(limitParam || "8", 10), 20);
  const query = q.trim();

  try {
    // Tokenize query for SQL filtering
    const queryTokens = tokenize(query);
    
    // If no valid tokens, return empty (same as before)
    if (queryTokens.length === 0) {
      return NextResponse.json({ 
        items: [],
        categories: [],
        fallbackCategory: null,
        fallbackItems: [],
      });
    }

    // Build SQL WHERE clause for products: each token must match in name OR slug
    // Using ilike for case-insensitive pattern matching
    const productConditions = queryTokens.map((token) => {
      const pattern = `%${token}%`;
      return or(
        ilike(products.name, pattern),
        ilike(products.slug, pattern)
      );
    });
    
    // All tokens must match (AND logic); exclude outofstock from search results
    const notOutOfStock = or(
      isNull(products.stockStatus),
      ne(products.stockStatus, "outofstock")
    );
    const productWhere = and(
      eq(products.status, "publish"),
      notOutOfStock,
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

    // Format response (same shape as before)
    const items = searchResult.products
      .slice(0, limit)
      .map(({ score, ...product }) => product);

    const categoryResults = searchResult.categories.map(({ score, ...category }) => category);

    // Format fallback items - always an array (guaranteed by searchCatalog)
    const fallbackItems = searchResult.fallbackItems
      .slice(0, limit)
      .map(({ score, ...product }) => product);

    return NextResponse.json({
      items,
      categories: categoryResults,
      fallbackCategory: searchResult.fallbackCategory || null,
      fallbackItems,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ 
      items: [],
      categories: [],
      fallbackCategory: null,
      fallbackItems: [],
    }, { status: 500 });
  }
}

