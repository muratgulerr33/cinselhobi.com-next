/**
 * Admin'e yeni sipariş bildirimi email template'i
 */

export interface AdminNotificationData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderDate: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  paymentMethod: "credit_card" | "cod";
  orderLink: string;
}

// Yeni template standardı: subject, html, text export'ları
export function subject(data: AdminNotificationData): string {
  return `[CinselHobi] Yeni Sipariş - #${data.orderId}`;
}

export function html(data: AdminNotificationData): string {
  return getAdminNotificationEmailHtml(data);
}

export function text(data: AdminNotificationData): string {
  return getAdminNotificationEmailText(data);
}

// Eski export'lar (geriye dönük uyumluluk için korunuyor)
export function getAdminNotificationEmailHtml(data: AdminNotificationData): string {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(cents / 100);
  };

  const paymentMethodText =
    data.paymentMethod === "cod" ? "Kapıda Ödeme" : "Kredi Kartı";

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yeni Sipariş Bildirimi</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ff2357; color: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="margin: 0;">Yeni Sipariş!</h1>
  </div>

  <div style="background-color: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Sipariş Bilgileri</h2>
    <p><strong>Sipariş No:</strong> ${data.orderId}</p>
    <p><strong>Müşteri:</strong> ${data.customerName} (${data.customerEmail})</p>
    <p><strong>Tarih:</strong> ${data.orderDate}</p>
    <p><strong>Ödeme Yöntemi:</strong> ${paymentMethodText}</p>
    <p><strong>Toplam:</strong> ${formatPrice(data.totalAmount)}</p>
  </div>

  <div style="background-color: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Sipariş Detayları</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">Ürün</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e0e0e0;">Adet</th>
          <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e0e0e0;">Fiyat</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e0e0e0;">${item.quantity}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0;">${formatPrice(item.price * item.quantity)}</td>
        </tr>
        `
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #e0e0e0;">Toplam:</td>
          <td style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #e0e0e0;">${formatPrice(data.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${data.orderLink}" style="display: inline-block; background-color: #ff2357; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Siparişi Görüntüle</a>
  </div>
</body>
</html>
  `.trim();
}

export function getAdminNotificationEmailText(data: AdminNotificationData): string {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(cents / 100);
  };

  const paymentMethodText =
    data.paymentMethod === "cod" ? "Kapıda Ödeme" : "Kredi Kartı";

  return `
Yeni Sipariş!

Sipariş Bilgileri:
- Sipariş No: ${data.orderId}
- Müşteri: ${data.customerName} (${data.customerEmail})
- Tarih: ${data.orderDate}
- Ödeme Yöntemi: ${paymentMethodText}
- Toplam: ${formatPrice(data.totalAmount)}

Sipariş Detayları:
${data.items
  .map(
    (item) =>
      `- ${item.name} (${item.quantity} adet) - ${formatPrice(item.price * item.quantity)}`
  )
  .join("\n")}

Siparişi Görüntüle: ${data.orderLink}
  `.trim();
}

