"use client";

import type { ProductBasicsStepProps } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdminProductStatus } from "@/lib/admin/products";

export function StepBasics({
  values,
  isPending,
  fieldErrors,
  categoryInputPrefix,
  categories,
  onNameChange,
  onSlugChange,
  onGenerateSlug,
  onToggleCategory,
  updateField,
}: ProductBasicsStepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="product-name" className="mb-2 block text-sm font-medium">
            Ürün Adı *
          </label>
          <Input
            id="product-name"
            value={values.name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Ürün adını girin"
            disabled={isPending}
          />
          {fieldErrors.name ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="product-slug" className="block text-sm font-medium">
              Slug *
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGenerateSlug}
              disabled={isPending || values.name.trim().length === 0}
            >
              Slug oluştur
            </Button>
          </div>
          <Input
            id="product-slug"
            value={values.slug}
            onChange={(event) => onSlugChange(event.target.value)}
            placeholder="urun-slug"
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Küçük harf, sayı ve tire kullanılabilir.
          </p>
          {fieldErrors.slug ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.slug}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="product-status" className="mb-2 block text-sm font-medium">
          Durum
        </label>
        <select
          id="product-status"
          value={values.status}
          onChange={(event) => updateField("status", event.target.value as AdminProductStatus)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          disabled={isPending}
        >
          <option value="draft">Taslak</option>
          <option value="publish">Yayında</option>
        </select>
        {fieldErrors.status ? (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.status}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold">Kategoriler</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kategori bulunamadı. Bu alan şimdilik boş bırakılabilir.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => {
              const id = `${categoryInputPrefix}-${category.id}`;
              const checked = values.categoryIds.includes(category.id);

              return (
                <label
                  key={category.id}
                  htmlFor={id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggleCategory(category.id, event.target.checked)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <span>{category.name}</span>
                </label>
              );
            })}
          </div>
        )}

        {fieldErrors.categoryIds ? (
          <p className="mt-2 text-xs text-destructive">{fieldErrors.categoryIds}</p>
        ) : null}
      </div>
    </div>
  );
}
