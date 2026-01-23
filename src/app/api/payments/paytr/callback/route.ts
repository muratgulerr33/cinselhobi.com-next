import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connection";
import { orders, users, userAddresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  sendOrderConfirmationEmail,
  sendAdminNotificationEmail,
} from "@/lib/email/send";
import { getOrderItemsByOrderId } from "@/db/queries/order";
import { PayTRProvider } from "@/lib/payments/paytr-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PayTR Callback Endpoint
 * 
 * PayTR'den gelen ödeme sonucu bildirimlerini alır ve işler.
 * 
 * POST body fields:
 * - merchant_oid: Order ID
 * - status: "success" veya "failed"
 * - total_amount: Ödenen tutar (kuruş cinsinden)
 * - hash: Doğrulama hash'i
 * - failed_reason_code: (başarısız ise) Hata kodu
 * - failed_reason_msg: (başarısız ise) Hata mesajı
 * - payment_type: Ödeme tipi (örn: "card")
 * - currency: Para birimi
 * - test_mode: Test modu (1 veya 0)
 */
export async function POST(request: NextRequest) {
  try {
    // PayTR yapılandırma kontrolü - ilk satır
    const paytrProvider = new PayTRProvider();
    if (!paytrProvider.isConfigured()) {
      // Yapılandırılmamışsa 404 dön (NOT "OK")
      return new NextResponse("Not Found", { status: 404 });
    }

    // POST body'yi al
    const formData = await request.formData();
    const merchantOid = formData.get("merchant_oid") as string | null;
    const status = formData.get("status") as string | null;
    const totalAmount = formData.get("total_amount") as string | null;
    const hash = formData.get("hash") as string | null;
    const failedReasonCode = formData.get("failed_reason_code") as string | null;
    const failedReasonMsg = formData.get("failed_reason_msg") as string | null;
    const paymentType = formData.get("payment_type") as string | null;
    const currency = formData.get("currency") as string | null;
    const testMode = formData.get("test_mode") as string | null;

    // Zorunlu alanları kontrol et
    if (!merchantOid || !status || !totalAmount || !hash) {
      console.error("[PayTR Callback] Eksik alanlar:", {
        merchantOid: !!merchantOid,
        status: !!status,
        totalAmount: !!totalAmount,
        hash: !!hash,
      });
      return new NextResponse("OK", { status: 200 });
    }

    // PayTR credentials
    const merchantKey = process.env.PAYTR_MERCHANT_KEY;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

    if (!merchantKey || !merchantSalt) {
      console.error("[PayTR Callback] PayTR credentials eksik");
      return new NextResponse("OK", { status: 200 });
    }

    // Hash doğrulama
    const hashStr = merchantOid + merchantSalt + status + totalAmount;
    const calculatedHash = crypto
      .createHmac("sha256", merchantKey)
      .update(hashStr)
      .digest("base64");

    if (calculatedHash !== hash) {
      console.error("[PayTR Callback] Hash doğrulama başarısız", {
        merchantOid,
        receivedHash: hash.substring(0, 10) + "...",
        calculatedHash: calculatedHash.substring(0, 10) + "...",
      });
      return new NextResponse("OK", { status: 200 });
    }

    // Order'ı bul
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, merchantOid))
      .limit(1);

    if (!order) {
      console.error("[PayTR Callback] Order bulunamadı:", merchantOid);
      return new NextResponse("OK", { status: 200 });
    }

    // Idempotency: Eğer order zaten "paid" ise, tekrar işlem yapma, sadece "OK" dön
    if (order.paymentStatus === "paid" && status === "success") {
      console.log("[PayTR Callback] Order zaten paid, idempotency:", merchantOid);
      return new NextResponse("OK", { status: 200 });
    }

    // Payment status'u güncelle
    const newPaymentStatus = status === "success" ? "paid" : "failed";
    const transactionId = status === "success" ? hash : null; // Transaction ID olarak hash kullanabiliriz

    await db
      .update(orders)
      .set({
        paymentStatus: newPaymentStatus,
        paymentTransactionId: transactionId,
        paymentMetadata: {
          ...(order.paymentMetadata as Record<string, unknown> | null),
          callbackStatus: status,
          callbackTotalAmount: totalAmount,
          paymentType,
          currency,
          testMode: testMode === "1",
          failedReasonCode: failedReasonCode || null,
          failedReasonMsg: failedReasonMsg || null,
          callbackReceivedAt: new Date().toISOString(),
        },
      })
      .where(eq(orders.id, merchantOid));

    // Eğer ödeme başarılıysa email gönder
    if (status === "success" && newPaymentStatus === "paid") {
      try {
        // User bilgilerini çek
        const [user] = await db
          .select({
            email: users.email,
            name: users.name,
          })
          .from(users)
          .where(eq(users.id, order.userId))
          .limit(1);

        // Adres bilgisini çek
        const [address] = await db
          .select()
          .from(userAddresses)
          .where(eq(userAddresses.id, order.addressId))
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

          const baseUrl =
            process.env.AUTH_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            "https://cinselhobi.com";
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
        // Email gönderim hatası callback'i bozmaz, sadece logla
        console.error("[PayTR Callback] Email gönderim hatası:", emailError);
      }
    }

    // PayTR'ye plain text "OK" dön (başka hiçbir şey olmadan)
    return new NextResponse("OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    // Hata durumunda bile "OK" dön (PayTR tekrar gönderebilir)
    console.error("[PayTR Callback] Hata:", error);
    return new NextResponse("OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
