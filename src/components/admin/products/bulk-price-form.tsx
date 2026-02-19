"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkUpdateAdminProductsAction } from "@/actions/admin";
import {
  computeBulkPricePreview,
  parseBulkPriceOperation,
  type BulkPriceOperationMode,
  type BulkStockStatusMode,
} from "@/lib/admin/bulk-price";
import type { AdminBulkProductListItem } from "@/lib/admin/products";
import { formatPriceTL } from "@/lib/money/format-price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BulkPriceFormProps {
  products: AdminBulkProductListItem[];
}

interface ApplySummary {
  updatedCount: number;
  skippedCount: number;
  failures: Array<{ id: number; reason: string }>;
}

const operationLabels: Record<BulkPriceOperationMode, string> = {
  percent_increase: "Fiyatı yüzde artır",
  percent_decrease: "Fiyatı yüzde azalt",
  fixed_increase: "Sabit tutar ekle",
  fixed_decrease: "Sabit tutar düş",
  set_fixed: "Fiyatı sabitle",
};

function getValuePlaceholder(mode: BulkPriceOperationMode): string {
  if (mode === "percent_increase" || mode === "percent_decrease") {
    return "Örn: 10";
  }
  return "Örn: 100 veya 100,50 (TL)";
}

function formatChangeTL(change: number): string {
  if (change === 0) {
    return formatPriceTL(0);
  }

  const sign = change > 0 ? "+" : "";
  return `${sign}${formatPriceTL(change)}`;
}

export function BulkPriceForm({ products }: BulkPriceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<BulkPriceOperationMode>("percent_increase");
  const [value, setValue] = useState("");
  const applyToCompareAtPrice = false;
  const keepCompareAtGtePrice = false;
  const [stockStatus, setStockStatus] = useState<BulkStockStatusMode>("keep");
  const [stockQuantity, setStockQuantity] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(products.map((product) => product.id))
  );
  const [applySummary, setApplySummary] = useState<ApplySummary | null>(null);

  const parsedOperation = useMemo(
    () => parseBulkPriceOperation({
      mode,
      value,
      applyToCompareAtPrice,
      keepCompareAtGtePrice,
      stockStatus,
      stockQuantity,
    }),
    [mode, value, applyToCompareAtPrice, keepCompareAtGtePrice, stockStatus, stockQuantity]
  );

  const previewRows = useMemo(
    () => products.map((product) => {
      const isSelected = selectedIds.has(product.id);
      const currentPrice = product.price;
      const fallbackPreview = {
        newPrice: currentPrice ?? 0,
        newCompareAtPrice: product.compareAtPrice,
      };
      const preview = parsedOperation.ok && isSelected
        ? computeBulkPricePreview(product.price, product.compareAtPrice, parsedOperation.operation)
        : fallbackPreview;
      const change = preview.newPrice - (currentPrice ?? 0);

      return {
        ...product,
        currentPrice,
        newPrice: preview.newPrice,
        newCompareAtPrice: preview.newCompareAtPrice,
        change,
      };
    }),
    [products, parsedOperation, selectedIds]
  );

  const selectedRows = useMemo(
    () => previewRows.filter((row) => selectedIds.has(row.id)),
    [previewRows, selectedIds]
  );

  const selectedCount = selectedRows.length;
  const allChecked = previewRows.length > 0 && selectedCount === previewRows.length;
  const minChange = selectedRows.length > 0
    ? selectedRows.reduce((min, row) => Math.min(min, row.change), selectedRows[0].change)
    : null;
  const maxChange = selectedRows.length > 0
    ? selectedRows.reduce((max, row) => Math.max(max, row.change), selectedRows[0].change)
    : null;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(previewRows.map((row) => row.id)) : new Set());
  }

  function toggleOne(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function onApply() {
    setApplySummary(null);

    if (!parsedOperation.ok) {
      toast.error(parsedOperation.error);
      return;
    }

    if (selectedRows.length === 0) {
      toast.error("En az bir ürün seçmelisiniz");
      return;
    }

    const selectedProductIds = selectedRows.map((row) => row.id);

    startTransition(async () => {
      const result = await bulkUpdateAdminProductsAction({
        ids: selectedProductIds,
        operation: {
          mode,
          value,
          applyToCompareAtPrice,
          keepCompareAtGtePrice,
          stockStatus,
          stockQuantity,
        },
      });

      if (!result.success) {
        setApplySummary({
          updatedCount: result.updatedCount ?? 0,
          skippedCount: result.skippedCount ?? 0,
          failures: result.failures ?? [],
        });
        toast.error(result.error ?? "Toplu güncelleme sırasında bir hata oluştu");
        return;
      }

      const updatedCount = result.updatedCount ?? 0;
      const failures = result.failures ?? [];
      const skippedCount = result.skippedCount ?? 0;

      if (failures.length > 0) {
        setApplySummary({ updatedCount, skippedCount, failures });
        toast.error(`${updatedCount} ürün güncellendi, ${failures.length} ürün güncellenemedi`);
        return;
      }

      toast.success(`${updatedCount} ürün güncellendi`);
      router.push("/admin/products");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold">Toplu İşlem</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <label htmlFor="bulk-operation-mode" className="mb-2 block text-sm font-medium">
              İşlem Türü
            </label>
            <select
              id="bulk-operation-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as BulkPriceOperationMode)}
              disabled={isPending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(operationLabels).map(([operation, label]) => (
                <option key={operation} value={operation}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bulk-operation-value" className="mb-2 block text-sm font-medium">
              Değer
            </label>
            <Input
              id="bulk-operation-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={getValuePlaceholder(mode)}
              disabled={isPending}
            />
            {mode === "fixed_increase" || mode === "fixed_decrease" || mode === "set_fixed" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Sabit tutarlar TL olarak yorumlanır (100 = 100 TL).
              </p>
            ) : null}
            {!parsedOperation.ok ? (
              <p className="mt-1 text-xs text-destructive">{parsedOperation.error}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={applyToCompareAtPrice}
              onChange={() => undefined}
              disabled
            />
            İndirimli Fiyat (V2) alanına da uygula
          </label>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={keepCompareAtGtePrice}
              onChange={() => undefined}
              disabled
            />
            İndirimli Fiyat (V2), satış fiyatından düşük olmasın
          </label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">V2&apos;de aktif olacak.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="bulk-stock-status" className="mb-2 block text-sm font-medium">
              Opsiyonel Stok Durumu
            </label>
            <select
              id="bulk-stock-status"
              value={stockStatus}
              onChange={(event) => setStockStatus(event.target.value as BulkStockStatusMode)}
              disabled={isPending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="keep">Değiştirme</option>
              <option value="instock">Stokta</option>
              <option value="outofstock">Tükendi</option>
            </select>
          </div>

          <div>
            <label htmlFor="bulk-stock-quantity" className="mb-2 block text-sm font-medium">
              Opsiyonel Stok Adedi
            </label>
            <Input
              id="bulk-stock-quantity"
              value={stockQuantity}
              onChange={(event) => setStockQuantity(event.target.value)}
              placeholder="Boş bırak: değiştirme"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {applySummary ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">
            Son işlem: {applySummary.updatedCount} güncellendi, {applySummary.skippedCount} atlandı,
            {" "}{applySummary.failures.length} hata
          </p>
          {applySummary.failures.length > 0 ? (
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border p-2 text-xs text-muted-foreground">
              {applySummary.failures.map((failure) => (
                <p key={`${failure.id}-${failure.reason}`}>
                  #{failure.id}: {failure.reason}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Seçili: <span className="font-medium text-foreground">{selectedCount}</span>
            {" "} | Min değişim: {minChange === null ? "-" : formatChangeTL(minChange)}
            {" "} | Max değişim: {maxChange === null ? "-" : formatChangeTL(maxChange)}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => toggleAll(true)} disabled={isPending}>
              Tümünü Seç
            </Button>
            <Button type="button" variant="outline" onClick={() => toggleAll(false)} disabled={isPending}>
              Seçimi Temizle
            </Button>
            <Button
              type="button"
              onClick={onApply}
              disabled={isPending || selectedCount === 0 || !parsedOperation.ok}
            >
              {isPending ? "Uygulanıyor..." : "Seçililere Uygula"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(event) => toggleAll(event.target.checked)}
                    disabled={isPending || previewRows.length === 0}
                    aria-label="Tüm ürünleri seç"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Ürün</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Mevcut Fiyat</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Yeni Fiyat</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Değişim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={(event) => toggleOne(row.id, event.target.checked)}
                      disabled={isPending}
                      aria-label={`${row.name} ürününü seç`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">/{row.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatPriceTL(row.currentPrice)}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{formatPriceTL(row.newPrice)}</td>
                  <td className="px-4 py-3 text-sm">{formatChangeTL(row.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
