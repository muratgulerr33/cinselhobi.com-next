/**
 * Order status: Delivered email template
 */

import type { BaseEmailData, Order } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export interface OrderStatusDeliveredData extends BaseEmailData {
  order: Order;
}

export function subject(data: OrderStatusDeliveredData): string {
  return `[CinselHobi] Siparişiniz Teslim Edildi (#${data.order.id})`;
}

export function html(data: OrderStatusDeliveredData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Siparişiniz (#${order.id}) başarıyla teslim edildi!
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Alışverişinizden memnun kaldıysanız, değerlendirmenizi bizimle paylaşabilirsiniz.
    </p>
    <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
      Herhangi bir sorunuz veya öneriniz varsa, bizimle iletişime geçmekten çekinmeyin.
    </p>
  `;

  return renderBase({
    title: "Siparişiniz Teslim Edildi",
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

export function text(data: OrderStatusDeliveredData): string {
  const customerName = getCustomerName(data.customer);
  const order = data.order;
  const links = data.links;

  return `
Siparişiniz Teslim Edildi

Merhaba ${customerName},

Siparişiniz (#${order.id}) başarıyla teslim edildi!

Alışverişinizden memnun kaldıysanız, değerlendirmenizi bizimle paylaşabilirsiniz.

Herhangi bir sorunuz veya öneriniz varsa, bizimle iletişime geçmekten çekinmeyin.

${links.orderUrl ? `Sipariş detaylarını görüntülemek için: ${links.orderUrl}` : ""}
  `.trim();
}

