import Link from "next/link";
import { ProductForm } from "@/components/admin/products/product-form";
import { Button } from "@/components/ui/button";
import { getAdminProductFormCategories } from "@/lib/admin/products";

export default async function AdminProductNewPage() {
  const categories = await getAdminProductFormCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ürün Ekle</h1>
          <p className="mt-2 text-muted-foreground">
            Kataloga yeni ürün ekleyin.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/products">Ürünlere Dön</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ProductForm mode="create" categories={categories} />
      </div>
    </div>
  );
}
