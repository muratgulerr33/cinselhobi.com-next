import { getTopCategories, getLatestProductsCursor, getNextCursor } from "@/db/queries/catalog";
import { LoadMoreGrid } from "@/components/catalog/load-more-grid";
import { PRODUCTS_PER_PAGE } from "@/config/catalog";
import { auth } from "@/auth";
import { HeroSection } from "@/components/home/hero-section";
import { CategoryRail } from "@/components/home/category-rail";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  
  const categories = await getTopCategories(8);
  
  // İlk sayfa ürünlerini cursor-based olarak çek
  const initialProducts = await getLatestProductsCursor({ limit: PRODUCTS_PER_PAGE, userId });
  const initialCursor = getNextCursor(initialProducts, PRODUCTS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <HeroSection />
      
      {/* Category Rail - Floating Conversion Deck */}
      <CategoryRail categories={categories} />

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
