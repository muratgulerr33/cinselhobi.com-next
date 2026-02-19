import type { AdminProductStockStatus } from "@/lib/admin/products";
import { parseMoneyToCents } from "@/lib/admin/product-money";

export const BULK_PRICE_OPERATION_MODES = [
  "percent_increase",
  "percent_decrease",
  "fixed_increase",
  "fixed_decrease",
  "set_fixed",
] as const;

export type BulkPriceOperationMode = (typeof BULK_PRICE_OPERATION_MODES)[number];

export type BulkStockStatusMode = "keep" | AdminProductStockStatus;

export interface BulkPriceOperationInput {
  mode: BulkPriceOperationMode;
  value: string;
  applyToCompareAtPrice?: boolean;
  keepCompareAtGtePrice?: boolean;
  stockStatus?: BulkStockStatusMode;
  stockQuantity?: string;
}

export interface NormalizedBulkPriceOperation {
  mode: BulkPriceOperationMode;
  value: number;
  applyToCompareAtPrice: boolean;
  keepCompareAtGtePrice: boolean;
  stockStatus: BulkStockStatusMode;
  stockQuantity?: number;
}

export interface BulkPricePreview {
  newPrice: number;
  newCompareAtPrice: number | null;
}

export function parseBulkPriceOperation(
  input: BulkPriceOperationInput
): { ok: true; operation: NormalizedBulkPriceOperation } | { ok: false; error: string } {
  const rawValue = input.value.trim();
  if (!rawValue) {
    return { ok: false, error: "İşlem değeri zorunludur" };
  }

  let parsedValue = 0;

  if (input.mode === "percent_increase" || input.mode === "percent_decrease") {
    const normalized = rawValue.replace(/\s+/g, "").replace(",", ".");
    if (!/^(?:\d+)(?:\.\d{1,4})?$/.test(normalized)) {
      return { ok: false, error: "Yüzde değeri geçersiz" };
    }

    const percent = Number.parseFloat(normalized);
    if (!Number.isFinite(percent)) {
      return { ok: false, error: "Yüzde değeri geçersiz" };
    }

    parsedValue = percent;
  } else {
    const compact = rawValue.replace(/\s+/g, "");
    const amount = /^\d+$/.test(compact)
      ? Number.parseInt(compact, 10) * 100
      : parseMoneyToCents(rawValue, true);
    if (!Number.isFinite(amount)) {
      return { ok: false, error: "Tutar geçersiz" };
    }

    parsedValue = amount;
  }

  let stockQuantity: number | undefined;
  const rawStockQuantity = (input.stockQuantity ?? "").trim();
  if (rawStockQuantity) {
    if (!/^\d+$/.test(rawStockQuantity)) {
      return { ok: false, error: "Stok adedi tam sayı olmalıdır" };
    }
    stockQuantity = Number.parseInt(rawStockQuantity, 10);
  }

  return {
    ok: true,
    operation: {
      mode: input.mode,
      value: parsedValue,
      applyToCompareAtPrice: false,
      keepCompareAtGtePrice: false,
      stockStatus: input.stockStatus === "instock" || input.stockStatus === "outofstock"
        ? input.stockStatus
        : "keep",
      stockQuantity,
    },
  };
}

export function applyBulkPriceOperation(basePrice: number, operation: NormalizedBulkPriceOperation): number {
  const safeBase = Math.max(0, basePrice);
  let nextPrice = safeBase;

  switch (operation.mode) {
    case "percent_increase":
      nextPrice = Math.round(safeBase * (1 + (operation.value / 100)));
      break;
    case "percent_decrease":
      nextPrice = Math.round(safeBase * (1 - (operation.value / 100)));
      break;
    case "fixed_increase":
      nextPrice = safeBase + operation.value;
      break;
    case "fixed_decrease":
      nextPrice = safeBase - operation.value;
      break;
    case "set_fixed":
      nextPrice = operation.value;
      break;
  }

  return Math.max(0, nextPrice);
}

export function computeBulkPricePreview(
  currentPrice: number | null,
  currentCompareAtPrice: number | null,
  operation: NormalizedBulkPriceOperation
): BulkPricePreview {
  const basePrice = currentPrice ?? 0;
  const newPrice = applyBulkPriceOperation(basePrice, operation);

  return {
    newPrice,
    newCompareAtPrice: currentCompareAtPrice,
  };
}
