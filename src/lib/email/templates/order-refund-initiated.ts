/**
 * Order refund initiated email template
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, getCustomerName, formatPrice } from "./_base";

export interface OrderRefundInitiatedData extends BaseEmailData {
  order: Order;
  refundAmount?: number;
}

export function subject(data: OrderRefundInitiatedData): string {
  return `[CinselHobi] İade İşlemi Başlatıldı (#${data.order.id})`;
}

export function html(data: OrderRefundInitiatedData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;
  const refundAmount = data.refundAmount || order.total;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Siparişiniz (#${order.id}) için iade işlemi başlatıldı.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #f8f9fa; border-radius: 6px; padding: 15px;">
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Sipariş No:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">#${order.id}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>İade Tutarı:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${formatPrice(refundAmount, order.currency)}</td>
      </tr>
    </table>
    <p style="margin: 15px 0 0 0; font-size: 14px; color: #666; line-height: 1.6;">
      İade tutarı, ödeme yönteminize göre 3-5 iş günü içinde hesabınıza yansıyacaktır. İşlem tamamlandığında size bilgi vereceğiz.
    </p>
  `;

  return renderBase({
    title: "İade İşlemi Başlatıldı",
    content,
    data,
    primaryButton: links.orderUrl
      ? {
          text: "Sipariş Detaylarını Görüntüle",
          url: links.orderUrl,
        }
      : undefined,
  });
}

export function text(data: OrderRefundInitiatedData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;
  const refundAmount = data.refundAmount || order.total;

  return `
İade İşlemi Başlatıldı

Merhaba ${customerName},

Siparişiniz (#${order.id}) için iade işlemi başlatıldı.

İade Bilgileri:
- Sipariş No: #${order.id}
- İade Tutarı: ${formatPrice(refundAmount, order.currency)}

İade tutarı, ödeme yönteminize göre 3-5 iş günü içinde hesabınıza yansıyacaktır. İşlem tamamlandığında size bilgi vereceğiz.

${links.orderUrl ? `Sipariş detaylarını görüntülemek için: ${links.orderUrl}` : ""}
  `.trim();
}

