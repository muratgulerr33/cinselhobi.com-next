import Link from "next/link";
import {
  getAdminDashboardSummary,
  getAdminLowStockProducts,
  getAdminTopProducts,
} from "@/db/queries/admin";
import { formatPriceCents } from "@/lib/format";
import { ShoppingBag, Clock3, DollarSign, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOW_STOCK_THRESHOLD = 5;

export default async function AdminDashboardPage() {
  const [summary, topProducts, lowStockProducts] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminTopProducts({ days: 30, limit: 10 }),
    getAdminLowStockProducts({ threshold: LOW_STOCK_THRESHOLD, limit: 10 }),
  ]);

  const statCards = [
    {
      title: "Bugünkü Sipariş",
      value: summary.todaysOrdersCount.toString(),
      icon: ShoppingBag,
      description: "Güncel sipariş trafiği",
    },
    {
      title: "Bekleyen / Hazırlanıyor",
      value: summary.pendingProcessingOrdersCount.toString(),
      icon: Clock3,
      description: "İşlem bekleyen siparişler",
      variant: "warning" as const,
    },
    {
      title: "Son 7 Gün Ciro",
      value: formatPriceCents(summary.last7DaysRevenue),
      icon: DollarSign,
      description: "Teslim edilen siparişler",
      variant: "success" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Admin paneli genel bakış ve istatistikler
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold mt-2">{card.value}</p>
                  {card.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.description}
                    </p>
                  )}
                </div>
                <div
                  className={`rounded-full p-3 ${
                    card.variant === "warning"
                      ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      : card.variant === "success"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">En Çok Satan Ürünler</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Son 30 gün içindeki teslim edilen siparişlere göre.
          </p>
        </div>

        {topProducts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Son 30 günde satış verisi bulunamadı.
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
                {topProducts.map((item) => (
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
                        <Link href={`/admin/products/${item.productId}/edit`} className="gap-2">
                          Ürüne Git
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Stoğu Azalan Ürünler</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Eşik değeri: {LOW_STOCK_THRESHOLD} adet ve altı.
          </p>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Stoğu azalan ürün bulunamadı.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Ürün</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Stok</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Eşik</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lowStockProducts.map((item) => (
                  <tr key={item.productId} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">/{item.productSlug}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.stockQuantity}</td>
                    <td className="px-4 py-3 text-sm">{LOW_STOCK_THRESHOLD}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/products/${item.productId}/edit`} className="gap-2">
                          Düzenle
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
