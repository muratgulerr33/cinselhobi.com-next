/**
 * Password changed confirmation email template
 */

import type { BaseEmailData } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export function subject(data: BaseEmailData): string {
  return "[CinselHobi] Şifreniz Değiştirildi";
}

export function html(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Hesabınızın şifresi başarıyla değiştirildi.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 14px; color: #d32f2f; line-height: 1.6; font-weight: bold;">
      Eğer bu işlemi siz yapmadıysanız, lütfen derhal bizimle iletişime geçin.
    </p>
    <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
      Güvenliğiniz için şifrenizi düzenli olarak değiştirmenizi öneririz.
    </p>
  `;

  return renderBase({
    title: "Şifre Değiştirildi",
    content,
    data,
    primaryButton: links.accountUrl
      ? {
          text: "Hesabıma Git",
          url: links.accountUrl,
        }
      : undefined,
  });
}

export function text(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  return `
Şifreniz Değiştirildi

Merhaba ${customerName},

Hesabınızın şifresi başarıyla değiştirildi.

Eğer bu işlemi siz yapmadıysanız, lütfen derhal bizimle iletişime geçin.

Güvenliğiniz için şifrenizi düzenli olarak değiştirmenizi öneririz.

${links.accountUrl ? `Hesabınıza gitmek için: ${links.accountUrl}` : ""}
  `.trim();
}

