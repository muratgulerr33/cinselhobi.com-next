/**
 * Support contact received confirmation email template for customer
 */

import type { BaseEmailData } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export interface SupportContactReceivedData extends BaseEmailData {
  ticketId?: string;
  subject?: string;
}

export function subject(data: SupportContactReceivedData): string {
  return "[CinselHobi] Mesajınız Alındı";
}

export function html(data: SupportContactReceivedData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  const ticketInfo = data.ticketId
    ? `
    <p style="margin: 15px 0; font-size: 14px; color: #666; line-height: 1.6;">
      <strong>Bilet No:</strong> ${data.ticketId}
    </p>
  `
    : "";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Mesajınız başarıyla alındı. En kısa sürede size dönüş yapacağız.
    </p>
    ${ticketInfo}
    <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
      Genellikle 24 saat içinde yanıt vermeye çalışıyoruz. Acil durumlar için lütfen telefon ile iletişime geçin.
    </p>
  `;

  return renderBase({
    title: "Mesajınız Alındı",
    content,
    data,
    primaryButton: links.supportUrl
      ? {
          text: "Destek Merkezi",
          url: links.supportUrl,
        }
      : undefined,
  });
}

export function text(data: SupportContactReceivedData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  return `
Mesajınız Alındı

Merhaba ${customerName},

Mesajınız başarıyla alındı. En kısa sürede size dönüş yapacağız.

${data.ticketId ? `Bilet No: ${data.ticketId}` : ""}

Genellikle 24 saat içinde yanıt vermeye çalışıyoruz. Acil durumlar için lütfen telefon ile iletişime geçin.

${links.supportUrl ? `Destek merkezine gitmek için: ${links.supportUrl}` : ""}
  `.trim();
}


