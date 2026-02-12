import { getAdminStats } from "@/db/queries/admin";
import { formatPriceCents } from "@/lib/format";
import { ShoppingBag, Clock, DollarSign } from "lucide-react";

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  const statCards = [
    {
      title: "Toplam Sipariş",
      value: stats.totalOrders.toString(),
      icon: ShoppingBag,
      description: "Tüm siparişler",
    },
    {
      title: "Bekleyen Siparişler",
      value: stats.pendingOrders.toString(),
      icon: Clock,
      description: "Onay bekleyen siparişler",
      variant: "warning" as const,
    },
    {
      title: "Toplam Ciro",
      value: formatPriceCents(stats.totalRevenue),
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
    </div>
  );
}

