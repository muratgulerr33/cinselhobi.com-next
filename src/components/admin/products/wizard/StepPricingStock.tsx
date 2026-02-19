"use client";

import type { ProductFormStepSharedProps } from "./types";
import type { AdminProductStockStatus } from "@/lib/admin/products";
import { Input } from "@/components/ui/input";
import { MoneyInputTR } from "@/components/ui/money-input-tr";

export function StepPricingStock({ values, isPending, fieldErrors, updateField }: ProductFormStepSharedProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="product-price" className="mb-2 block text-sm font-medium">
            Fiyat *
          </label>
          <MoneyInputTR
            id="product-price"
            value={values.price}
            onChange={(nextValue) => updateField("price", nextValue)}
            placeholder="74.900,00 veya 74900"
            disabled={isPending}
          />
          {fieldErrors.price ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.price}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="product-compare-price" className="mb-2 block text-sm font-medium">
            İndirimli Fiyat (V2)
          </label>
          <Input
            id="product-compare-price"
            value={values.compareAtPrice}
            onChange={(event) => updateField("compareAtPrice", event.target.value)}
            placeholder="249.90 veya 24990"
            disabled
          />
          <p className="mt-1 text-xs text-muted-foreground">V2&apos;de aktif olacak.</p>
          {fieldErrors.compareAtPrice ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.compareAtPrice}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="product-stock-quantity" className="mb-2 block text-sm font-medium">
            Stok Adedi
          </label>
          <Input
            id="product-stock-quantity"
            value={values.stockQuantity}
            onChange={(event) => updateField("stockQuantity", event.target.value)}
            placeholder="Örn: 50"
            disabled={isPending}
          />
          {fieldErrors.stockQuantity ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.stockQuantity}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="product-stock-status" className="mb-2 block text-sm font-medium">
          Stok Durumu
        </label>
        <select
          id="product-stock-status"
          value={values.stockStatus}
          onChange={(event) => updateField("stockStatus", event.target.value as AdminProductStockStatus)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          disabled={isPending}
        >
          <option value="instock">Stokta</option>
          <option value="outofstock">Tükendi</option>
        </select>
        {fieldErrors.stockStatus ? (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.stockStatus}</p>
        ) : null}
      </div>
    </div>
  );
}
