import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getAdminOrderDetail } from "@/db/queries/admin";
import { formatPriceCents, formatDate, getPrimaryImageUrl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { updateOrderStatus } from "@/actions/admin";
import { OrderStatusUpdateForm } from "@/components/admin/order-status-form";

function getStatusBadgeVariant(
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
) {
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

function getStatusLabel(
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
) {
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

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "admin") {
    redirect("/account");
  }

  const { id } = await params;
  const order = await getAdminOrderDetail(id);

  if (!order) {
    notFound();
  }

  // Ara toplam hesapla (ürünlerin toplamı)
  const subtotalCents = order.orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Kargo ücretsiz, genel toplam = ara toplam
  const shippingCents = 0;
  const totalCents = order.totalAmount;

  return (
    <div className="space-y-6">
      {/* Başlık ve Durum */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              Sipariş #{formatOrderId(order.id)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <Badge
            variant={getStatusBadgeVariant(order.status)}
            className="text-sm"
          >
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ödeme Yöntemi</span>
            <span className="font-medium">
              {getPaymentMethodLabel(order.paymentMethod)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Müşteri</span>
            <div className="text-right">
              <p className="font-medium">{order.user.name || "İsimsiz"}</p>
              <p className="text-muted-foreground text-xs">{order.user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sipariş Durumu Güncelleme */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Sipariş Durumu</h2>
        <OrderStatusUpdateForm orderId={order.id} currentStatus={order.status} />
      </div>

      {/* Sipariş Edilen Ürünler */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Sipariş Edilen Ürünler</h2>
        <div className="space-y-4">
          {order.orderItems.map((item) => {
            const imageUrl = getPrimaryImageUrl(item.product.imageUrl);

            return (
              <div
                key={item.id}
                className="flex items-start gap-4 pb-4 last:pb-0 border-b border-border last:border-0"
              >
                {imageUrl ? (
                  <Link
                    href={`/urun/${item.product.slug}`}
                    className="relative h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden border border-border bg-muted"
                  >
                    <SafeImage
                      src={imageUrl}
                      alt={item.product.name || "Ürün"}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </Link>
                ) : (
                  <div className="h-20 w-20 flex-shrink-0 rounded-xl border border-border bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/urun/${item.product.slug}`}
                    className="block hover:text-primary transition-colors"
                  >
                    <h3 className="font-medium text-base mb-1">
                      {item.product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} adet × {formatPriceCents(item.price)}
                    </p>
                    <p className="font-semibold">
                      {formatPriceCents(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Teslimat Adresi */}
      {order.address && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Teslimat Adresi</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{order.address.title}</h3>
              {order.address.isDefault && (
                <Badge variant="default" className="text-xs">
                  Varsayılan
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {order.address.fullAddress}
            </p>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{order.address.district}</span>
              <span>•</span>
              <span>{order.address.city}</span>
              <span>•</span>
              <span>{order.address.phone}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fiyat Özeti */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Fiyat Özeti</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ara Toplam</span>
            <span className="font-medium">{formatPriceCents(subtotalCents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Kargo</span>
            <span className="font-medium">
              {shippingCents === 0 ? "Ücretsiz" : formatPriceCents(shippingCents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-lg font-semibold pt-3 border-t border-border">
            <span>Genel Toplam</span>
            <span>{formatPriceCents(totalCents)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

