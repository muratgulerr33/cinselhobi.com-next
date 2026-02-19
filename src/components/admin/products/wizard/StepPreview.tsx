"use client";

import { ProductCard } from "@/components/product/product-card";
import { SafeImage } from "@/components/ui/safe-image";
import { formatPrice } from "@/lib/format";
import { parseMoneyToCents } from "@/lib/admin/product-money";
import type { AdminProductFormCategory } from "@/lib/admin/products";
import type { ProductFormValues } from "./types";

interface StepPreviewProps {
  values: ProductFormValues;
  categories: AdminProductFormCategory[];
}

function stripUnsafeHtml(input: string): string {
  if (!input) return "";
  const noScripts = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const noStyles = noScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  return noStyles.replace(/\son\w+="[^"]*"/gi, "");
}

function htmlToPlainText(input: string): string {
  const cleaned = stripUnsafeHtml(input || "");
  return cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function stockStatusLabel(stockStatus: string): string {
  if (stockStatus === "instock") return "Stokta";
  if (stockStatus === "outofstock") return "Tükendi";
  return "Belirsiz";
}

function statusLabel(status: string): string {
  return status === "publish" ? "Yayında" : "Taslak";
}

function resolvePreviewPrice(price: string): number {
  const cents = parseMoneyToCents(price, false);
  return typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
}

export function StepPreview({ values, categories }: StepPreviewProps) {
  const previewImages = values.imageUrls.map((item) => item.trim()).filter((item) => item.length > 0);
  const firstImage = previewImages[0] ?? "";
  const previewPrice = resolvePreviewPrice(values.price);
  const safeDescriptionHtml = stripUnsafeHtml(values.descriptionLong || "");
  const descriptionSnippet = htmlToPlainText(values.descriptionLong || "").slice(0, 180);

  const categoryNameMap = new Map(categories.map((category) => [category.id, category.name]));
  const selectedCategoryNames = values.categoryIds
    .map((id) => categoryNameMap.get(id))
    .filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold">Özet</h2>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <p><span className="text-muted-foreground">Ad:</span> {values.name || "-"}</p>
          <p><span className="text-muted-foreground">Slug:</span> /{values.slug || "-"}</p>
          <p><span className="text-muted-foreground">Durum:</span> {statusLabel(values.status)}</p>
          <p><span className="text-muted-foreground">Fiyat:</span> {previewPrice > 0 ? formatPrice(previewPrice) : "-"}</p>
          <p><span className="text-muted-foreground">Stok:</span> {stockStatusLabel(values.stockStatus)}</p>
          <p><span className="text-muted-foreground">Stok Adedi:</span> {values.stockQuantity || "-"}</p>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">Kategoriler:</span>{" "}
            {selectedCategoryNames.length > 0 ? selectedCategoryNames.join(", ") : "-"}
          </p>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">Görseller:</span>{" "}
            {previewImages.length > 0 ? `${previewImages.length} URL` : "-"}
          </p>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">SEO Title:</span>{" "}
            {values.seoTitle.trim() || "-"}
          </p>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">SEO Description:</span>{" "}
            {values.seoDescription.trim() || "-"}
          </p>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">Açıklama Özeti:</span>{" "}
            {descriptionSnippet || "-"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Storefront Benzeri Önizleme</h2>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="pointer-events-none max-w-[320px]">
            <ProductCard
              productId={0}
              slug={values.slug || "onizleme-urun"}
              title={values.name || "Ürün adı"}
              price={previewPrice}
              images={previewImages}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                {firstImage ? (
                  <SafeImage
                    src={firstImage}
                    alt={values.name || "Ürün"}
                    fill
                    className="object-contain p-2"
                    sizes="160px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Görsel yok
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{values.name || "Ürün adı"}</h3>
                  <p className="text-sm text-muted-foreground">/{values.slug || "slug"}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2 py-1 text-xs">
                    {statusLabel(values.status)}
                  </span>
                  <span className="rounded-full border border-border px-2 py-1 text-xs">
                    {stockStatusLabel(values.stockStatus)}
                  </span>
                </div>

                <p className="text-xl font-bold">{previewPrice > 0 ? formatPrice(previewPrice) : "Fiyat girilmedi"}</p>

                {safeDescriptionHtml ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: safeDescriptionHtml }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Açıklama girilmedi.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
