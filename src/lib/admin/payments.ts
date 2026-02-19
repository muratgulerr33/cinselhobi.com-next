import type { AdminPaymentMethod, AdminPaymentStatus } from "@/db/queries/admin";
import {
  getAdminPaymentStatusBadgeVariant,
  getAdminPaymentStatusLabel,
} from "@/lib/admin/status-display";

export const PAYMENT_METHOD_LABELS: Record<AdminPaymentMethod, string> = {
  cod: "Kapıda Ödeme",
  credit_card: "Kart Ödeme",
};

export const PAYMENT_STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  failed: "Başarısız",
  refunded: "İade",
  cancelled: "İptal",
};

export function getPaymentMethodLabel(method: AdminPaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export function getPaymentStatusLabel(status: AdminPaymentStatus | null): string {
  return getAdminPaymentStatusLabel(status);
}

export function getPaymentStatusBadgeVariant(status: AdminPaymentStatus | null) {
  return getAdminPaymentStatusBadgeVariant(status);
}
