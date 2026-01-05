/**
 * Order notification email template for admin
 * Note: Product names/details are NOT included per privacy requirements
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, formatPrice } from "./_base";

export interface OrderNotificationAdminData extends BaseEmailData {
  order: Order;
}

export function subject(data: OrderNotificationAdminData): string {
  return `[CinselHobi] Yeni Sipariş - #${data.order.id}`;
}

export function html(data: OrderNotificationAdminData): string {
  const order = data.order;
  const links = data.links;
  const orderDate = order.createdAt || "Bilinmiyor";
  const addressInfo = order.shortAddress
    ? `${order.shortAddress.district ? order.shortAddress.district + ", " : ""}${order.shortAddress.city || ""}`
    : "";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Yeni bir sipariş alındı.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #f8f9fa; border-radius: 6px; padding: 15px;">
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Sipariş No:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">#${order.id}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Müşteri:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${data.customer.email}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Tarih:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${orderDate}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Ürün Sayısı:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${order.itemsCount} adet</td>
      </tr>
      ${addressInfo ? `
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Teslimat:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${addressInfo}</td>
      </tr>
      ` : ""}
      ${order.status ? `
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Durum:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${order.status}</td>
      </tr>
      ` : ""}
      <tr>
        <td style="padding: 10px 0 5px 0; font-size: 16px; color: #333; font-weight: bold; border-top: 1px solid #e0e0e0;"><strong>Toplam:</strong></td>
        <td style="padding: 10px 0 5px 0; font-size: 16px; color: #ff2357; font-weight: bold; text-align: right; border-top: 1px solid #e0e0e0;">${formatPrice(order.total, order.currency)}</td>
      </tr>
    </table>
  `;

  return renderBase({
    title: "Yeni Sipariş",
    content,
    data,
    primaryButton: links.orderUrl
      ? {
          text: "Siparişi Görüntüle",
          url: links.orderUrl,
        }
      : undefined,
  });
}

export function text(data: OrderNotificationAdminData): string {
  const order = data.order;
  const links = data.links;
  const orderDate = order.createdAt || "Bilinmiyor";
  const addressInfo = order.shortAddress
    ? `${order.shortAddress.district ? order.shortAddress.district + ", " : ""}${order.shortAddress.city || ""}`
    : "";

  return `
Yeni Sipariş

Yeni bir sipariş alındı.

Sipariş Bilgileri:
- Sipariş No: #${order.id}
- Müşteri: ${data.customer.email}
- Tarih: ${orderDate}
- Ürün Sayısı: ${order.itemsCount} adet
${addressInfo ? `- Teslimat: ${addressInfo}` : ""}
${order.status ? `- Durum: ${order.status}` : ""}
- Toplam: ${formatPrice(order.total, order.currency)}

${links.orderUrl ? `Siparişi görüntülemek için: ${links.orderUrl}` : ""}
  `.trim();
}


