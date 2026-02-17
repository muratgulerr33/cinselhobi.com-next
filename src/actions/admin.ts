"use server";

import { auth } from "@/auth";
import { db } from "@/db/connection";
import { orders } from "@/db/schema";
import { ORDER_STATUS, type OrderStatus } from "@/lib/admin/order-status";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type { OrderStatus } from "@/lib/admin/order-status";

export interface UpdateOrderStatusResult {
  success: boolean;
  error?: string;
}

const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  newStatus: z.enum(ORDER_STATUS),
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
