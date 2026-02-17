import { getAllOrders } from "@/db/queries/admin";
import { formatPriceCents, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

function getStatusBadgeVariant(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "warning";
    case "processing":
      return "info";
    case "shipped":
      return "info";
    case "delivered":
      return "success";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: OrderStatus) {
  return ORDER_STATUS_LABELS[status];
}

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

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Siparişler</h1>
        <p className="text-muted-foreground mt-2">
          Tüm siparişleri görüntüle ve yönet
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium text-foreground">
            Henüz sipariş yok
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Siparişler burada görüntülenecek.
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
                        variant={getStatusBadgeVariant(order.status)}
                        className="text-xs"
                      >
                        {getStatusLabel(order.status)}
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
