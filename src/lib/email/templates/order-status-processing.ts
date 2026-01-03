/**
 * Order status: Processing email template
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export interface OrderStatusProcessingData extends BaseEmailData {
  order: Order;
}

export function subject(data: OrderStatusProcessingData): string {
  return `[CinselHobi] Siparişiniz Hazırlanıyor (#${data.order.id})`;
}

export function html(data: OrderStatusProcessingData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Siparişiniz (#${order.id}) hazırlanmaya başlandı. Siparişiniz kargoya verildiğinde size bilgi vereceğiz.
    </p>
    <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
      Sipariş durumunuzu "Hesabım > Siparişler" bölümünden takip edebilirsiniz.
    </p>
  `;

  return renderBase({
    title: "Siparişiniz Hazırlanıyor",
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

export function text(data: OrderStatusProcessingData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  return `
Siparişiniz Hazırlanıyor

Merhaba ${customerName},

Siparişiniz (#${order.id}) hazırlanmaya başlandı. Siparişiniz kargoya verildiğinde size bilgi vereceğiz.

Sipariş durumunuzu "Hesabım > Siparişler" bölümünden takip edebilirsiniz.

${links.orderUrl ? `Sipariş detaylarını görüntülemek için: ${links.orderUrl}` : ""}
  `.trim();
}

