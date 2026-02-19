import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductForm } from "@/components/admin/products/product-form";
import { Button } from "@/components/ui/button";
import {
  getAdminProductForEdit,
  getAdminProductFormCategories,
} from "@/lib/admin/products";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }

  const [categories, product] = await Promise.all([
    getAdminProductFormCategories(),
    getAdminProductForEdit(parsedParams.data.id),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ürün Düzenle</h1>
          <p className="mt-2 text-muted-foreground">
            /{product.slug}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/products">Ürünlere Dön</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ProductForm
          mode="edit"
          productId={product.id}
          categories={categories}
          initialValues={product}
        />
      </div>
    </div>
  );
}
