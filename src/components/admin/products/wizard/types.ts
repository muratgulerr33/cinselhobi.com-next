import type {
  AdminProductFieldErrors,
  AdminProductFormCategory,
  AdminProductStatus,
  AdminProductStockStatus,
} from "@/lib/admin/products";

export interface ProductFormValues {
  name: string;
  slug: string;
  status: AdminProductStatus;
  price: string;
  compareAtPrice: string;
  stockStatus: AdminProductStockStatus;
  stockQuantity: string;
  shortDescription: string;
  descriptionLong: string;
  categoryIds: number[];
  imageUrls: string[];
  seoTitle: string;
  seoDescription: string;
}

export type ProductFormUpdateField = <K extends keyof ProductFormValues>(
  key: K,
  value: ProductFormValues[K]
) => void;

export interface ProductFormStepSharedProps {
  values: ProductFormValues;
  isPending: boolean;
  fieldErrors: AdminProductFieldErrors;
  updateField: ProductFormUpdateField;
}

export interface ProductBasicsStepProps extends ProductFormStepSharedProps {
  categories: AdminProductFormCategory[];
  categoryInputPrefix: string;
  slugDirty: boolean;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onGenerateSlug: () => void;
  onToggleCategory: (categoryId: number, checked: boolean) => void;
}

export interface ProductSeoStepProps extends ProductFormStepSharedProps {
  seoTitleTouched: boolean;
  onSeoTitleChange: (value: string) => void;
  onResetSeoTitleFromName: () => void;
}
