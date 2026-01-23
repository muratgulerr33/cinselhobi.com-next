import { auth } from "@/auth";
import { getLatestProductsCursor } from "@/db/queries/catalog";
import { LoadMoreGrid } from "@/components/catalog/load-more-grid";
import { HomeHubGrid } from "@/components/home/home-hub-grid";

type CursorProduct = { id?: number; wcId?: number };

function getNextCursor(products: CursorProduct[], limit: number): number | null {
  // If we fetched fewer than `limit`, there is no next page.
  if (products.length < limit) return null;

  const last = products[products.length - 1];
  // Prefer DB id; fallback to WooCommerce id if that's what the query returns.
  const cursor = last?.id ?? last?.wcId ?? null;

  // If cursor is missing for some reason, stop pagination safely.
  return typeof cursor === "number" ? cursor : null;
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Home: "Yeni Ürünler" listesi cursor-based pagination ile gelir (Load More).
  // BU KISIM: HomeHubGrid eklenirken BOZULMAMALI.
  const limit = 20;

  const initialProducts = await getLatestProductsCursor({ limit, userId });
  const initialCursor = getNextCursor(initialProducts, limit);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-20 sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-screen-2xl">
      {/* Header'a dokunma (layout / header component aynı kalacak) */}

      {/* Above the fold: 2x2 Hub Grid */}
      <HomeHubGrid />

      {/* Yeni Ürünler (dokunma) */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold text-foreground">Yeni Ürünler</h2>

        <div className="mt-4">
          <LoadMoreGrid
            initialProducts={initialProducts}
            initialCursor={initialCursor}
            limit={limit}
          />
        </div>
      </section>
    </div>
  );
}
