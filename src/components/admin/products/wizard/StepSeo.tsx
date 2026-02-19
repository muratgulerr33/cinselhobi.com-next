"use client";

import type { ProductSeoStepProps } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function StepSeo({
  values,
  isPending,
  fieldErrors,
  updateField,
  seoTitleTouched,
  onSeoTitleChange,
  onResetSeoTitleFromName,
}: ProductSeoStepProps) {
  const seoDescriptionLength = values.seoDescription.trim().length;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor="product-seo-title" className="block text-sm font-medium">
            SEO Title
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetSeoTitleFromName}
            disabled={isPending}
          >
            Başlıktan otomatik doldur
          </Button>
        </div>
        <Input
          id="product-seo-title"
          value={values.seoTitle}
          onChange={(event) => onSeoTitleChange(event.target.value)}
          placeholder="Arama sonuçları başlığı"
          disabled={isPending}
          maxLength={70}
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{seoTitleTouched ? "Manuel düzenleme açık" : "Ürün adı ile senkron"}</span>
          <span>{values.seoTitle.trim().length}/70</span>
        </div>
        {fieldErrors.seoTitle ? (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.seoTitle}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="product-seo-description" className="mb-2 block text-sm font-medium">
          SEO Description
        </label>
        <textarea
          id="product-seo-description"
          value={values.seoDescription}
          onChange={(event) => updateField("seoDescription", event.target.value)}
          rows={4}
          disabled={isPending}
          maxLength={180}
          placeholder="Arama sonuçları açıklaması"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <div className="mt-1 flex items-center justify-end text-xs text-muted-foreground">
          <span>{seoDescriptionLength}/180</span>
        </div>
        {fieldErrors.seoDescription ? (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.seoDescription}</p>
        ) : null}
      </div>
    </div>
  );
}
