/**
 * Email verification template
 */

import type { BaseEmailData } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export function subject(data: BaseEmailData): string {
  return "[CinselHobi] E-posta Adresinizi Doğrulayın";
}

export function html(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const verifyUrl = data.links.verifyEmailUrl || "Unknown";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      E-posta adresinizi doğrulamak için aşağıdaki bağlantıya tıklayın. Bu işlem hesabınızın güvenliği için gereklidir.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 14px; color: #666; line-height: 1.6;">
      Bu bağlantı 24 saat geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
    </p>
  `;

  return renderBase({
    title: "E-posta Doğrulama",
    content,
    data,
    primaryButton: verifyUrl !== "Unknown"
      ? {
          text: "E-postamı Doğrula",
          url: verifyUrl,
        }
      : undefined,
  });
}

export function text(data: BaseEmailData): string {
  const customerName = getCustomerName(data.customer);
  const verifyUrl = data.links.verifyEmailUrl || "Unknown";

  return `
E-posta Adresinizi Doğrulayın

Merhaba ${customerName},

E-posta adresinizi doğrulamak için aşağıdaki bağlantıya tıklayın. Bu işlem hesabınızın güvenliği için gereklidir.

Bu bağlantı 24 saat geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.

${verifyUrl !== "Unknown" ? `Doğrulama bağlantısı: ${verifyUrl}` : "Doğrulama bağlantısı mevcut değil."}
  `.trim();
}


