import { ProductCard } from "./product-card";

interface Product {
  id?: number;
  name: string;
  slug: string;
  price?: number | null;
  images?: unknown;
  stockStatus?: string | null;
  isFavorite?: boolean;
}

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground text-center text-muted-foreground">
        Henüz ürün bulunmuyor.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5 xl:gap-6">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} isFavorite={product.isFavorite} />
      ))}
    </div>
  );
}

