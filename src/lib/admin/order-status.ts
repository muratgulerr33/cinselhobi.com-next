export const ORDER_STATUS = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Bekliyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim",
  cancelled: "İptal",
};

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> =
  ORDER_STATUS.map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  }));
