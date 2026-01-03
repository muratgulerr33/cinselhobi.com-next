/**
 * Welcome email template for new user registration
 */

import type { BaseEmailData } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export function subject(data: BaseEmailData): string {
  return "[CinselHobi] Hoş Geldiniz!";
}

export function html(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      CinselHobi ailesine hoş geldiniz! Hesabınız başarıyla oluşturuldu.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Artık güvenli ve özel alışveriş deneyiminin keyfini çıkarabilirsiniz. Hesabınızdan siparişlerinizi takip edebilir, favori ürünlerinizi kaydedebilir ve özel kampanyalardan haberdar olabilirsiniz.
    </p>
    <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
      Herhangi bir sorunuz olursa, bizimle iletişime geçmekten çekinmeyin.
    </p>
  `;

  return renderBase({
    title: "Hoş Geldiniz!",
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
Hoş Geldiniz!

Merhaba ${customerName},

CinselHobi ailesine hoş geldiniz! Hesabınız başarıyla oluşturuldu.

Artık güvenli ve özel alışveriş deneyiminin keyfini çıkarabilirsiniz. Hesabınızdan siparişlerinizi takip edebilir, favori ürünlerinizi kaydedebilir ve özel kampanyalardan haberdar olabilirsiniz.

Herhangi bir sorunuz olursa, bizimle iletişime geçmekten çekinmeyin.

${links.accountUrl ? `Hesabınıza gitmek için: ${links.accountUrl}` : ""}
  `.trim();
}

