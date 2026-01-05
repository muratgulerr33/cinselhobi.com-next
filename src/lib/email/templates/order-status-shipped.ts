/**
 * Order status: Shipped email template
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export interface OrderStatusShippedData extends BaseEmailData {
  order: Order;
}

export function subject(data: OrderStatusShippedData): string {
  return `[CinselHobi] Siparişiniz Kargoya Verildi (#${data.order.id})`;
}

export function html(data: OrderStatusShippedData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  const trackingSection = links.trackingUrl
    ? `
    <p style="margin: 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Kargo takip numaranızı aşağıdaki bağlantıdan görüntüleyebilirsiniz.
    </p>
  `
    : "";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Siparişiniz (#${order.id}) kargoya verildi! Kısa süre içinde size ulaşacaktır.
    </p>
    ${trackingSection}
    <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
      Sipariş durumunuzu "Hesabım > Siparişler" bölümünden takip edebilirsiniz.
    </p>
  `;

  return renderBase({
    title: "Siparişiniz Kargoya Verildi",
    content,
    data,
    primaryButton: links.trackingUrl
      ? {
          text: "Kargo Takibi",
          url: links.trackingUrl,
        }
      : links.orderUrl
      ? {
          text: "Sipariş Detaylarını Görüntüle",
          url: links.orderUrl,
        }
      : undefined,
  });
}

export function text(data: OrderStatusShippedData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  return `
Siparişiniz Kargoya Verildi

Merhaba ${customerName},

Siparişiniz (#${order.id}) kargoya verildi! Kısa süre içinde size ulaşacaktır.

${links.trackingUrl ? `Kargo takip numaranızı görüntülemek için: ${links.trackingUrl}` : ""}

Sipariş durumunuzu "Hesabım > Siparişler" bölümünden takip edebilirsiniz.

${links.orderUrl ? `Sipariş detaylarını görüntülemek için: ${links.orderUrl}` : ""}
  `.trim();
}


