"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAdminProductAction,
  updateAdminProductAction,
} from "@/actions/admin";
import { parseMoneyToCents } from "@/lib/admin/product-money";
import { Button } from "@/components/ui/button";
import { CrossSellPicker } from "@/components/admin/cross-sell-picker";
import { StepBasics } from "@/components/admin/products/wizard/StepBasics";
import { StepPricingStock } from "@/components/admin/products/wizard/StepPricingStock";
import { StepSeo } from "@/components/admin/products/wizard/StepSeo";
import { StepDescription } from "@/components/admin/products/wizard/StepDescription";
import { StepImages } from "@/components/admin/products/wizard/StepImages";
import { StepPreview } from "@/components/admin/products/wizard/StepPreview";
import { WizardShell } from "@/components/admin/products/wizard/WizardShell";
import type {
  AdminProductEditPayload,
  AdminProductFieldErrors,
  AdminProductFormCategory,
  AdminProductStatus,
} from "@/lib/admin/products";
import type { ProductFormValues } from "@/components/admin/products/wizard/types";

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: number;
  categories: AdminProductFormCategory[];
  initialValues?: AdminProductEditPayload;
}

const WIZARD_STEPS = [
  "Temel Bilgiler",
  "Fiyat & Stok",
  "SEO",
  "Açıklama",
  "Görseller",
  "Önizleme",
] as const;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const fieldStepMap: Partial<Record<keyof AdminProductFieldErrors, number>> = {
  name: 0,
  slug: 0,
  status: 0,
  categoryIds: 0,
  price: 1,
  compareAtPrice: 1,
  stockStatus: 1,
  stockQuantity: 1,
  seoTitle: 2,
  seoDescription: 2,
  shortDescription: 3,
  descriptionLong: 3,
  imageUrls: 4,
};

function slugifyName(name: string): string {
  const map: Record<string, string> = {
    "ı": "i",
    "İ": "i",
    "ş": "s",
    "Ş": "s",
    "ğ": "g",
    "Ğ": "g",
    "ü": "u",
    "Ü": "u",
    "ö": "o",
    "Ö": "o",
    "ç": "c",
    "Ç": "c",
  };

  const replaced = name
    .split("")
    .map((char) => map[char] ?? char)
    .join("");

  return replaced
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isAllCapsTR(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed === trimmed.toLocaleUpperCase("tr-TR")
    && trimmed !== trimmed.toLocaleLowerCase("tr-TR");
}

function normalizeSeoTitleFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  if (!isAllCapsTR(trimmed)) {
    return trimmed;
  }

  return trimmed
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .map((token) => {
      if (!token) return token;
      const first = token[0]?.toLocaleUpperCase("tr-TR") ?? "";
      const rest = token.slice(1);
      return `${first}${rest}`;
    })
    .join(" ");
}

function getInitialValues(initialValues?: AdminProductEditPayload): ProductFormValues {
  if (!initialValues) {
    return {
      name: "",
      slug: "",
      status: "draft",
      price: "",
      compareAtPrice: "",
      stockStatus: "instock",
      stockQuantity: "",
      shortDescription: "",
      descriptionLong: "",
      categoryIds: [],
      imageUrls: [""],
      seoTitle: "",
      seoDescription: "",
    };
  }

  return {
    name: initialValues.name,
    slug: initialValues.slug,
    status: initialValues.status,
    price: initialValues.price,
    compareAtPrice: initialValues.compareAtPrice,
    stockStatus: initialValues.stockStatus,
    stockQuantity: initialValues.stockQuantity,
    shortDescription: initialValues.shortDescription,
    descriptionLong: initialValues.descriptionLong,
    categoryIds: initialValues.categoryIds,
    imageUrls: initialValues.imageUrls.length > 0 ? initialValues.imageUrls : [""],
    seoTitle: initialValues.seoTitle.trim()
      ? initialValues.seoTitle
      : normalizeSeoTitleFromName(initialValues.name),
    seoDescription: initialValues.seoDescription,
  };
}

function getFirstErrorStep(fieldErrors: AdminProductFieldErrors): number | null {
  for (const key of Object.keys(fieldErrors) as Array<keyof AdminProductFieldErrors>) {
    if (!fieldErrors[key]) continue;
    const step = fieldStepMap[key];
    if (typeof step === "number") {
      return step;
    }
  }

  return null;
}

type ValidationMode = "navigation" | "draft" | "publish";

export function ProductForm({
  mode,
  productId,
  categories,
  initialValues,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<ProductFormValues>(() => getInitialValues(initialValues));
  const [slugDirty, setSlugDirty] = useState(mode === "edit");
  const [seoTitleTouched, setSeoTitleTouched] = useState(
    Boolean(initialValues?.seoTitle?.trim())
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AdminProductFieldErrors>({});
  const categoryInputPrefix = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

  function updateField<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (key in next) {
        delete next[key as keyof AdminProductFieldErrors];
      }
      return next;
    });
    setFormError(null);
  }

  function toggleCategory(categoryId: number, checked: boolean) {
    updateField(
      "categoryIds",
      checked
        ? [...values.categoryIds, categoryId]
        : values.categoryIds.filter((id) => id !== categoryId)
    );
  }

  function updateImage(index: number, value: string) {
    const next = [...values.imageUrls];
    next[index] = value;
    updateField("imageUrls", next);
  }

  function addImageInput() {
    updateField("imageUrls", [...values.imageUrls, ""]);
  }

  function removeImageInput(index: number) {
    const next = values.imageUrls.filter((_, imageIndex) => imageIndex !== index);
    updateField("imageUrls", next.length > 0 ? next : [""]);
  }

  function handleNameChange(nextName: string) {
    updateField("name", nextName);

    if (!slugDirty) {
      updateField("slug", slugifyName(nextName));
    }

    if (!seoTitleTouched) {
      updateField("seoTitle", normalizeSeoTitleFromName(nextName));
    }
  }

  function handleSlugChange(nextSlug: string) {
    setSlugDirty(true);
    updateField("slug", nextSlug);
  }

  function handleGenerateSlug() {
    setSlugDirty(true);
    updateField("slug", slugifyName(values.name));
  }

  function handleSeoTitleChange(nextSeoTitle: string) {
    setSeoTitleTouched(true);
    updateField("seoTitle", nextSeoTitle);
  }

  function handleResetSeoTitleFromName() {
    setSeoTitleTouched(false);
    updateField("seoTitle", normalizeSeoTitleFromName(values.name));
  }

  function validateStep(stepIndex: number, mode: ValidationMode): boolean {
    const nextErrors: AdminProductFieldErrors = {};

    if (stepIndex === 0) {
      if (!values.name.trim()) {
        nextErrors.name = "Ürün adı zorunludur";
      }

      const slug = values.slug.trim().toLowerCase();
      if (!slug) {
        nextErrors.slug = "Slug zorunludur";
      } else if (!slugRegex.test(slug)) {
        nextErrors.slug = "Slug yalnızca küçük harf, sayı ve tire içerebilir";
      }
    }

    if (stepIndex === 1) {
      const rawPrice = values.price.trim();
      const requiresPrice = mode !== "draft";

      if (!rawPrice && requiresPrice) {
        nextErrors.price = "Fiyat zorunludur";
      }

      if (rawPrice) {
        const priceCents = parseMoneyToCents(rawPrice, true);
        if (!Number.isFinite(priceCents)) {
          nextErrors.price = "Fiyat geçersiz. Örn: 74.900,00 veya 74900";
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      return false;
    }

    return true;
  }

  function getFirstInvalidStep(steps: number[], mode: ValidationMode): number | null {
    for (const stepIndex of steps) {
      if (!validateStep(stepIndex, mode)) {
        return stepIndex;
      }
    }
    return null;
  }

  function goToFirstInvalidStep(stepIndex: number, message: string) {
    setCurrentStep(stepIndex);
    setFormError(message);
    toast.error(message);
  }

  function canMoveNext(): boolean {
    return currentStep < WIZARD_STEPS.length - 1;
  }

  function handleStepClick(stepIndex: number) {
    if (stepIndex <= currentStep) {
      setFormError(null);
      setCurrentStep(stepIndex);
      return;
    }

    const candidateSteps: number[] = [];
    for (let i = 0; i <= stepIndex; i += 1) {
      if (i === 0 || i === 1) {
        candidateSteps.push(i);
      }
    }

    const invalidStep = getFirstInvalidStep(candidateSteps, "navigation");
    if (invalidStep !== null) {
      goToFirstInvalidStep(
        invalidStep,
        "İleri adıma geçmek için zorunlu alanları doldurun."
      );
      return;
    }

    setFormError(null);
    setCurrentStep(stepIndex);
  }

  function goNext() {
    if (!canMoveNext()) return;
    handleStepClick(currentStep + 1);
  }

  function goBack() {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  function buildPayload(statusOverride?: AdminProductStatus) {
    return {
      name: values.name,
      slug: values.slug,
      status: statusOverride ?? values.status,
      price: values.price,
      compareAtPrice: values.compareAtPrice,
      stockStatus: values.stockStatus,
      stockQuantity: values.stockQuantity,
      shortDescription: values.shortDescription,
      descriptionLong: values.descriptionLong,
      categoryIds: values.categoryIds,
      imageUrls: values.imageUrls,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    };
  }

  function validateBeforeSubmit(nextStatus: AdminProductStatus): boolean {
    const requiredSteps = nextStatus === "publish" ? [0, 1] : [0];
    const validationMode: ValidationMode = nextStatus === "publish" ? "publish" : "draft";
    const invalidStep = getFirstInvalidStep(requiredSteps, validationMode);

    if (invalidStep !== null) {
      goToFirstInvalidStep(
        invalidStep,
        nextStatus === "publish"
          ? "Yayınlamak için zorunlu alanları tamamlayın."
          : "Taslak kaydetmek için ürün adı ve slug zorunludur."
      );
      return false;
    }

    return true;
  }

  function submitWithStatus(statusOverride?: AdminProductStatus) {
    const nextStatus = statusOverride ?? values.status;

    if (!validateBeforeSubmit(nextStatus)) {
      return;
    }

    setFormError(null);
    setFieldErrors({});

    const payload = buildPayload(statusOverride);

    startTransition(async () => {
      const result = mode === "create"
        ? await createAdminProductAction(payload)
        : await updateAdminProductAction(productId ?? 0, payload);

      if (!result.success) {
        setFormError(result.error ?? "Kaydetme sırasında bir hata oluştu");
        const nextFieldErrors = result.fieldErrors ?? {};
        setFieldErrors(nextFieldErrors);

        const errorStep = getFirstErrorStep(nextFieldErrors);
        if (errorStep !== null) {
          setCurrentStep(errorStep);
        }

        const resolvedSlug = result.resolvedSlug;
        if (resolvedSlug && resolvedSlug !== values.slug) {
          setValues((prev) => ({ ...prev, slug: resolvedSlug }));
        }

        return;
      }

      toast.success(mode === "create" ? "Ürün oluşturuldu" : "Ürün güncellendi");
      router.push("/admin/products");
      router.refresh();
    });
  }

  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div ref={rootRef} className="space-y-6">
      {formError ? (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <WizardShell
        steps={[...WIZARD_STEPS]}
        currentStep={currentStep}
        onStepClick={handleStepClick}
        footer={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" asChild disabled={isPending}>
                <Link href="/admin/products">Vazgeç</Link>
              </Button>

              {mode === "edit" && productId ? (
                <CrossSellPicker
                  productId={productId}
                  productSlug={values.slug}
                  initialSelectedIds={initialValues?.crossSellIds}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {mode === "create" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submitWithStatus("draft")}
                  disabled={isPending}
                >
                  {isPending ? "Kaydediliyor..." : "Taslak Kaydet"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submitWithStatus()}
                  disabled={isPending}
                >
                  {isPending ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </Button>
              )}

              <Button
                type="button"
                onClick={() => submitWithStatus("publish")}
                disabled={isPending}
              >
                {isPending ? "Kaydediliyor..." : "Yayınla"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={isPending || currentStep === 0}
              >
                Geri
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={goNext}
                disabled={isPending || isLastStep}
              >
                İleri
              </Button>
            </div>
          </div>
        )}
      >
        {currentStep === 0 ? (
          <StepBasics
            values={values}
            isPending={isPending}
            fieldErrors={fieldErrors}
            updateField={updateField}
            categories={categories}
            categoryInputPrefix={categoryInputPrefix}
            slugDirty={slugDirty}
            onNameChange={handleNameChange}
            onSlugChange={handleSlugChange}
            onGenerateSlug={handleGenerateSlug}
            onToggleCategory={toggleCategory}
          />
        ) : null}

        {currentStep === 1 ? (
          <StepPricingStock
            values={values}
            isPending={isPending}
            fieldErrors={fieldErrors}
            updateField={updateField}
          />
        ) : null}

        {currentStep === 2 ? (
          <StepSeo
            values={values}
            isPending={isPending}
            fieldErrors={fieldErrors}
            updateField={updateField}
            seoTitleTouched={seoTitleTouched}
            onSeoTitleChange={handleSeoTitleChange}
            onResetSeoTitleFromName={handleResetSeoTitleFromName}
          />
        ) : null}

        {currentStep === 3 ? (
          <StepDescription
            values={values}
            isPending={isPending}
            fieldErrors={fieldErrors}
            updateField={updateField}
          />
        ) : null}

        {currentStep === 4 ? (
          <StepImages
            productId={productId}
            values={values}
            isPending={isPending}
            fieldErrors={fieldErrors}
            updateField={updateField}
            onAddImage={addImageInput}
            onRemoveImage={removeImageInput}
            onUpdateImage={updateImage}
          />
        ) : null}

        {currentStep === 5 ? (
          <StepPreview values={values} categories={categories} />
        ) : null}
      </WizardShell>
    </div>
  );
}
