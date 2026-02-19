import Link from "next/link";
import { z } from "zod";
import { listAdminCustomers } from "@/db/queries/admin";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminCustomersPageProps {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    limit?: string | string[];
  }>;
}

const pageSchema = z.coerce.number().int().min(1).catch(1);
const limitSchema = z.enum(["20", "50", "100"]).transform(Number).catch(20);

function getFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function buildCustomersHref({
  q,
  page,
  limit,
}: {
  q: string;
  page: number;
  limit: number;
}): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  if (limit !== 20) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}

export default async function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  const params = await searchParams;
  const q = getFirstParam(params.q).trim();
  const page = pageSchema.parse(getFirstParam(params.page));
  const limit = limitSchema.parse(getFirstParam(params.limit));

  const result = await listAdminCustomers({
    q: q || undefined,
    page,
    limit,
  });

  const activePage = Math.min(page, result.totalPages);
  const prevHref = buildCustomersHref({ q, limit, page: Math.max(1, activePage - 1) });
  const nextHref = buildCustomersHref({ q, limit, page: Math.min(result.totalPages, activePage + 1) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Müşteriler</h1>
        <p className="text-muted-foreground mt-2">
          Müşteri sipariş sayısı, harcama ve son sipariş tarihini görüntüleyin.
        </p>
      </div>

      <form method="GET" className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
          <div>
            <label htmlFor="q" className="mb-2 block text-sm font-medium">
              Arama
            </label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Ad, email veya telefon"
            />
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
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto">
              Uygula
            </Button>
          </div>
        </div>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium text-foreground">Kayıt bulunamadı</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Arama filtresini değiştirip tekrar deneyin.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Müşteri</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Toplam Sipariş</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Toplam Harcama</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Son Sipariş</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((item) => (
                  <tr key={item.userId} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{item.name || "İsimsiz"}</p>
                      <p className="text-xs text-muted-foreground">{item.email || "—"}</p>
                      <p className="text-xs text-muted-foreground">{item.phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.totalOrders}</td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {formatPriceCents(item.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.lastOrderAt ? formatDate(item.lastOrderAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/orders?userId=${encodeURIComponent(item.userId)}`}>
                          Siparişlerini Gör
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Toplam {result.total} kayıt. Sayfa {activePage}/{result.totalPages}.
            </p>
            <div className="flex items-center gap-2">
              {activePage > 1 ? (
                <Button variant="outline" asChild>
                  <Link href={prevHref}>Önceki</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Önceki
                </Button>
              )}

              {activePage < result.totalPages ? (
                <Button asChild>
                  <Link href={nextHref}>Sonraki</Link>
                </Button>
              ) : (
                <Button disabled>Sonraki</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
