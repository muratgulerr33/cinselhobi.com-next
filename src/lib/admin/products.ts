import { db } from "@/db/connection";
import { categories, productCategories, products } from "@/db/schema";
import {
  computeBulkPricePreview,
  parseBulkPriceOperation,
  type BulkPriceOperationInput,
} from "@/lib/admin/bulk-price";
import { formatCentsForInput, parseMoneyToCents } from "@/lib/admin/product-money";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  ilike,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

export const PRODUCT_STATUS_VALUES = ["draft", "publish"] as const;
export type AdminProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];

export const PRODUCT_STOCK_STATUS_VALUES = ["instock", "outofstock"] as const;
export type AdminProductStockStatus = (typeof PRODUCT_STOCK_STATUS_VALUES)[number];

const productSlugSchema = z
  .preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z
      .string()
      .min(1, "Slug zorunludur")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug yalnızca küçük harf, sayı ve tire içerebilir"
      )
  );

const productInputSchema = z.object({
  name: z.string().trim().min(1, "Ürün adı zorunludur"),
  slug: productSlugSchema,
  status: z.enum(PRODUCT_STATUS_VALUES).default("draft"),
  price: z.string().trim().optional().default(""),
  compareAtPrice: z.string().trim().optional().default(""),
  stockStatus: z.enum(PRODUCT_STOCK_STATUS_VALUES).default("instock"),
  stockQuantity: z.string().trim().optional().default(""),
  shortDescription: z.string().trim().max(10000, "Kısa açıklama çok uzun").optional().default(""),
  descriptionLong: z.string().trim().max(50000, "Uzun açıklama çok uzun").optional().default(""),
  seoTitle: z.string().trim().max(70, "SEO başlığı en fazla 70 karakter olabilir").optional().default(""),
  seoDescription: z.string().trim().max(180, "SEO açıklaması en fazla 180 karakter olabilir").optional().default(""),
  categoryIds: z.array(z.number().int().positive()).optional().default([]),
  imageUrls: z.array(z.string()).optional().default([]),
});

export interface AdminProductFormInput {
  name: string;
  slug: string;
  status: AdminProductStatus;
  price?: string;
  compareAtPrice?: string;
  stockStatus: AdminProductStockStatus;
  stockQuantity?: string;
  shortDescription?: string;
  descriptionLong?: string;
  seoTitle?: string;
  seoDescription?: string;
  categoryIds?: number[];
  imageUrls?: string[];
}

export interface AdminProductFieldErrors {
  name?: string;
  slug?: string;
  status?: string;
  price?: string;
  compareAtPrice?: string;
  stockStatus?: string;
  stockQuantity?: string;
  seoTitle?: string;
  seoDescription?: string;
  shortDescription?: string;
  descriptionLong?: string;
  categoryIds?: string;
  imageUrls?: string;
}

interface NormalizedProductInput {
  name: string;
  slug: string;
  status: AdminProductStatus;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  stockStatus: AdminProductStockStatus;
  stockQuantity: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  shortDescription: string | null;
  descriptionLong: string | null;
  categoryIds: number[];
  images: Array<{ src: string; alt: null }>;
}

export interface AdminProductFormCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminProductEditPayload {
  id: number;
  name: string;
  slug: string;
  status: AdminProductStatus;
  price: string;
  compareAtPrice: string;
  stockStatus: AdminProductStockStatus;
  stockQuantity: string;
  seoTitle: string;
  seoDescription: string;
  crossSellIds: number[] | null;
  shortDescription: string;
  descriptionLong: string;
  categoryIds: number[];
  imageUrls: string[];
}

export interface AdminProductMutationResult {
  ok: boolean;
  productId?: number;
  slug?: string;
  resolvedSlug?: string;
  formError?: string;
  fieldErrors?: AdminProductFieldErrors;
}

function parseStockQuantity(rawValue: string): number | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number.parseInt(value, 10);
}

function normalizeCategoryIds(ids: number[]): number[] {
  const normalized: number[] = [];
  const seen = new Set<number>();

  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

function normalizeImageUrls(urls: string[]): Array<{ src: string; alt: null }> {
  const normalized: Array<{ src: string; alt: null }> = [];

  for (const url of urls) {
    const src = String(url ?? "").trim();
    if (!src) continue;
    normalized.push({ src, alt: null });
  }

  return normalized;
}

function imageUrlsFromDb(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null && "src" in item) {
        const src = (item as { src?: unknown }).src;
        return typeof src === "string" ? src.trim() : "";
      }
      return "";
    })
    .filter((src) => src.length > 0);
}

async function getValidCategoryIds(ids: number[]): Promise<number[]> {
  const normalized = normalizeCategoryIds(ids);
  if (normalized.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.id, normalized));

  const validSet = new Set(rows.map((row) => row.id));
  return normalized.filter((id) => validSet.has(id));
}

async function getNextManualWcId(
  tx: Pick<typeof db, "select">
): Promise<number> {
  const [row] = await tx
    .select({ minWcId: sql<number | null>`min(${products.wcId})` })
    .from(products)
    .where(sql`${products.wcId} < 0`);

  if (typeof row?.minWcId === "number" && row.minWcId < 0) {
    return row.minWcId - 1;
  }

  return -1;
}

async function resolveCreateSlug(baseSlug: string): Promise<string> {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(
      or(
        eq(products.slug, baseSlug),
        like(products.slug, `${baseSlug}-%`)
      )
    );

  const existing = new Set(rows.map((row) => row.slug));
  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function hasSlugConflict(slug: string, productId: number): Promise<boolean> {
  const [conflict] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.slug, slug), ne(products.id, productId)))
    .limit(1);

  return Boolean(conflict);
}

function normalizeProductInput(
  input: AdminProductFormInput
): { data?: NormalizedProductInput; fieldErrors?: AdminProductFieldErrors } {
  const parsed = productInputSchema.safeParse({
    ...input,
    categoryIds: normalizeCategoryIds(input.categoryIds ?? []),
    imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls : [],
  });

  if (!parsed.success) {
    const fieldErrors: AdminProductFieldErrors = {};
    const flattened = parsed.error.flatten().fieldErrors;

    for (const key of Object.keys(flattened) as Array<keyof typeof flattened>) {
      const message = flattened[key]?.[0];
      if (!message) continue;
      fieldErrors[key as keyof AdminProductFieldErrors] = message;
    }

    return { fieldErrors };
  }

  const rawPrice = parsed.data.price.trim();
  const priceCents = rawPrice ? parseMoneyToCents(rawPrice, true) : null;
  if (rawPrice && !Number.isFinite(priceCents)) {
    return {
      fieldErrors: {
        price: "Fiyat geçersiz. Örn: 74.900,00 veya 74900",
      },
    };
  }

  if (parsed.data.status === "publish" && priceCents === null) {
    return {
      fieldErrors: {
        price: "Yayınlamak için fiyat zorunludur",
      },
    };
  }

  const compareAtPriceCents = parseMoneyToCents(parsed.data.compareAtPrice, false);
  if (!Number.isFinite(compareAtPriceCents ?? 0) && compareAtPriceCents !== null) {
    return {
      fieldErrors: {
        compareAtPrice: "Karşılaştırma fiyatı geçersiz",
      },
    };
  }

  const stockQuantity = parseStockQuantity(parsed.data.stockQuantity);
  if (!Number.isFinite(stockQuantity ?? 0) && stockQuantity !== null) {
    return {
      fieldErrors: {
        stockQuantity: "Stok adedi tam sayı olmalıdır",
      },
    };
  }

  return {
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      priceCents,
      compareAtPriceCents,
      stockStatus: parsed.data.stockStatus,
      stockQuantity,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      shortDescription: parsed.data.shortDescription || null,
      descriptionLong: parsed.data.descriptionLong || null,
      categoryIds: parsed.data.categoryIds,
      images: normalizeImageUrls(parsed.data.imageUrls),
    },
  };
}

export async function getAdminProductFormCategories(): Promise<AdminProductFormCategory[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .orderBy(asc(categories.name));
}

export async function getAdminProductForEdit(
  productId: number
): Promise<AdminProductEditPayload | null> {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      status: products.status,
      price: products.price,
      regularPrice: products.regularPrice,
      stockStatus: products.stockStatus,
      stockQuantity: products.stockQuantity,
      seoTitle: products.seoTitle,
      seoDescription: products.seoDescription,
      shortDescription: products.shortDescription,
      description: products.description,
      crossSellIds: products.crossSellIds,
      images: products.images,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    return null;
  }

  const categoryRows = await db
    .select({ categoryId: productCategories.categoryId })
    .from(productCategories)
    .where(eq(productCategories.productId, productId));

  const categoryIds = categoryRows.map((row) => row.categoryId);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status === "publish" ? "publish" : "draft",
    price: formatCentsForInput(product.price),
    compareAtPrice: formatCentsForInput(product.regularPrice),
    stockStatus: product.stockStatus === "outofstock" ? "outofstock" : "instock",
    stockQuantity: typeof product.stockQuantity === "number" ? String(product.stockQuantity) : "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    crossSellIds: Array.isArray(product.crossSellIds)
      ? product.crossSellIds.filter((id): id is number => Number.isInteger(id) && id > 0)
      : null,
    shortDescription: product.shortDescription ?? "",
    descriptionLong: product.description ?? "",
    categoryIds,
    imageUrls: imageUrlsFromDb(product.images),
  };
}

export async function createAdminProduct(
  input: AdminProductFormInput
): Promise<AdminProductMutationResult> {
  const normalized = normalizeProductInput(input);
  const data = normalized.data;
  if (!data) {
    return {
      ok: false,
      fieldErrors: normalized.fieldErrors,
    };
  }

  const resolvedSlug = await resolveCreateSlug(data.slug);
  const categoryIds = await getValidCategoryIds(data.categoryIds);

  try {
    const result = await db.transaction(async (tx) => {
      const nextManualWcId = await getNextManualWcId(tx);

      const [inserted] = await tx
        .insert(products)
        .values({
          wcId: nextManualWcId,
          slug: resolvedSlug,
          name: data.name,
          status: data.status,
          type: "simple",
          sku: null,
          price: data.priceCents,
          regularPrice: data.compareAtPriceCents,
          salePrice: null,
          currency: "TRY",
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          shortDescription: data.shortDescription,
          description: data.descriptionLong,
          stockStatus: data.stockStatus,
          stockQuantity: data.stockQuantity,
          images: data.images,
          raw: {
            source: "admin-v1",
            status: data.status,
            name: data.name,
            slug: resolvedSlug,
            price: data.priceCents,
            regular_price: data.compareAtPriceCents,
            seo_title: data.seoTitle,
            seo_description: data.seoDescription,
            stock_status: data.stockStatus,
            stock_quantity: data.stockQuantity,
            short_description: data.shortDescription,
            description: data.descriptionLong,
            images: data.images,
          },
        })
        .returning({ id: products.id });

      if (!inserted) {
        throw new Error("insert_failed");
      }

      if (categoryIds.length > 0) {
        await tx
          .insert(productCategories)
          .values(
            categoryIds.map((categoryId) => ({
              productId: inserted.id,
              categoryId,
            }))
          )
          .onConflictDoNothing();
      }

      return inserted;
    });

    return {
      ok: true,
      productId: result.id,
      slug: result.id ? resolvedSlug : undefined,
      resolvedSlug,
    };
  } catch (error) {
    console.error("createAdminProduct error:", error);

    return {
      ok: false,
      formError: "Ürün oluşturulurken bir hata oluştu",
    };
  }
}

export async function updateAdminProduct(
  productId: number,
  input: AdminProductFormInput
): Promise<AdminProductMutationResult> {
  if (!Number.isInteger(productId) || productId <= 0) {
    return {
      ok: false,
      formError: "Geçersiz ürün kimliği",
    };
  }

  const normalized = normalizeProductInput(input);
  const data = normalized.data;
  if (!data) {
    return {
      ok: false,
      fieldErrors: normalized.fieldErrors,
    };
  }

  const [existingProduct] = await db
    .select({
      id: products.id,
      slug: products.slug,
      raw: products.raw,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!existingProduct) {
    return {
      ok: false,
      formError: "Ürün bulunamadı",
    };
  }

  const slugConflict = await hasSlugConflict(data.slug, productId);
  if (slugConflict) {
    return {
      ok: false,
      fieldErrors: {
        slug: "Bu slug başka bir ürün tarafından kullanılıyor",
      },
    };
  }

  const categoryIds = await getValidCategoryIds(data.categoryIds);

  try {
    await db.transaction(async (tx) => {
      const previousRaw =
        typeof existingProduct.raw === "object" && existingProduct.raw !== null
          ? (existingProduct.raw as Record<string, unknown>)
          : {};

      await tx
        .update(products)
        .set({
          slug: data.slug,
          name: data.name,
          status: data.status,
          price: data.priceCents,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          shortDescription: data.shortDescription,
          description: data.descriptionLong,
          stockStatus: data.stockStatus,
          stockQuantity: data.stockQuantity,
          images: data.images,
          raw: {
            ...previousRaw,
            source: "admin-v1",
            status: data.status,
            name: data.name,
            slug: data.slug,
            price: data.priceCents,
            seo_title: data.seoTitle,
            seo_description: data.seoDescription,
            stock_status: data.stockStatus,
            stock_quantity: data.stockQuantity,
            short_description: data.shortDescription,
            description: data.descriptionLong,
            images: data.images,
          },
          updatedAt: sql`now()`,
        })
        .where(eq(products.id, productId));

      await tx
        .delete(productCategories)
        .where(eq(productCategories.productId, productId));

      if (categoryIds.length > 0) {
        await tx
          .insert(productCategories)
          .values(
            categoryIds.map((categoryId) => ({
              productId,
              categoryId,
            }))
          )
          .onConflictDoNothing();
      }
    });

    return {
      ok: true,
      productId,
      slug: data.slug,
      resolvedSlug: data.slug,
    };
  } catch (error) {
    console.error("updateAdminProduct error:", error);

    return {
      ok: false,
      formError: "Ürün güncellenirken bir hata oluştu",
    };
  }
}

export const ADMIN_BULK_PRODUCT_LIMIT_OPTIONS = [50, 100, 200] as const;
export type AdminBulkProductLimit = (typeof ADMIN_BULK_PRODUCT_LIMIT_OPTIONS)[number];
export type AdminBulkProductStockFilter = "all" | AdminProductStockStatus;
export const DEFAULT_ADMIN_BULK_PRODUCT_LIMIT: AdminBulkProductLimit = 100;

const ADMIN_BULK_PRODUCT_LIMIT_SET = new Set<number>(ADMIN_BULK_PRODUCT_LIMIT_OPTIONS);

function normalizeBulkProductLimit(limit: number | undefined): AdminBulkProductLimit {
  if (typeof limit === "number" && ADMIN_BULK_PRODUCT_LIMIT_SET.has(limit)) {
    return limit as AdminBulkProductLimit;
  }
  return DEFAULT_ADMIN_BULK_PRODUCT_LIMIT;
}

function normalizeBulkIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

export interface AdminBulkProductListItem {
  id: number;
  name: string;
  slug: string;
  price: number | null;
  compareAtPrice: number | null;
  stockStatus: string | null;
  stockQuantity: number | null;
  updatedAt: Date;
}

export interface ListAdminProductsForBulkOptions {
  query?: string;
  stockStatus?: AdminBulkProductStockFilter;
  limit?: number;
}

export async function listAdminProductsForBulk(
  options: ListAdminProductsForBulkOptions = {}
): Promise<AdminBulkProductListItem[]> {
  const query = (options.query ?? "").trim();
  const stockStatus = options.stockStatus ?? "all";
  const limit = normalizeBulkProductLimit(options.limit);
  const whereParts: SQL[] = [];

  if (query) {
    const likePattern = `%${query}%`;
    const nameOrSlug = or(ilike(products.name, likePattern), ilike(products.slug, likePattern));
    if (nameOrSlug) {
      whereParts.push(nameOrSlug);
    }
  }

  if (stockStatus === "instock") whereParts.push(eq(products.stockStatus, "instock"));
  if (stockStatus === "outofstock") whereParts.push(eq(products.stockStatus, "outofstock"));

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;

  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      compareAtPrice: products.regularPrice,
      stockStatus: products.stockStatus,
      stockQuantity: products.stockQuantity,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(where)
    .orderBy(desc(products.updatedAt), desc(products.id))
    .limit(limit);
}

interface AdminBulkProductForUpdate {
  id: number;
  price: number | null;
  compareAtPrice: number | null;
  stockStatus: string | null;
  stockQuantity: number | null;
  raw: unknown;
}

interface AdminBulkProductResolvedUpdate {
  id: number;
  nextPrice: number;
  currentStockStatus: string | null;
  nextStockStatus: string | null;
  currentStockQuantity: number | null;
  nextStockQuantity: number | null;
  raw: unknown;
}

export interface AdminBulkUpdateFailure {
  id: number;
  reason: string;
}

export interface BulkUpdatePricesResult {
  updatedCount: number;
  skippedCount: number;
  failures: AdminBulkUpdateFailure[];
  error?: string;
}

export interface BulkUpdatePricesInput {
  ids: number[];
  operation: BulkPriceOperationInput;
}

async function updateSingleBulkProduct(
  executor: Pick<typeof db, "update">,
  item: AdminBulkProductResolvedUpdate
): Promise<boolean> {
  const previousRaw =
    typeof item.raw === "object" && item.raw !== null
      ? (item.raw as Record<string, unknown>)
      : {};

  const updatePayload: {
    price: number;
    raw: Record<string, unknown>;
    updatedAt: ReturnType<typeof sql>;
    stockStatus?: string | null;
    stockQuantity?: number | null;
  } = {
    price: item.nextPrice,
    raw: {
      ...previousRaw,
      source: "admin-bulk-v1",
      price: item.nextPrice,
      stock_status: item.nextStockStatus,
      stock_quantity: item.nextStockQuantity,
    },
    updatedAt: sql`now()`,
  };

  if (item.nextStockStatus !== item.currentStockStatus) {
    updatePayload.stockStatus = item.nextStockStatus;
  }
  if (item.nextStockQuantity !== item.currentStockQuantity) {
    updatePayload.stockQuantity = item.nextStockQuantity;
  }

  const [updatedRow] = await executor
    .update(products)
    .set(updatePayload)
    .where(eq(products.id, item.id))
    .returning({ id: products.id });

  return Boolean(updatedRow);
}

export async function bulkUpdatePrices(
  input: BulkUpdatePricesInput
): Promise<BulkUpdatePricesResult> {
  const normalizedIds = normalizeBulkIds(input.ids);
  if (normalizedIds.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failures: [],
      error: "Güncellenecek ürün seçilmedi",
    };
  }

  const parsedOperation = parseBulkPriceOperation(input.operation);
  if (!parsedOperation.ok) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failures: [],
      error: parsedOperation.error,
    };
  }

  const selectedProducts = await db
    .select({
      id: products.id,
      price: products.price,
      compareAtPrice: products.regularPrice,
      stockStatus: products.stockStatus,
      stockQuantity: products.stockQuantity,
      raw: products.raw,
    })
    .from(products)
    .where(inArray(products.id, normalizedIds));

  const byId = new Map<number, AdminBulkProductForUpdate>();
  for (const product of selectedProducts) {
    byId.set(product.id, product);
  }

  const failures: AdminBulkUpdateFailure[] = [];
  const updates: AdminBulkProductResolvedUpdate[] = [];
  let skippedCount = 0;

  for (const id of normalizedIds) {
    const product = byId.get(id);
    if (!product) {
      failures.push({ id, reason: "Ürün bulunamadı" });
      continue;
    }

    const preview = computeBulkPricePreview(
      product.price,
      product.compareAtPrice,
      parsedOperation.operation
    );

    const nextStockStatus = parsedOperation.operation.stockStatus === "keep"
      ? product.stockStatus
      : parsedOperation.operation.stockStatus;
    const nextStockQuantity = parsedOperation.operation.stockQuantity === undefined
      ? product.stockQuantity
      : parsedOperation.operation.stockQuantity;

    const hasPriceChange = product.price !== preview.newPrice;
    const hasStockStatusChange = nextStockStatus !== product.stockStatus;
    const hasStockQuantityChange = nextStockQuantity !== product.stockQuantity;

    if (!hasPriceChange && !hasStockStatusChange && !hasStockQuantityChange) {
      skippedCount += 1;
      continue;
    }

    updates.push({
      id: product.id,
      nextPrice: preview.newPrice,
      currentStockStatus: product.stockStatus,
      nextStockStatus,
      currentStockQuantity: product.stockQuantity,
      nextStockQuantity,
      raw: product.raw,
    });
  }

  if (updates.length === 0) {
    return {
      updatedCount: 0,
      skippedCount,
      failures,
      error: failures.length > 0 ? "Hiçbir ürün güncellenemedi" : "Güncellenecek değişiklik bulunamadı",
    };
  }

  try {
    await db.transaction(async (tx) => {
      for (const item of updates) {
        const updated = await updateSingleBulkProduct(tx, item);
        if (!updated) {
          throw new Error(`bulk_update_missing_${item.id}`);
        }
      }
    });

    return {
      updatedCount: updates.length,
      skippedCount,
      failures,
    };
  } catch (error) {
    console.error("bulkUpdatePrices transaction failed, falling back to best effort:", error);
  }

  let updatedCount = 0;

  for (const item of updates) {
    try {
      const updated = await updateSingleBulkProduct(db, item);
      if (!updated) {
        failures.push({
          id: item.id,
          reason: "Ürün güncellenemedi",
        });
        continue;
      }
      updatedCount += 1;
    } catch (error) {
      console.error("bulkUpdatePrices item update failed:", error);
      failures.push({
        id: item.id,
        reason: "Veritabanı güncellemesi başarısız oldu",
      });
    }
  }

  return {
    updatedCount,
    skippedCount,
    failures,
    error: updatedCount === 0 ? "Hiçbir ürün güncellenemedi" : undefined,
  };
}
