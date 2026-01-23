"use server";

import { createTransport } from "./transport";
import {
  getOrderConfirmationEmailHtml,
  getOrderConfirmationEmailText,
} from "./templates/order-confirmation";
import {
  getAdminNotificationEmailHtml,
  getAdminNotificationEmailText,
} from "./templates/admin-notification";

export interface SendOrderConfirmationEmailParams {
  orderId: string;
  customerEmail: string;
  customerName: string;
  orderDate: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  address: {
    title: string;
    fullAddress: string;
    city: string;
    district: string;
    phone: string;
  };
  paymentMethod: "credit_card" | "cod";
  orderLink: string;
}

export interface SendAdminNotificationEmailParams {
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderDate: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  paymentMethod: "credit_card" | "cod";
  orderLink: string;
}

/**
 * Müşteriye sipariş onay email'i gönderir
 * Hata durumunda loglar ama exception fırlatmaz (best-effort)
 */
export async function sendOrderConfirmationEmail(
  params: SendOrderConfirmationEmailParams
): Promise<{ success: boolean; error?: string }> {
  // Email gönderimi devre dışıysa sessizce çık
  if (process.env.EMAIL_ENABLED !== "true") {
    return { success: false, error: "Email gönderimi devre dışı" };
  }

  try {
    const transporter = createTransport();
    const from = process.env.SMTP_FROM || "Destek <destek@cinselhobi.com>";

    const html = getOrderConfirmationEmailHtml(params);
    const text = getOrderConfirmationEmailText(params);

    await transporter.sendMail({
      from,
      to: params.customerEmail,
      subject: `Sipariş Onayı - #${params.orderId}`,
      html,
      text,
    });

    return { success: true };
  } catch (error) {
    // Hata logla ama exception fırlatma (sipariş oluşturmayı bozma)
    console.error("[sendOrderConfirmationEmail] Hata:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    };
  }
}

/**
 * Admin'e yeni sipariş bildirimi email'i gönderir
 * Hata durumunda loglar ama exception fırlatmaz (best-effort)
 */
export async function sendAdminNotificationEmail(
  params: SendAdminNotificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  // Email gönderimi devre dışıysa sessizce çık
  if (process.env.EMAIL_ENABLED !== "true") {
    return { success: false, error: "Email gönderimi devre dışı" };
  }

  try {
    const transporter = createTransport();
    const from = process.env.SMTP_FROM || "Destek <destek@cinselhobi.com>";
    const adminEmail =
      process.env.ADMIN_NOTIFY_TO || "destek@cinselhobi.com";

    const html = getAdminNotificationEmailHtml(params);
    const text = getAdminNotificationEmailText(params);

    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: `Yeni Sipariş - #${params.orderId}`,
      html,
      text,
    });

    return { success: true };
  } catch (error) {
    // Hata logla ama exception fırlatma (sipariş oluşturmayı bozma)
    console.error("[sendAdminNotificationEmail] Hata:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    };
  }
}

/**
 * Transactional email gönderme için genel entry point
 * Şu an sadece sipariş email'leri destekleniyor
 */
export async function sendTransactionalEmail(
  type: "order_confirmation" | "admin_notification",
  params: SendOrderConfirmationEmailParams | SendAdminNotificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  if (type === "order_confirmation") {
    return sendOrderConfirmationEmail(
      params as SendOrderConfirmationEmailParams
    );
  } else if (type === "admin_notification") {
    return sendAdminNotificationEmail(
      params as SendAdminNotificationEmailParams
    );
  }

  return { success: false, error: "Bilinmeyen email tipi" };
}

