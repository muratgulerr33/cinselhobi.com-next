"use server";

import { auth } from "@/auth";
import { createOrder, getOrderItemsByOrderId } from "@/db/queries/order";
import { db } from "@/db/connection";
import { users, userAddresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  sendOrderConfirmationEmail,
  sendAdminNotificationEmail,
} from "@/lib/email/send";

const checkoutSchema = z.object({
  addressId: z.number().int().positive("Geçerli bir adres seçiniz"),
  paymentMethod: z.enum(["credit_card", "cod"], {
    message: "Geçerli bir ödeme yöntemi seçiniz",
  }),
  cartItems: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99),
    })
  ).min(1, "Sepetiniz boş"),
});

export async function createOrderAction(data: z.infer<typeof checkoutSchema>) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const };
  }

  try {
    const validatedData = checkoutSchema.parse(data);
    
    const order = await createOrder({
      userId: session.user.id,
      addressId: validatedData.addressId,
      paymentMethod: validatedData.paymentMethod,
      items: validatedData.cartItems,
    });

    // Email gönderimi (best-effort, hata durumunda sipariş oluşturmayı bozmaz)
    try {
      // User bilgilerini çek
      const [user] = await db
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      // Adres bilgisini çek
      const [address] = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.id, validatedData.addressId))
        .limit(1);

      // Sipariş ürünlerini çek
      const orderItems = await getOrderItemsByOrderId(order.id);

      if (user?.email && address && orderItems.length > 0) {
        const orderDate = new Date(order.createdAt).toLocaleDateString("tr-TR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://cinselhobi.com";
        const orderLink = `${baseUrl}/order-success/${order.id}`;

        // Müşteriye sipariş onay email'i gönder
        await sendOrderConfirmationEmail({
          orderId: order.id,
          customerEmail: user.email,
          customerName: user.name || "Müşteri",
          orderDate,
          items: orderItems.map((item) => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: order.totalAmount,
          address: {
            title: address.title,
            fullAddress: address.fullAddress,
            city: address.city,
            district: address.district,
            phone: address.phone,
          },
          paymentMethod: order.paymentMethod,
          orderLink,
        });

        // Admin'e bildirim email'i gönder
        await sendAdminNotificationEmail({
          orderId: order.id,
          customerName: user.name || "Müşteri",
          customerEmail: user.email,
          orderDate,
          items: orderItems.map((item) => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          orderLink: `${baseUrl}/admin/orders/${order.id}`,
        });
      }
    } catch (emailError) {
      // Email gönderim hatası sipariş oluşturmayı bozmaz, sadece logla
      console.error("[createOrderAction] Email gönderim hatası:", emailError);
    }

    return { ok: true, orderId: order.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: "Validation error" as const,
        errors: error.issues,
      };
    }
    console.error("Error creating order:", error);
    return { ok: false, error: "Sipariş oluşturulurken bir hata oluştu" };
  }
}

