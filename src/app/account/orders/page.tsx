import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserOrders } from "@/db/queries/order";
import { formatPriceCents, formatDate, getPrimaryImageUrl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";

function getStatusBadgeVariant(status: string) {
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

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Beklemede";
    case "processing":
      return "İşleniyor";
    case "shipped":
      return "Kargoda";
    case "delivered":
      return "Teslim Edildi";
    case "cancelled":
      return "İptal Edildi";
    default:
      return status;
  }
}

function formatOrderId(orderId: string) {
  return orderId.substring(0, 8).toUpperCase();
}

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const orders = await getUserOrders(session.user.id);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-2xl font-semibold">Siparişlerim</h1>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto max-w-sm">
            <p className="text-lg font-medium text-foreground">
              Henüz siparişiniz yok
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              İlk siparişinizi vermek için ürünleri keşfedin.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              Alışverişe Başla
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const firstItem = order.orderItems[0];
            const firstImage = firstItem
              ? getPrimaryImageUrl(firstItem.product.imageUrl)
              : null;
            const itemCount = order.orderItems.length;

            return (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {firstImage && (
                    <div className="relative h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden border border-border bg-muted">
                      <SafeImage
                        src={firstImage}
                        alt={firstItem.product.name || "Ürün"}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">
                            Sipariş #{formatOrderId(order.id)}
                          </h3>
                          <Badge
                            variant={getStatusBadgeVariant(order.status)}
                            className="text-xs flex-shrink-0"
                          >
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-lg">
                          {formatPriceCents(order.totalAmount)}
                        </p>
                        {itemCount > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {itemCount} ürün
                          </p>
                        )}
                      </div>
                    </div>
                    {firstItem && (
                      <p className="text-sm text-foreground/80 truncate">
                        {firstItem.product.name}
                        {itemCount > 1 && ` ve ${itemCount - 1} ürün daha`}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

