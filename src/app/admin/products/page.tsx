import Link from "next/link";
import { z } from "zod";
import {
  adminListProducts,
  ADMIN_PRODUCT_LIMIT_OPTIONS,
  DEFAULT_ADMIN_PRODUCT_LIMIT,
  type AdminProductLimit,
  type AdminProductStockFilter,
  type AdminProductsCursor,
} from "@/db/queries/admin";
import { getPrimaryImageUrl } from "@/lib/format";
import { formatPriceTL } from "@/lib/money/format-price";
import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CrossSellPicker } from "@/components/admin/cross-sell-picker";

interface AdminProductsPageProps {
  searchParams: Promise<{
    q?: string | string[];
    stock?: string | string[];
    limit?: string | string[];
    cursor?: string | string[];
  }>;
}

const stockFilterSchema = z.enum(["all", "instock", "outofstock"]).catch("all");
const limitSchema = z
  .enum(["25", "50", "100", "250", "500", "1000"])
  .transform((value) => Number(value) as AdminProductLimit)
  .catch(DEFAULT_ADMIN_PRODUCT_LIMIT);
const cursorPayloadSchema = z.object({
  updatedAt: z.string().datetime({ offset: true }),
  id: z.number().int().positive(),
});

function getFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseStockFilter(value: string): AdminProductStockFilter {
  return stockFilterSchema.parse(value);
}

function parseLimit(value: string): AdminProductLimit {
  return limitSchema.parse(value);
}

function decodeCursor(value: string): AdminProductsCursor | undefined {
  if (!value) return undefined;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) return undefined;

    return {
      updatedAt: new Date(parsed.data.updatedAt),
      id: parsed.data.id,
    };
  } catch {
    return undefined;
  }
}

function encodeCursor(cursor: AdminProductsCursor): string {
  return Buffer
    .from(JSON.stringify({ updatedAt: cursor.updatedAt.toISOString(), id: cursor.id }), "utf8")
    .toString("base64url");
}

function buildProductsHref({
  q,
  stock,
  limit,
  cursor,
}: {
  q: string;
  stock: AdminProductStockFilter;
  limit: AdminProductLimit;
  cursor?: string;
}): string {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (stock !== "all") params.set("stock", stock);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const query = params.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

function getStockBadgeVariant(stockStatus: string | null) {
  if (stockStatus === "instock") return "success" as const;
  if (stockStatus === "outofstock") return "destructive" as const;
  return "secondary" as const;
}

function getStockLabel(stockStatus: string | null) {
  if (stockStatus === "instock") return "Stokta";
  if (stockStatus === "outofstock") return "Tükendi";
  if (stockStatus === "onbackorder") return "Ön Sipariş";
  return "Belirsiz";
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const params = await searchParams;
  const q = getFirstParam(params.q).trim();
  const stock = parseStockFilter(getFirstParam(params.stock));
  const limit = parseLimit(getFirstParam(params.limit));
  const cursor = decodeCursor(getFirstParam(params.cursor));

  const result = await adminListProducts({
    q: q || undefined,
    stock,
    limit,
    cursor,
  });
  const products = result.items;
  const nextCursorParam = result.nextCursor ? encodeCursor(result.nextCursor) : undefined;
  const nextHref = nextCursorParam
    ? buildProductsHref({ q, stock, limit, cursor: nextCursorParam })
    : undefined;
  const firstPageHref = buildProductsHref({ q, stock, limit });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ürünler</h1>
          <p className="mt-2 text-muted-foreground">
            Katalogdaki ürünleri görüntüle
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/products/bulk">Toplu Güncelle</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">Ürün Ekle</Link>
          </Button>
        </div>
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
              defaultValue={q}
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
              defaultValue={stock}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {ADMIN_PRODUCT_LIMIT_OPTIONS.map((option) => (
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
          <p className="text-lg font-medium text-foreground">
            Ürün bulunamadı
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Filtreleri değiştirip tekrar deneyin.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Kapak
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Ürün Adı
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Fiyat
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Stok
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    Aksiyon
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const imageUrl = getPrimaryImageUrl(product.images);

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border bg-muted">
                          {imageUrl ? (
                            <SafeImage
                              src={imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{product.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatPriceTL(product.price)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={getStockBadgeVariant(product.stockStatus)}
                            className="w-fit"
                          >
                            {getStockLabel(product.stockStatus)}
                          </Badge>
                          {typeof product.stockQuantity === "number" && (
                            <span className="text-xs text-muted-foreground">
                              Adet: {product.stockQuantity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/products/${product.id}/edit`}>
                              Düzenle
                            </Link>
                          </Button>
                          <CrossSellPicker
                            productId={product.id}
                            productSlug={product.slug}
                            initialSelectedIds={product.crossSellIds}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Bu sayfada {products.length} ürün gösteriliyor.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={firstPageHref}>Başa dön</Link>
              </Button>
              {nextHref ? (
                <Button asChild>
                  <Link href={nextHref}>Sonraki</Link>
                </Button>
              ) : (
                <Button type="button" disabled>
                  Sonraki
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
