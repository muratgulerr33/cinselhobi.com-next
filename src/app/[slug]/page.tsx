import { notFound } from "next/navigation";
import {
  getCategoryBySlug,
  getProductsCursor,
  getNextCursor,
  getChildCategoriesByParentWcId,
  type SortOption,
} from "@/db/queries/catalog";
import { LoadMoreGrid } from "@/components/catalog/load-more-grid";
import { CategoryHeaderSetter } from "@/components/catalog/category-header-setter";
import { ActiveFiltersBar } from "@/components/catalog/active-filters-bar";
import { IntentFilterChips } from "@/components/catalog/intent-filter-chips";
import type { IntentClass } from "@/lib/intent-heuristics";
import { PRODUCTS_PER_PAGE } from "@/config/catalog";
import { db } from "@/db/connection";
import { categories } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { institutionalContent } from "@/data/institutional-content";
import type { Metadata } from "next";
import { normalizeCategoryName } from "@/lib/format/normalize-category-name";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const RESERVED_SLUGS = [
  "account",
  "urun",
  "cart",
  "styleguide",
  "support",
  "about",
  "product",
  "product-category",
  "api",
  "_next",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const institutionalContentItem = institutionalContent[slug as keyof typeof institutionalContent];
  
  if (institutionalContentItem) {
    return {
      title: institutionalContentItem.title,
    };
  }

  const category = await getCategoryBySlug(slug);
  if (category) {
    return {
      title: category.name,
    };
  }

  return {
    title: "Sayfa Bulunamadı",
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const params_obj = await searchParams;

  // Check if slug is reserved
  if (RESERVED_SLUGS.includes(slug)) {
    notFound();
  }

  // Önce institutional content kontrolü yap
  const institutionalContentItem = institutionalContent[slug as keyof typeof institutionalContent];
  if (institutionalContentItem) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{institutionalContentItem.title}</h1>
        <div
          className="prose prose-zinc dark:prose-invert max-w-4xl"
          dangerouslySetInnerHTML={{ __html: institutionalContentItem.content }}
        />
      </div>
    );
  }

  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  // Search params'ı parse et
  const sortParam = params_obj.sort;
  const minPriceParam = params_obj.min;
  const maxPriceParam = params_obj.max;
  const inStockParam = params_obj.inStock;
  const subParam = params_obj.sub;
  const intentParam = params_obj.intent;
  // Eski subCategoryIds parametresini de destekle (geriye dönük uyumluluk)
  const subCategoryIdsParam = params_obj.subCategoryIds;

  const validSorts: SortOption[] = ["newest", "price_asc", "price_desc", "name_asc"];
  const sort: SortOption = (sortParam && typeof sortParam === "string" && validSorts.includes(sortParam as SortOption))
    ? (sortParam as SortOption)
    : "newest";

  // TL -> kuruş dönüşümü
  let minPriceKurus: number | null = null;
  if (minPriceParam && typeof minPriceParam === "string") {
    const minTl = Number(minPriceParam);
    if (Number.isFinite(minTl) && minTl >= 0) {
      minPriceKurus = Math.round(minTl * 100);
    }
  }

  let maxPriceKurus: number | null = null;
  if (maxPriceParam && typeof maxPriceParam === "string") {
    const maxTl = Number(maxPriceParam);
    if (Number.isFinite(maxTl) && maxTl >= 0) {
      maxPriceKurus = Math.round(maxTl * 100);
    }
  }

  let inStock: boolean | null = null;
  if (inStockParam === "1" || inStockParam === "true") {
    inStock = true;
  }

  // Intent filtreleme (sadece et-dokulu-urunler için)
  let intent: IntentClass | "all" = "all";
  if (slug === "et-dokulu-urunler" && intentParam) {
    const intentStr = typeof intentParam === "string" ? intentParam : intentParam[0];
    if (intentStr === "kadin" || intentStr === "erkek") {
      intent = intentStr as IntentClass;
    }
  }

  // sub parametresini parse et (wcId'ler virgülle ayrılmış)
  let subCategoryIds: number[] | null = null;
  if (subParam) {
    const wcIdsStr = typeof subParam === "string" ? subParam : subParam[0];
    if (wcIdsStr) {
      const wcIds = wcIdsStr.split(",").map((id) => {
        const parsed = Number(id.trim());
        return !Number.isNaN(parsed) ? parsed : null;
      }).filter((id): id is number => id !== null);
      
      if (wcIds.length > 0) {
        // wcId'lerden internal id'lere çevir
        const categoryRecords = await db
          .select({ id: categories.id })
          .from(categories)
          .where(inArray(categories.wcId, wcIds));
        
        subCategoryIds = categoryRecords.map((c) => c.id);
      }
    }
  } else if (subCategoryIdsParam) {
    // Eski subCategoryIds parametresini destekle (geriye dönük uyumluluk)
    const idsStr = typeof subCategoryIdsParam === "string" ? subCategoryIdsParam : subCategoryIdsParam[0];
    if (idsStr) {
      const ids = idsStr.split(",").map((id) => {
        const parsed = Number(id.trim());
        return !Number.isNaN(parsed) ? parsed : null;
      }).filter((id): id is number => id !== null);
      
      if (ids.length > 0) {
        subCategoryIds = ids;
      }
    }
  }

  // İlk ürünleri çek
  // Alt kategorileri çek
  const childCategories = await getChildCategoriesByParentWcId(category.wcId);

  const initialProducts = await getProductsCursor({
    limit: PRODUCTS_PER_PAGE,
    categorySlug: slug,
    sort,
    minPrice: minPriceKurus,
    maxPrice: maxPriceKurus,
    inStock,
    subCategoryIds,
  });

  const initialCursor = getNextCursor(initialProducts, PRODUCTS_PER_PAGE);

  return (
    <>
      <CategoryHeaderSetter
        categorySlug={slug}
        childCategories={childCategories}
      />
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
          <h1 className="text-3xl font-bold">{normalizeCategoryName(category.name)}</h1>
          {category.description && (
            <p className="mt-2 text-muted-foreground">{category.description}</p>
          )}
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Ürünler</h2>
          <IntentFilterChips categorySlug={slug} products={initialProducts} />
          <ActiveFiltersBar />
          <LoadMoreGrid
            key={`${slug}|${sort}|${minPriceParam ?? ""}|${maxPriceParam ?? ""}|${inStockParam ?? ""}|${subParam ?? ""}|${intent}`}
            initialProducts={initialProducts}
            initialCursor={initialCursor}
            limit={PRODUCTS_PER_PAGE}
            categorySlug={slug}
            sort={sort}
            minPrice={minPriceParam ? Number(minPriceParam) : null}
            maxPrice={maxPriceParam ? Number(maxPriceParam) : null}
            inStock={inStock}
            sub={subParam ? (typeof subParam === "string" ? subParam : subParam[0]) : undefined}
            intent={intent}
          />
        </section>
      </div>
    </>
  );
}

