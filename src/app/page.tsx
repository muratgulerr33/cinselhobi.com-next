import { getLatestProductsCursor, getNextCursor } from "@/db/queries/catalog";
import { LoadMoreGrid } from "@/components/catalog/load-more-grid";
import { HomeHubGrid } from "@/components/home/home-hub-grid";
import { FeaturedBanners } from "@/components/home/featured-banners";

export const revalidate = 600;

export default async function HomePage() {
  // Home: "Yeni Ürünler" listesi cursor-based pagination ile gelir (Load More).
  // Favoriler client-side FavoritesProvider ile hydrate edilir; ISR için userId yok.
  const limit = 20;

  const initialProducts = await getLatestProductsCursor({ limit, userId: null });
  const initialNextCursor = getNextCursor(initialProducts, limit);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-20 sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-screen-2xl">
      {/* Header'a dokunma (layout / header component aynı kalacak) */}

      {/* Above the fold: 2x2 Hub Grid */}
      <HomeHubGrid />
      <FeaturedBanners />

      {/* Yeni Ürünler (dokunma) */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold text-foreground">Yeni Ürünler</h2>

        <div className="mt-4">
          <LoadMoreGrid
            initialProducts={initialProducts}
            initialNextCursor={initialNextCursor}
            limit={limit}
          />
        </div>
      </section>
    </div>
  );
}
