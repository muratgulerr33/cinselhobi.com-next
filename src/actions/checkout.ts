"use server";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { createOrder, getOrderItemsByOrderId } from "@/db/queries/order";
import { db } from "@/db/connection";
import { users, userAddresses, products } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  sendOrderConfirmationEmail,
  sendAdminNotificationEmail,
} from "@/lib/email/send";
import { PayTRProvider } from "@/lib/payments/paytr-provider";

/**
 * PayTR yapılandırma durumunu kontrol eder
 */
export async function getPayTRConfigStatus() {
  const paytrProvider = new PayTRProvider();
  return { configured: paytrProvider.isConfigured() };
}

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

/**
 * Sipariş email'lerini gönderir (best-effort, hata durumunda sipariş oluşturmayı bozmaz)
 */
async function sendOrderEmails(
  order: { id: string; createdAt: Date; totalAmount: number; paymentMethod: "credit_card" | "cod" },
  userId: string,
  addressId: number
) {
  try {
    // User bilgilerini çek
    const [user] = await db
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Adres bilgisini çek
    const [address] = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, addressId))
      .limit(1);

    // Sipariş ürünlerini çek
    const orderItems = await getOrderItemsByOrderId(order.id);

    if (!user?.email || !address || orderItems.length === 0) {
      return;
    }

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
  } catch (emailError) {
    // Email gönderim hatası sipariş oluşturmayı bozmaz, sadece logla
    console.error("[createOrderAction] Email gönderim hatası:", emailError);
  }
}

export async function createOrderAction(data: z.infer<typeof checkoutSchema>) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const };
  }

  try {
    const validatedData = checkoutSchema.parse(data);

    // COD akışı: Direkt order oluştur
    if (validatedData.paymentMethod === "cod") {
      const order = await createOrder({
        userId: session.user.id,
        addressId: validatedData.addressId,
        paymentMethod: validatedData.paymentMethod,
        items: validatedData.cartItems,
        paymentStatus: "pending", // COD için ödeme bekleniyor
      });

      // Email gönderimi (best-effort, hata durumunda sipariş oluşturmayı bozmaz)
      await sendOrderEmails(order, session.user.id, validatedData.addressId);

      return { ok: true, orderId: order.id };
    }

    // Credit Card akışı: Order önce oluştur, sonra PayTR token al
    if (validatedData.paymentMethod === "credit_card") {
      const paytrProvider = new PayTRProvider();

      // PayTR ENV kontrolü
      if (!paytrProvider.isConfigured()) {
        return {
          ok: false,
          error: "Kredi kartı ödeme sistemi şu anda yapılandırılmamış. Lütfen kapıda ödeme seçeneğini kullanın.",
        };
      }

      // Toplam tutarı hesapla
      const productIds = validatedData.cartItems.map((item) => item.productId);
      const productPrices = await db
        .select({
          id: products.id,
          price: products.price,
          salePrice: products.salePrice,
        })
        .from(products)
        .where(inArray(products.id, productIds));

      const priceMap = new Map<number, number>();
      for (const p of productPrices) {
        const finalPrice = p.salePrice ?? p.price ?? 0;
        priceMap.set(p.id, finalPrice);
      }

      let totalAmountCents = 0;
      for (const item of validatedData.cartItems) {
        const price = priceMap.get(item.productId);
        if (!price) {
          return {
            ok: false,
            error: `Ürün ${item.productId} bulunamadı veya fiyat bilgisi yok`,
          };
        }
        totalAmountCents += price * item.quantity;
      }

      // User bilgilerini çek (email, name, address için)
      const [user] = await db
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (!user?.email) {
        return {
          ok: false,
          error: "Kullanıcı email bilgisi bulunamadı",
        };
      }

      // Adres bilgisini çek
      const [address] = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.id, validatedData.addressId))
        .limit(1);

      if (!address) {
        return {
          ok: false,
          error: "Adres bulunamadı",
        };
      }

      // Order'ı "pending" paymentStatus ile oluştur
      const order = await createOrder({
        userId: session.user.id,
        addressId: validatedData.addressId,
        paymentMethod: validatedData.paymentMethod,
        items: validatedData.cartItems,
        paymentStatus: "pending", // Callback sonrası "paid" olacak
        paymentProvider: "paytr",
      });

      // IP adresini al
      const headersList = await headers();
      const userIp =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "127.0.0.1";

      // User basket (base64 encoded JSON)
      const basketItems = validatedData.cartItems.map((item) => {
        const price = priceMap.get(item.productId) || 0;
        return `${item.productId}||${item.quantity}||${price}`;
      });
      const userBasket = Buffer.from(JSON.stringify(basketItems)).toString("base64");

      // PayTR token al
      const tokenResult = await paytrProvider.startCardPayment({
        amount: totalAmountCents,
        merchantOid: order.id, // Order ID'yi merchant_oid olarak kullan
        userIp,
        email: user.email,
        userBasket,
        userName: user.name || undefined,
        userAddress: address.fullAddress || undefined,
        userPhone: address.phone || undefined,
        noInstallment: 0, // Taksit gösterilsin
        maxInstallment: 0, // Max taksit (0 = default)
        currency: "TL",
        testMode: process.env.PAYTR_TEST_MODE === "1" ? 1 : 0,
      });

      if (!tokenResult.success) {
        // Token alınamadı, order zaten oluşturuldu ama paymentStatus pending
        // Bu durumda kullanıcıya hata göster, order pending kalır
        return {
          ok: false,
          error: tokenResult.error || "Ödeme token'ı alınamadı",
        };
      }

      // Email gönderimi YAPILMAYACAK - sadece callback sonrası paymentStatus "paid" olduğunda gönderilecek
      // Bu sayede ödeme tamamlanmadan email gitmez

      // Başarılı response: iframeToken ve orderId döndür
      return {
        ok: true,
        paytr: {
          iframeToken: tokenResult.iframeToken,
          orderId: order.id,
        },
      };
    }

    // Fallback (buraya gelmemeli)
    return {
      ok: false,
      error: "Geçersiz ödeme yöntemi",
    };

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

