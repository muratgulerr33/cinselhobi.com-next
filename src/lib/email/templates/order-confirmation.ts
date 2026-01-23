/**
 * Müşteriye sipariş onay email'i template'i
 */
export function getOrderConfirmationEmailHtml(data: {
  orderId: string;
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
}): string {
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
  <title>Sipariş Onayı</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #ff2357; margin: 0;">Siparişiniz Alındı!</h1>
    <p style="margin: 10px 0 0 0;">Merhaba ${data.customerName},</p>
  </div>

  <div style="background-color: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Sipariş Bilgileri</h2>
    <p><strong>Sipariş No:</strong> ${data.orderId}</p>
    <p><strong>Tarih:</strong> ${data.orderDate}</p>
    <p><strong>Ödeme Yöntemi:</strong> ${paymentMethodText}</p>
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

  <div style="background-color: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Teslimat Adresi</h2>
    <p><strong>${data.address.title}</strong></p>
    <p>${data.address.fullAddress}</p>
    <p>${data.address.district}, ${data.address.city}</p>
    <p>Tel: ${data.address.phone}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${data.orderLink}" style="display: inline-block; background-color: #ff2357; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sipariş Detaylarını Görüntüle</a>
  </div>

  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #666;">
    <p style="margin: 0;">Siparişinizle ilgili herhangi bir sorunuz varsa, lütfen bizimle iletişime geçin.</p>
    <p style="margin: 10px 0 0 0;">Teşekkür ederiz!</p>
  </div>
</body>
</html>
  `.trim();
}

export function getOrderConfirmationEmailText(data: {
  orderId: string;
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
}): string {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(cents / 100);
  };

  const paymentMethodText =
    data.paymentMethod === "cod" ? "Kapıda Ödeme" : "Kredi Kartı";

  return `
Siparişiniz Alındı!

Merhaba ${data.customerName},

Sipariş Bilgileri:
- Sipariş No: ${data.orderId}
- Tarih: ${data.orderDate}
- Ödeme Yöntemi: ${paymentMethodText}

Sipariş Detayları:
${data.items
  .map(
    (item) =>
      `- ${item.name} (${item.quantity} adet) - ${formatPrice(item.price * item.quantity)}`
  )
  .join("\n")}

Toplam: ${formatPrice(data.totalAmount)}

Teslimat Adresi:
${data.address.title}
${data.address.fullAddress}
${data.address.district}, ${data.address.city}
Tel: ${data.address.phone}

Sipariş Detaylarını Görüntüle: ${data.orderLink}

Siparişinizle ilgili herhangi bir sorunuz varsa, lütfen bizimle iletişime geçin.

Teşekkür ederiz!
  `.trim();
}

