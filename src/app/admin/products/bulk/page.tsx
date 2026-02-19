import Link from "next/link";
import { z } from "zod";
import { BulkPriceForm } from "@/components/admin/products/bulk-price-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ADMIN_BULK_PRODUCT_LIMIT_OPTIONS,
  DEFAULT_ADMIN_BULK_PRODUCT_LIMIT,
  listAdminProductsForBulk,
  type AdminBulkProductLimit,
  type AdminBulkProductStockFilter,
} from "@/lib/admin/products";

interface AdminProductsBulkPageProps {
  searchParams: Promise<{
    q?: string | string[];
    stock?: string | string[];
    limit?: string | string[];
  }>;
}

const stockFilterSchema = z.enum(["all", "instock", "outofstock"]).catch("all");
const limitSchema = z
  .enum(["50", "100", "200"])
  .transform((value) => Number(value) as AdminBulkProductLimit)
  .catch(DEFAULT_ADMIN_BULK_PRODUCT_LIMIT);

function getFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseStockFilter(value: string): AdminBulkProductStockFilter {
  return stockFilterSchema.parse(value);
}

function parseLimit(value: string): AdminBulkProductLimit {
  return limitSchema.parse(value);
}

export default async function AdminProductsBulkPage({ searchParams }: AdminProductsBulkPageProps) {
  const params = await searchParams;
  const query = getFirstParam(params.q).trim();
  const stockStatus = parseStockFilter(getFirstParam(params.stock));
  const limit = parseLimit(getFirstParam(params.limit));

  const products = await listAdminProductsForBulk({
    query: query || undefined,
    stockStatus,
    limit,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Toplu Ürün Güncelleme</h1>
          <p className="mt-2 text-muted-foreground">
            Seçtiğiniz ürünlerin fiyatlarını toplu olarak önizleme ile güncelleyin.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/products">Ürünlere Dön</Link>
        </Button>
      </div>

      <form method="GET" className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px_auto]">
          <div>
            <label htmlFor="q" className="mb-2 block text-sm font-medium">
              Arama
            </label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Ürün adı veya slug"
            />
          </div>

          <div>
            <label htmlFor="stock" className="mb-2 block text-sm font-medium">
              Stok
            </label>
            <select
              id="stock"
              name="stock"
              defaultValue={stockStatus}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Tümü</option>
              <option value="instock">Stokta</option>
              <option value="outofstock">Tükendi</option>
            </select>
          </div>

          <div>
            <label htmlFor="limit" className="mb-2 block text-sm font-medium">
              Limit
            </label>
            <select
              id="limit"
              name="limit"
              defaultValue={String(limit)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ADMIN_BULK_PRODUCT_LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto">
              Uygula
            </Button>
          </div>
        </div>
      </form>

      {products.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium">Ürün bulunamadı</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Filtreleri değiştirip tekrar deneyin.
          </p>
        </div>
      ) : (
        <BulkPriceForm products={products} />
      )}
    </div>
  );
}
