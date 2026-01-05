/**
 * Order cancelled email template
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, getCustomerName, formatPrice } from "./_base";

export interface OrderCancelledData extends BaseEmailData {
  order: Order;
  reason?: string;
}

export function subject(data: OrderCancelledData): string {
  return `[CinselHobi] Siparişiniz İptal Edildi (#${data.order.id})`;
}

export function html(data: OrderCancelledData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  const reasonSection = data.reason
    ? `
    <p style="margin: 15px 0; font-size: 14px; color: #666; line-height: 1.6;">
      <strong>İptal Nedeni:</strong> ${data.reason}
    </p>
  `
    : "";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Siparişiniz (#${order.id}) iptal edildi.
    </p>
    ${reasonSection}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #f8f9fa; border-radius: 6px; padding: 15px;">
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Sipariş No:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">#${order.id}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Toplam:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${formatPrice(order.total, order.currency)}</td>
      </tr>
    </table>
    <p style="margin: 15px 0 0 0; font-size: 14px; color: #666; line-height: 1.6;">
      Ödeme yapıldıysa, iade işlemi otomatik olarak başlatılacaktır. İade süreci hakkında bilgi almak için bizimle iletişime geçebilirsiniz.
    </p>
  `;

  return renderBase({
    title: "Sipariş İptal Edildi",
    content,
    data,
    primaryButton: links.supportUrl
      ? {
          text: "Destek ile İletişime Geç",
          url: links.supportUrl,
        }
      : undefined,
  });
}

export function text(data: OrderCancelledData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  return `
Siparişiniz İptal Edildi

Merhaba ${customerName},

Siparişiniz (#${order.id}) iptal edildi.

${data.reason ? `İptal Nedeni: ${data.reason}` : ""}

Sipariş Bilgileri:
- Sipariş No: #${order.id}
- Toplam: ${formatPrice(order.total, order.currency)}

Ödeme yapıldıysa, iade işlemi otomatik olarak başlatılacaktır. İade süreci hakkında bilgi almak için bizimle iletişime geçebilirsiniz.

${links.supportUrl ? `Destek ile iletişime geçmek için: ${links.supportUrl}` : ""}
  `.trim();
}


