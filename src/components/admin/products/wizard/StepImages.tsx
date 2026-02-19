"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ProductFormStepSharedProps } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface StepImagesProps extends ProductFormStepSharedProps {
  productId?: number;
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
  onUpdateImage: (index: number, value: string) => void;
}

const LABEL_PRESETS = [
  "yan-profil",
  "dizustu",
  "kutu",
  "olcu",
  "detay",
  "yakin-gorunum",
  "genis-aci",
] as const;

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isUploadPath(value: string): boolean {
  return /^\/uploads\//i.test(value);
}

function isLegacyProductPath(value: string): boolean {
  return /^\/products\//i.test(value);
}

function defaultLabelForRow(index: number, imageUrl: string): string {
  return index === 0 && isRemoteUrl(imageUrl.trim()) ? "kapak" : "";
}

function extractUploadLabelFromPath(uploadPath: string, productSlug: string): string {
  const match = uploadPath.match(/^\/uploads\/products\/\d+\/([^/?#]+)$/i);
  if (!match) return "";

  const filename = match[1] ?? "";
  const withoutExt = filename.replace(/\.webp$/i, "");
  const slugPrefix = productSlug.trim();

  if (slugPrefix && withoutExt.startsWith(`${slugPrefix}-`)) {
    return withoutExt
      .slice(slugPrefix.length + 1)
      .replace(/-\d+$/, "");
  }

  return withoutExt.replace(/-\d+$/, "");
}

export function StepImages({
  productId,
  values,
  isPending,
  fieldErrors,
  onAddImage,
  onRemoveImage,
  onUpdateImage,
}: StepImagesProps) {
  const [loadingRows, setLoadingRows] = useState<Record<number, boolean>>({});
  const [labelsByRow, setLabelsByRow] = useState<Record<number, string>>({});
  const [renameOpenByRow, setRenameOpenByRow] = useState<Record<number, boolean>>({});
  const [renameDraftByRow, setRenameDraftByRow] = useState<Record<number, string>>({});
  const [brokenPreviewByRow, setBrokenPreviewByRow] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const maxIndex = values.imageUrls.length - 1;
    const compactByIndex = <T extends string | boolean>(entries: Record<number, T>) => {
      const next: Record<number, T> = {};
      for (const [key, value] of Object.entries(entries)) {
        const index = Number.parseInt(key, 10);
        if (Number.isInteger(index) && index >= 0 && index <= maxIndex) {
          next[index] = value;
        }
      }
      return next;
    };

    setLabelsByRow((prev) => compactByIndex(prev));
    setRenameOpenByRow((prev) => compactByIndex(prev));
    setRenameDraftByRow((prev) => compactByIndex(prev));
    setBrokenPreviewByRow((prev) => compactByIndex(prev));
    setLoadingRows((prev) => compactByIndex(prev));
  }, [values.imageUrls.length]);

  const setRowLoading = (index: number, isLoading: boolean) => {
    setLoadingRows((prev) => {
      if (isLoading) {
        return { ...prev, [index]: true };
      }

      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const isImportDisabledByProductId = typeof productId !== "number" || productId <= 0;

  const setRowLabel = (index: number, value: string) => {
    setLabelsByRow((prev) => ({ ...prev, [index]: value }));
  };

  const clearRenameState = (index: number) => {
    setRenameOpenByRow((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setRenameDraftByRow((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const setBrokenPreview = (index: number, isBroken: boolean) => {
    setBrokenPreviewByRow((prev) => ({ ...prev, [index]: isBroken }));
  };

  const handleImport = async (index: number, imageUrl: string) => {
    if (typeof productId !== "number" || productId <= 0) {
      toast.error("İçe aktar için önce Taslak Kaydet (ID oluşmalı).");
      return;
    }
    const resolvedProductId = productId;

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl || !isRemoteUrl(trimmedUrl)) return;

    setRowLoading(index, true);

    try {
      const label = (labelsByRow[index] ?? defaultLabelForRow(index, trimmedUrl)).trim();
      const response = await fetch("/api/admin/images/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: resolvedProductId,
          imageUrl: trimmedUrl,
          productSlug: values.slug || undefined,
          slug: values.slug || undefined,
          label: label || undefined,
          sortOrder: index,
        }),
      });

      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean;
        path?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || typeof payload.path !== "string") {
        throw new Error(payload.error || "İçe aktarma başarısız oldu");
      }

      onUpdateImage(index, payload.path);
      clearRenameState(index);
      setBrokenPreview(index, false);
      toast.success("Görsel içe aktarıldı");
    } catch (error) {
      const message = error instanceof Error ? error.message : "İçe aktarma başarısız oldu";
      toast.error(message);
    } finally {
      setRowLoading(index, false);
    }
  };

  const openRenameInline = (index: number, imageUrl: string) => {
    const currentLabel = extractUploadLabelFromPath(imageUrl.trim(), values.slug);
    setRenameOpenByRow((prev) => ({ ...prev, [index]: true }));
    setRenameDraftByRow((prev) => ({ ...prev, [index]: currentLabel }));
  };

  const handleRename = async (index: number, fromPath: string) => {
    if (typeof productId !== "number" || productId <= 0) {
      toast.error("Yeniden adlandırma için önce Taslak Kaydet (ID oluşmalı).");
      return;
    }

    const newLabel = (renameDraftByRow[index] ?? "").trim();
    if (!newLabel) {
      toast.error("Yeni etiket zorunludur.");
      return;
    }

    setRowLoading(index, true);

    try {
      const response = await fetch("/api/admin/images/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          fromPath: fromPath.trim(),
          newLabel,
          productSlug: values.slug || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean;
        path?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || typeof payload.path !== "string") {
        throw new Error(payload.error || "Yeniden adlandırma başarısız oldu");
      }

      onUpdateImage(index, payload.path);
      clearRenameState(index);
      setBrokenPreview(index, false);
      toast.success("Görsel yeniden adlandırıldı");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Yeniden adlandırma başarısız oldu";
      toast.error(message);
    } finally {
      setRowLoading(index, false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Görseller (URL)</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddImage}
          disabled={isPending}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Ekle
        </Button>
      </div>

      <div className="space-y-2">
        {values.imageUrls.map((imageUrl, index) => (
          <div key={`image-${index}`} className="rounded-lg border border-border p-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {(() => {
                  const trimmed = imageUrl.trim();
                  const canPreview = isRemoteUrl(trimmed) || isUploadPath(trimmed) || isLegacyProductPath(trimmed);

                  if (!canPreview || brokenPreviewByRow[index]) {
                    return (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                        Önizleme yok
                      </div>
                    );
                  }

                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={trimmed}
                      alt={`Görsel ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenPreview(index, true)}
                    />
                  );
                })()}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={imageUrl}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    onUpdateImage(index, nextValue);
                    setBrokenPreview(index, false);
                    if (!isUploadPath(nextValue.trim())) {
                      clearRenameState(index);
                    }
                  }}
                  placeholder="https://... veya /products/..."
                  disabled={isPending}
                  readOnly={isUploadPath(imageUrl.trim())}
                  className={cn(
                    isUploadPath(imageUrl.trim())
                      ? "bg-muted text-muted-foreground"
                      : ""
                  )}
                />

                {isUploadPath(imageUrl.trim()) ? (
                  <div className="space-y-2">
                    {!renameOpenByRow[index] ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={extractUploadLabelFromPath(imageUrl.trim(), values.slug)}
                          readOnly
                          disabled
                          className="max-w-xs bg-muted text-muted-foreground"
                          placeholder="Etiket"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openRenameInline(index, imageUrl)}
                          disabled={isPending || Boolean(loadingRows[index]) || isImportDisabledByProductId}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Yeniden adlandır
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => onRemoveImage(index)}
                          disabled={isPending || Boolean(loadingRows[index]) || values.imageUrls.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Görsel satırını sil</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={renameDraftByRow[index] ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setRenameDraftByRow((prev) => ({ ...prev, [index]: nextValue }));
                          }}
                          placeholder="Yeni etiket (örn: detay)"
                          disabled={isPending || Boolean(loadingRows[index])}
                          className="max-w-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRename(index, imageUrl)}
                          disabled={isPending || Boolean(loadingRows[index]) || !(renameDraftByRow[index] ?? "").trim()}
                          className="gap-2"
                        >
                          {loadingRows[index] ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Kaydediliyor...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Kaydet
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => clearRenameState(index)}
                          disabled={isPending || Boolean(loadingRows[index])}
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Vazgeç
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={labelsByRow[index] ?? defaultLabelForRow(index, imageUrl)}
                        onChange={(event) => setRowLabel(index, event.target.value)}
                        placeholder="Etiket (örn: yan-profil)"
                        disabled={isPending || Boolean(loadingRows[index])}
                        className="max-w-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleImport(index, imageUrl)}
                        disabled={
                          isPending
                          || Boolean(loadingRows[index])
                          || !imageUrl.trim()
                          || isImportDisabledByProductId
                          || !isRemoteUrl(imageUrl.trim())
                        }
                      >
                        {loadingRows[index] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Aktarılıyor...
                          </>
                        ) : (
                          "İçe aktar"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => onRemoveImage(index)}
                        disabled={isPending || Boolean(loadingRows[index]) || values.imageUrls.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Görsel satırını sil</span>
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {LABEL_PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRowLabel(index, preset)}
                          disabled={isPending || Boolean(loadingRows[index])}
                          className="h-7 px-2 text-xs"
                        >
                          {preset}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isImportDisabledByProductId ? (
        <p className="text-xs text-muted-foreground">
          İçe aktar için önce Taslak Kaydet (ID oluşmalı).
        </p>
      ) : null}

      {fieldErrors.imageUrls ? (
        <p className="text-xs text-destructive">{fieldErrors.imageUrls}</p>
      ) : null}
    </div>
  );
}
