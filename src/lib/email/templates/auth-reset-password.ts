/**
 * Password reset email template
 */

import type { BaseEmailData } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export function subject(data: BaseEmailData): string {
  return "[CinselHobi] Şifre Sıfırlama";
}

export function html(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const resetUrl = data.links.resetPasswordUrl || "Unknown";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Hesabınız için şifre sıfırlama talebinde bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 14px; color: #666; line-height: 1.6;">
      Bu bağlantı 1 saat geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz ve şifreniz değişmeyecektir.
    </p>
  `;

  return renderBase({
    title: "Şifre Sıfırlama",
    content,
    data,
    primaryButton: resetUrl !== "Unknown"
      ? {
          text: "Şifremi Sıfırla",
          url: resetUrl,
        }
      : undefined,
  });
}

export function text(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const resetUrl = data.links.resetPasswordUrl || "Unknown";

  return `
Şifre Sıfırlama

Merhaba ${customerName},

Hesabınız için şifre sıfırlama talebinde bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın.

Bu bağlantı 1 saat geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz ve şifreniz değişmeyecektir.

${resetUrl !== "Unknown" ? `Şifre sıfırlama bağlantısı: ${resetUrl}` : "Şifre sıfırlama bağlantısı mevcut değil."}
  `.trim();
}


