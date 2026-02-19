import Link from "next/link";
import { z } from "zod";
import {
  ADMIN_PAYMENT_METHOD_FILTERS,
  ADMIN_PAYMENT_STATUS_FILTERS,
  listAdminPayments,
  type AdminPaymentMethodFilter,
  type AdminPaymentStatusFilter,
} from "@/db/queries/admin";
import { formatDate, formatPriceCents } from "@/lib/format";
import { getPaymentMethodLabel } from "@/lib/admin/payments";
import {
  getAdminPaymentStatusBadgeVariant,
  getAdminPaymentStatusLabel,
} from "@/lib/admin/status-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminPaymentsPageProps {
  searchParams: Promise<{
    q?: string | string[];
    method?: string | string[];
    status?: string | string[];
    datePreset?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    page?: string | string[];
    limit?: string | string[];
  }>;
}

const methodSchema = z.enum(ADMIN_PAYMENT_METHOD_FILTERS).catch("all");
const statusSchema = z.enum(ADMIN_PAYMENT_STATUS_FILTERS).catch("all");
const datePresetSchema = z.enum(["7d", "30d", "90d", "custom"]).catch("30d");
const pageSchema = z.coerce.number().int().min(1).catch(1);
const limitSchema = z.enum(["20", "50", "100"]).transform(Number).catch(20);
const dateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch("");

function getFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function resolveDateRange({
  datePreset,
  dateFrom,
  dateTo,
}: {
  datePreset: "7d" | "30d" | "90d" | "custom";
  dateFrom: string;
  dateTo: string;
}): { dateFrom?: Date; dateTo?: Date; error?: string } {
  if (datePreset === "custom") {
    const fromDate = parseDateInput(dateFrom);
    const toDate = parseDateInput(dateTo);
    if (!fromDate || !toDate) {
      return {
        error: "Özel tarih aralığında başlangıç ve bitiş alanları zorunludur.",
      };
    }

    if (fromDate.getTime() > toDate.getTime()) {
      return {
        error: "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
      };
    }

    return {
      dateFrom: startOfDay(fromDate),
      dateTo: endOfDay(toDate),
    };
  }

  const now = new Date();
  const days = datePreset === "7d" ? 7 : datePreset === "90d" ? 90 : 30;
  const fromDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  return {
    dateFrom: fromDate,
    dateTo: endOfDay(now),
  };
}

function buildPaymentsHref({
  q,
  method,
  status,
  datePreset,
  dateFrom,
  dateTo,
  page,
  limit,
}: {
  q: string;
  method: AdminPaymentMethodFilter;
  status: AdminPaymentStatusFilter;
  datePreset: "7d" | "30d" | "90d" | "custom";
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}): string {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (method !== "all") params.set("method", method);
  if (status !== "all") params.set("status", status);
  if (datePreset !== "30d") params.set("datePreset", datePreset);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (page > 1) params.set("page", String(page));
  if (limit !== 20) params.set("limit", String(limit));

  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

function formatOrderId(orderId: string) {
  return orderId.substring(0, 8).toUpperCase();
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const params = await searchParams;
  const q = getFirstParam(params.q).trim();
  const method = methodSchema.parse(getFirstParam(params.method));
  const status = statusSchema.parse(getFirstParam(params.status));
  const datePreset = datePresetSchema.parse(getFirstParam(params.datePreset));
  const dateFrom = dateInputSchema.parse(getFirstParam(params.dateFrom));
  const dateTo = dateInputSchema.parse(getFirstParam(params.dateTo));
  const page = pageSchema.parse(getFirstParam(params.page));
  const limit = limitSchema.parse(getFirstParam(params.limit));
  const isCustomDateRange = datePreset === "custom";
  const range = resolveDateRange({ datePreset, dateFrom, dateTo });

  const result = await listAdminPayments({
    q: q || undefined,
    method,
    status,
    page,
    limit,
    dateFrom: range.error ? undefined : range.dateFrom,
    dateTo: range.error ? undefined : range.dateTo,
  });

  const activePage = Math.min(page, result.totalPages);
  const baseHrefParams = {
    q,
    status,
    datePreset,
    dateFrom,
    dateTo,
    limit,
  };

  const prevHref = buildPaymentsHref({
    ...baseHrefParams,
    method,
    page: Math.max(1, activePage - 1),
  });
  const nextHref = buildPaymentsHref({
    ...baseHrefParams,
    method,
    page: Math.min(result.totalPages, activePage + 1),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ödemeler</h1>
        <p className="text-muted-foreground mt-2">
          Ödeme kayıtlarını yöntem, durum ve tarih filtresiyle yönetin.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all" as const, label: "Tümü" },
            { value: "cod" as const, label: "Kapıda Ödeme" },
            { value: "credit_card" as const, label: "Kart Ödeme" },
          ].map((tab) => (
            <Button
              key={tab.value}
              variant={method === tab.value ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link
                href={buildPaymentsHref({
                  ...baseHrefParams,
                  method: tab.value,
                  page: 1,
                })}
              >
                {tab.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <form method="GET" className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="q" className="mb-2 block text-sm font-medium">
              Arama
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Sipariş no / müşteri / PayTR ref"
            />
          </div>

          <div>
            <label htmlFor="method" className="mb-2 block text-sm font-medium">
              Ödeme Yöntemi
            </label>
            <select
              id="method"
              name="method"
              defaultValue={method}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">Tümü</option>
              <option value="cod">Kapıda Ödeme</option>
              <option value="credit_card">Kart Ödeme</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-medium">
              Durum
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">Tümü</option>
              <option value="paid">{getAdminPaymentStatusLabel("paid")}</option>
              <option value="pending">{getAdminPaymentStatusLabel("pending")}</option>
              <option value="failed">{getAdminPaymentStatusLabel("failed")}</option>
              <option value="refunded">{getAdminPaymentStatusLabel("refunded")}</option>
              <option value="cancelled">{getAdminPaymentStatusLabel("cancelled")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="datePreset" className="mb-2 block text-sm font-medium">
              Tarih Aralığı
            </label>
            <select
              id="datePreset"
              name="datePreset"
              defaultValue={datePreset}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="7d">Son 7 Gün</option>
              <option value="30d">Son 30 Gün</option>
              <option value="90d">Son 90 Gün</option>
              <option value="custom">Özel Aralık</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_auto]">
          <div className={isCustomDateRange ? "" : "opacity-60"}>
            <label htmlFor="dateFrom" className="mb-2 block text-sm font-medium">
              Başlangıç
            </label>
            <Input
              id="dateFrom"
              name="dateFrom"
              type="date"
              defaultValue={dateFrom}
              disabled={!isCustomDateRange}
            />
          </div>

          <div className={isCustomDateRange ? "" : "opacity-60"}>
            <label htmlFor="dateTo" className="mb-2 block text-sm font-medium">
              Bitiş
            </label>
            <Input
              id="dateTo"
              name="dateTo"
              type="date"
              defaultValue={dateTo}
              disabled={!isCustomDateRange}
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
            <Button type="submit" className="w-full sm:w-auto">
              Uygula
            </Button>
          </div>
        </div>

        {range.error ? (
          <p className="text-sm text-destructive">{range.error}</p>
        ) : null}
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium text-foreground">Kayıt bulunamadı</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Filtreleri değiştirip tekrar deneyin.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Tarih</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Sipariş</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Müşteri</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Yöntem</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Durum</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Tutar</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((item) => (
                  <tr key={item.orderId} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      #{formatOrderId(item.orderId)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{item.customer.name || "İsimsiz"}</p>
                      <p className="text-xs text-muted-foreground">{item.customer.email}</p>
                      {item.paymentTransactionId ? (
                        <p className="text-xs text-muted-foreground">
                          Ref: {item.paymentTransactionId}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getPaymentMethodLabel(item.paymentMethod)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getAdminPaymentStatusBadgeVariant(item.paymentStatus)} className="text-xs">
                        {getAdminPaymentStatusLabel(item.paymentStatus)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {formatPriceCents(item.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/orders/${item.orderId}`}>Siparişi Aç</Link>
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
