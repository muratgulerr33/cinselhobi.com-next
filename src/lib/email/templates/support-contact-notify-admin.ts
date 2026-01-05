/**
 * Support contact notification email template for admin
 */

import type { BaseEmailData } from "./_types";
import { renderBase } from "./_base";

export interface SupportContactNotifyAdminData extends BaseEmailData {
  ticketId?: string;
  subject?: string;
  message?: string;
}

export function subject(data: SupportContactNotifyAdminData): string {
  return `[CinselHobi] Yeni Destek Mesajı${data.ticketId ? ` - #${data.ticketId}` : ""}`;
}

export function html(data: SupportContactNotifyAdminData): string {
  const links = data.links;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Yeni bir destek mesajı alındı.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #f8f9fa; border-radius: 6px; padding: 15px;">
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Müşteri:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${data.customer.email}</td>
      </tr>
      ${data.customer.firstName || data.customer.lastName ? `
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>İsim:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${data.customer.firstName || ""} ${data.customer.lastName || ""}</td>
      </tr>
      ` : ""}
      ${data.ticketId ? `
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Bilet No:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${data.ticketId}</td>
      </tr>
      ` : ""}
      ${data.subject ? `
      <tr>
        <td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Konu:</strong></td>
        <td style="padding: 5px 0; font-size: 14px; color: #333; text-align: right;">${data.subject}</td>
      </tr>
      ` : ""}
    </table>
    ${data.message ? `
    <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 6px; border-left: 3px solid #ff2357;">
      <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
    </div>
    ` : ""}
  `;

  return renderBase({
    title: "Yeni Destek Mesajı",
    content,
    data,
    primaryButton: links.supportUrl
      ? {
          text: "Mesajı Görüntüle",
          url: links.supportUrl,
        }
      : undefined,
  });
}

export function text(data: SupportContactNotifyAdminData): string {
  const links = data.links;

  return `
Yeni Destek Mesajı

Yeni bir destek mesajı alındı.

Mesaj Bilgileri:
- Müşteri: ${data.customer.email}
${data.customer.firstName || data.customer.lastName ? `- İsim: ${data.customer.firstName || ""} ${data.customer.lastName || ""}` : ""}
${data.ticketId ? `- Bilet No: ${data.ticketId}` : ""}
${data.subject ? `- Konu: ${data.subject}` : ""}

${data.message ? `\nMesaj:\n${data.message}` : ""}

${links.supportUrl ? `Mesajı görüntülemek için: ${links.supportUrl}` : ""}
  `.trim();
}


