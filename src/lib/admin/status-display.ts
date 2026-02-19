import type { AdminOrderStatus, AdminPaymentStatus } from "@/db/queries/admin";

const ORDER_STATUS_TR_LABELS: Record<AdminOrderStatus, string> = {
  pending: "Bekliyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim",
  cancelled: "İptal",
};

const PAYMENT_STATUS_TR_LABELS: Record<AdminPaymentStatus, string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  failed: "Başarısız",
  refunded: "İade",
  cancelled: "İptal",
};

export function getAdminOrderStatusLabel(status: AdminOrderStatus): string {
  return ORDER_STATUS_TR_LABELS[status] ?? status;
}

export function getAdminOrderStatusBadgeVariant(status: AdminOrderStatus) {
  if (status === "pending") return "warning" as const;
  if (status === "processing") return "info" as const;
  if (status === "shipped") return "info" as const;
  if (status === "delivered") return "success" as const;
  if (status === "cancelled") return "destructive" as const;
  return "secondary" as const;
}

export function getAdminPaymentStatusLabel(status: AdminPaymentStatus | null): string {
  if (!status) {
    return "Bekliyor";
  }
  return PAYMENT_STATUS_TR_LABELS[status] ?? status;
}

export function getAdminPaymentStatusBadgeVariant(status: AdminPaymentStatus | null) {
  if (status === "paid") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "refunded") return "info" as const;
  if (status === "cancelled") return "secondary" as const;
  return "secondary" as const;
}
