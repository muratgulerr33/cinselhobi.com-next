import { getTopCategories, getLatestProductsCursor, getNextCursor } from "@/db/queries/catalog";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { LoadMoreGrid } from "@/components/catalog/load-more-grid";
import { PRODUCTS_PER_PAGE } from "@/config/catalog";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  
  const categories = await getTopCategories(8);
  
  // İlk sayfa ürünlerini cursor-based olarak çek
  const initialProducts = await getLatestProductsCursor({ limit: PRODUCTS_PER_PAGE, userId });
  const initialCursor = getNextCursor(initialProducts, PRODUCTS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-3xl font-bold">Hoş Geldiniz</h1>
        <p className="mt-2 text-muted-foreground">
          Cinselhobi&apos;ye hoş geldiniz. Hobi ve el sanatları dünyasına adım atın.
        </p>
      </div>

      {/* Categories Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Kategoriler</h2>
        <CategoryGrid categories={categories} />
      </section>

      {/* Latest Products Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Yeni Ürünler</h2>
        <LoadMoreGrid 
          initialProducts={initialProducts} 
          initialCursor={initialCursor} 
          limit={PRODUCTS_PER_PAGE} 
        />
      </section>
    </div>
  );
}
