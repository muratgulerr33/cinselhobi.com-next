import { getTopCategories } from "@/db/queries/catalog";
import { CategoryGrid } from "@/components/catalog/category-grid";

export default async function CategoriesPage() {
  const categories = await getTopCategories(20);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-3xl font-bold">Kategoriler</h1>
        <p className="mt-2 text-muted-foreground">
          Tüm ürün kategorilerimizi keşfedin.
        </p>
      </div>

      <section className="space-y-4">
        <CategoryGrid categories={categories} />
      </section>
    </div>
  );
}

