"use server";

import { auth } from "@/auth";
import { db } from "@/db/connection";
import { orders, products } from "@/db/schema";
import { getProductsByIdsPreserveOrder } from "@/db/queries/admin";
import { BULK_PRICE_OPERATION_MODES } from "@/lib/admin/bulk-price";
import {
  bulkUpdatePrices,
  createAdminProduct,
  updateAdminProduct,
  type AdminProductFieldErrors,
  type AdminProductFormInput,
} from "@/lib/admin/products";
import { ORDER_STATUS, type OrderStatus } from "@/lib/admin/order-status";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type { OrderStatus } from "@/lib/admin/order-status";

export interface UpdateOrderStatusResult {
  success: boolean;
  error?: string;
}

export interface UpdateProductCrossSellResult {
  success: boolean;
  error?: string;
  crossSellIds?: number[] | null;
}

export interface AdminProductActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: AdminProductFieldErrors;
  resolvedSlug?: string;
}

export interface BulkUpdateAdminProductsActionInput {
  ids: number[];
  operation: {
    mode: (typeof BULK_PRICE_OPERATION_MODES)[number];
    value: string;
    applyToCompareAtPrice?: boolean;
    keepCompareAtGtePrice?: boolean;
    stockStatus?: "keep" | "instock" | "outofstock";
    stockQuantity?: string;
  };
}

export interface BulkUpdateAdminProductsActionResult {
  success: boolean;
  error?: string;
  updatedCount?: number;
  skippedCount?: number;
  failures?: Array<{ id: number; reason: string }>;
}

const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  newStatus: z.enum(ORDER_STATUS),
});

const updateProductCrossSellSchema = z.object({
  productId: z.number().int().positive(),
  crossSellIds: z.array(z.number().int().positive()).max(10).nullable(),
});

const bulkUpdateAdminProductsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  operation: z.object({
    mode: z.enum(BULK_PRICE_OPERATION_MODES),
    value: z.string().trim().min(1),
    applyToCompareAtPrice: z.boolean().optional(),
    keepCompareAtGtePrice: z.boolean().optional(),
    stockStatus: z.enum(["keep", "instock", "outofstock"]).optional(),
    stockQuantity: z.string().trim().optional(),
  }),
});

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<UpdateOrderStatusResult> {
  const validationResult = updateOrderStatusSchema.safeParse({ orderId, newStatus });
  if (!validationResult.success) {
    return {
      success: false,
      error: "Geçersiz giriş",
    };
  }

  try {
    // Yetki kontrolü
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "Oturum açmanız gerekiyor",
      };
    }

    if (session.user.role !== "admin") {
      return {
        success: false,
        error: "Bu işlem için admin yetkisi gerekiyor",
      };
    }

    // Siparişin var olup olmadığını kontrol et
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, validationResult.data.orderId))
      .limit(1);

    if (!existingOrder) {
      return {
        success: false,
        error: "Sipariş bulunamadı",
      };
    }

    // Durumu güncelle
    await db
      .update(orders)
      .set({ status: validationResult.data.newStatus })
      .where(eq(orders.id, validationResult.data.orderId));

    // İlgili sayfaları yeniden doğrula
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${validationResult.data.orderId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating order status:", error);
    return {
      success: false,
      error: "Sipariş durumu güncellenirken bir hata oluştu",
    };
  }
}

export async function updateProductCrossSell(
  productId: number,
  crossSellIds: number[] | null
): Promise<UpdateProductCrossSellResult> {
  const validationResult = updateProductCrossSellSchema.safeParse({
    productId,
    crossSellIds,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: "Geçersiz giriş",
    };
  }

  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "Oturum açmanız gerekiyor",
      };
    }

    if (session.user.role !== "admin") {
      return {
        success: false,
        error: "Bu işlem için admin yetkisi gerekiyor",
      };
    }

    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, validationResult.data.productId))
      .limit(1);

    if (!existingProduct) {
      return {
        success: false,
        error: "Ürün bulunamadı",
      };
    }

    const sourceIds = validationResult.data.crossSellIds ?? [];
    const seen = new Set<number>();
    const sanitizedIds: number[] = [];

    for (const id of sourceIds) {
      if (id === validationResult.data.productId) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      sanitizedIds.push(id);
      if (sanitizedIds.length >= 10) break;
    }

    let nextCrossSellIds: number[] | null = null;
    if (sanitizedIds.length > 0) {
      const validProducts = await getProductsByIdsPreserveOrder(sanitizedIds);
      const validIds = validProducts.map((product) => product.id).slice(0, 10);
      nextCrossSellIds = validIds.length > 0 ? validIds : null;
    }

    await db
      .update(products)
      .set({ crossSellIds: nextCrossSellIds })
      .where(eq(products.id, validationResult.data.productId));

    revalidatePath("/admin/products");

    return {
      success: true,
      crossSellIds: nextCrossSellIds,
    };
  } catch (error) {
    console.error("Error updating product cross-sell:", error);
    return {
      success: false,
      error: "Çapraz satış güncellenirken bir hata oluştu",
    };
  }
}

async function ensureAdminSession(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Oturum açmanız gerekiyor" };
  }

  if (session.user.role !== "admin") {
    return { ok: false, error: "Bu işlem için admin yetkisi gerekiyor" };
  }

  return { ok: true };
}

export async function createAdminProductAction(
  input: AdminProductFormInput
): Promise<AdminProductActionResult> {
  const authResult = await ensureAdminSession();
  if (!authResult.ok) {
    return {
      success: false,
      error: authResult.error,
    };
  }

  const result = await createAdminProduct(input);
  if (!result.ok) {
    return {
      success: false,
      error: result.formError,
      fieldErrors: result.fieldErrors,
      resolvedSlug: result.resolvedSlug,
    };
  }

  revalidatePath("/admin/products");

  return {
    success: true,
    resolvedSlug: result.resolvedSlug,
  };
}

export async function updateAdminProductAction(
  productId: number,
  input: AdminProductFormInput
): Promise<AdminProductActionResult> {
  const parsedProductId = z.number().int().positive().safeParse(productId);
  if (!parsedProductId.success) {
    return {
      success: false,
      error: "Geçersiz ürün kimliği",
    };
  }

  const authResult = await ensureAdminSession();
  if (!authResult.ok) {
    return {
      success: false,
      error: authResult.error,
    };
  }

  const result = await updateAdminProduct(parsedProductId.data, input);
  if (!result.ok) {
    return {
      success: false,
      error: result.formError,
      fieldErrors: result.fieldErrors,
      resolvedSlug: result.resolvedSlug,
    };
  }

  revalidatePath("/admin/products");

  return {
    success: true,
    resolvedSlug: result.resolvedSlug,
  };
}

export async function bulkUpdateAdminProductsAction(
  input: BulkUpdateAdminProductsActionInput
): Promise<BulkUpdateAdminProductsActionResult> {
  const authResult = await ensureAdminSession();
  if (!authResult.ok) {
    return {
      success: false,
      error: authResult.error,
    };
  }

  const validationResult = bulkUpdateAdminProductsSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: "Geçersiz giriş",
    };
  }

  const result = await bulkUpdatePrices({
    ids: validationResult.data.ids,
    operation: {
      ...validationResult.data.operation,
      applyToCompareAtPrice: false,
      keepCompareAtGtePrice: false,
    },
  });

  if (result.updatedCount > 0) {
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/bulk");
  }

  if (result.error) {
    return {
      success: false,
      error: result.error,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      failures: result.failures,
    };
  }

  return {
    success: true,
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    failures: result.failures,
  };
}
