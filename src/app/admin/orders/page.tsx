import { getAllOrders } from "@/db/queries/admin";
import { formatPriceCents, formatDate } from "@/lib/format";
import {
  getAdminOrderStatusBadgeVariant,
  getAdminOrderStatusLabel,
} from "@/lib/admin/status-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { z } from "zod";

interface AdminOrdersPageProps {
  searchParams: Promise<{
    userId?: string | string[];
  }>;
}

const userIdSchema = z.string().trim().min(1).max(255).catch("");

function getPaymentMethodLabel(method: "credit_card" | "cod") {
  switch (method) {
    case "credit_card":
      return "Kredi Kartı";
    case "cod":
      return "Kapıda Ödeme";
    default:
      return method;
  }
}

function formatOrderId(orderId: string) {
  return orderId.substring(0, 8).toUpperCase();
}

function getFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const params = await searchParams;
  const userId = userIdSchema.parse(getFirstParam(params.userId));
  const orders = await getAllOrders({ userId: userId || undefined });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Siparişler</h1>
        <p className="text-muted-foreground mt-2">
          Tüm siparişleri görüntüle ve yönet
        </p>
      </div>

      {userId ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Bu liste müşteri filtresiyle gösteriliyor.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">Filtreyi Temizle</Link>
          </Button>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium text-foreground">
            {userId ? "Kayıt bulunamadı" : "Henüz sipariş yok"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {userId ? "Seçili müşteriye ait sipariş bulunamadı." : "Siparişler burada görüntülenecek."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Sipariş No
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Müşteri
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Ödeme
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    Aksiyon
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      #{formatOrderId(order.id)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {order.user.name || "İsimsiz"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {order.user.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {formatPriceCents(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={getAdminOrderStatusBadgeVariant(order.status)}
                        className="text-xs"
                      >
                        {getAdminOrderStatusLabel(order.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {getPaymentMethodLabel(order.paymentMethod)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                      >
                        <Link href={`/admin/orders/${order.id}`}>
                          Yönet
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
