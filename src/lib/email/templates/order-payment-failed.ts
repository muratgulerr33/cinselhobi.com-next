/**
 * Order payment failed email template
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export interface OrderPaymentFailedData extends BaseEmailData {
  order: Order;
}

export function subject(data: OrderPaymentFailedData): string {
  return `[CinselHobi] Ödeme Başarısız (#${data.order.id})`;
}

export function html(data: OrderPaymentFailedData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Siparişiniz (#${order.id}) için ödeme işlemi başarısız oldu.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 14px; color: #d32f2f; line-height: 1.6;">
      Siparişinizi tamamlamak için lütfen ödeme yönteminizi kontrol edin ve tekrar deneyin.
    </p>
    <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
      Sorun devam ederse, bizimle iletişime geçmekten çekinmeyin.
    </p>
  `;

  return renderBase({
    title: "Ödeme Başarısız",
    content,
    data,
    primaryButton: links.orderUrl
      ? {
          text: "Sipariş Detaylarını Görüntüle",
          url: links.orderUrl,
        }
      : links.supportUrl
      ? {
          text: "Destek ile İletişime Geç",
          url: links.supportUrl,
        }
      : undefined,
  });
}

export function text(data: OrderPaymentFailedData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  return `
Ödeme Başarısız

Merhaba ${customerName},

Siparişiniz (#${order.id}) için ödeme işlemi başarısız oldu.

Siparişinizi tamamlamak için lütfen ödeme yönteminizi kontrol edin ve tekrar deneyin.

Sorun devam ederse, bizimle iletişime geçmekten çekinmeyin.

${links.orderUrl ? `Sipariş detaylarını görüntülemek için: ${links.orderUrl}` : ""}
${links.supportUrl ? `Destek ile iletişime geçmek için: ${links.supportUrl}` : ""}
  `.trim();
}


