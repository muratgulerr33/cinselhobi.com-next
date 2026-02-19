import Link from "next/link";
import { z } from "zod";
import {
  getAdminReportMonthly,
  getAdminReportProducts,
  getAdminReportSummary,
  getRecentMonthKeys,
  type AdminPaymentMethod,
} from "@/db/queries/admin";
import { formatPriceCents } from "@/lib/format";
import { getPaymentMethodLabel } from "@/lib/admin/payments";
import { getAdminOrderStatusLabel } from "@/lib/admin/status-display";
import { Button } from "@/components/ui/button";

interface AdminReportsPageProps {
  searchParams: Promise<{
    view?: string | string[];
    month?: string | string[];
  }>;
}

const viewSchema = z.enum(["summary", "monthly", "products"]).catch("summary");
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

function getFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function formatMonthLabel(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const monthIndex = Number.parseInt(monthRaw ?? "", 10) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month;
  }
  const date = new Date(year, monthIndex, 1);
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

function buildReportsHref(view: "summary" | "monthly" | "products", month: string): string {
  const params = new URLSearchParams();
  if (view !== "summary") params.set("view", view);
  params.set("month", month);
  return `/admin/reports?${params.toString()}`;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const params = await searchParams;
  const view = viewSchema.parse(getFirstParam(params.view));
  const monthOptions = getRecentMonthKeys(12).reverse();
  const defaultMonth = monthOptions[0] ?? "";
  const monthCandidate = getFirstParam(params.month);
  const monthParse = monthSchema.safeParse(monthCandidate);
  const selectedMonth =
    monthParse.success && monthOptions.includes(monthParse.data)
      ? monthParse.data
      : defaultMonth;

  const [summary, monthlySales, productPerformance] = await Promise.all([
    getAdminReportSummary({ month: selectedMonth }),
    getAdminReportMonthly({ months: 12 }),
    getAdminReportProducts({ month: selectedMonth, limit: 20 }),
  ]);

  const paymentSplitRows: Array<{ method: AdminPaymentMethod; orderCount: number; totalAmount: number }> = (
    ["cod", "credit_card"] as const
  ).map((method) => {
    const found = summary.paymentMethodSplit.find((item) => item.method === method);
    if (found) {
      return found;
    }
    return {
      method,
      orderCount: 0,
      totalAmount: 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Raporlar</h1>
        <p className="text-muted-foreground mt-2">
          Genel özet, aylık satış ve ürün performans raporları.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { view: "summary" as const, label: "Genel Özet" },
            { view: "monthly" as const, label: "Aylık Satış" },
            { view: "products" as const, label: "Ürün Performansı" },
          ].map((tab) => (
            <Button key={tab.view} variant={view === tab.view ? "default" : "outline"} size="sm" asChild>
              <Link href={buildReportsHref(tab.view, selectedMonth)}>{tab.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      <form method="GET" className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-72">
            <label htmlFor="month" className="mb-2 block text-sm font-medium">
              Ay
            </label>
            <select
              id="month"
              name="month"
              defaultValue={selectedMonth}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="view" value={view} />
          <Button type="submit">Uygula</Button>
        </div>
      </form>

      {view === "summary" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">Toplam Sipariş ({formatMonthLabel(summary.month)})</p>
              <p className="mt-2 text-2xl font-bold">{summary.totalOrders}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                {getAdminOrderStatusLabel("delivered")} Edilen Ciro ({formatMonthLabel(summary.month)})
              </p>
              <p className="mt-2 text-2xl font-bold">{formatPriceCents(summary.totalRevenue)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Toplam Sipariş Tutarı ({formatMonthLabel(summary.month)})
              </p>
              <p className="mt-2 text-2xl font-bold">{formatPriceCents(summary.totalOrderAmount)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                {getAdminOrderStatusLabel("pending")} / {getAdminOrderStatusLabel("processing")}
              </p>
              <p className="mt-2 text-2xl font-bold">{summary.pendingProcessingOrders}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-lg font-semibold">Ödeme Yöntemi Dağılımı</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sipariş Tutarı (teslim edilmemiş dahil)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Yöntem</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Sipariş Sayısı</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Toplam Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paymentSplitRows.map((item) => (
                    <tr key={item.method} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm">{getPaymentMethodLabel(item.method)}</td>
                      <td className="px-4 py-3 text-sm">{item.orderCount}</td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatPriceCents(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {view === "monthly" ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">Aylık Satış (Son 12 Ay)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Ay</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Sipariş Sayısı</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Toplam Ciro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthlySales.map((item) => (
                  <tr key={item.month} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{formatMonthLabel(item.month)}</td>
                    <td className="px-4 py-3 text-sm">{item.orderCount}</td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {formatPriceCents(item.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {view === "products" ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">
              Ürün Performansı ({formatMonthLabel(selectedMonth)})
            </h2>
          </div>

          {productPerformance.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-lg font-medium">Kayıt bulunamadı</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Seçili ay için ürün performans verisi bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ürün</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Adet</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ciro</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productPerformance.map((item) => (
                    <tr key={item.productId} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">/{item.productSlug}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatPriceCents(item.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/products/${item.productId}/edit`}>Ürüne Git</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
