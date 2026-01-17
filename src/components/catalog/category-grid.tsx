import Link from "next/link";
import { normalizeCategoryName } from "@/lib/format/normalize-category-name";

interface Category {
  name: string;
  slug: string;
  imageUrl?: string | null;
}

interface CategoryGridProps {
  categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground text-center text-muted-foreground">
        Henüz kategori bulunmuyor.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5 xl:gap-6">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/${category.slug}`}
          className="rounded-2xl border border-border bg-card p-4 text-card-foreground transition-transform active:scale-[0.98]"
        >
          {category.imageUrl ? (
            <img
              src={category.imageUrl}
              alt={category.name}
              className="mb-3 h-32 w-full rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="mb-3 h-32 w-full rounded-xl bg-muted" />
          )}
          <div className="font-medium">{normalizeCategoryName(category.name)}</div>
        </Link>
      ))}
    </div>
  );
}

