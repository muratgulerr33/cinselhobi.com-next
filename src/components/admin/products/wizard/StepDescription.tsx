"use client";

import type { ProductFormStepSharedProps } from "./types";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export function StepDescription({ values, isPending, fieldErrors, updateField }: ProductFormStepSharedProps) {
  return (
    <div className="space-y-3">
      <label htmlFor="product-description-long" className="block text-sm font-medium">
        Ürün Açıklaması
      </label>
      <RichTextEditor
        value={values.descriptionLong}
        onChange={(html) => updateField("descriptionLong", html)}
        disabled={isPending}
      />
      {fieldErrors.descriptionLong ? (
        <p className="text-xs text-destructive">{fieldErrors.descriptionLong}</p>
      ) : null}
    </div>
  );
}
