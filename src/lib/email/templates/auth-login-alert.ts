/**
 * Login alert email template (optional security notification)
 */

import type { BaseEmailData } from "./_types";
import { renderBase, getCustomerName } from "./_base";

export interface LoginAlertData extends BaseEmailData {
  loginTime?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export function subject(data: LoginAlertData): string {
  return "[CinselHobi] Yeni Giriş Bildirimi";
}

export function html(data: LoginAlertData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  const loginInfo = data.loginTime || data.ipAddress || data.deviceInfo
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0; background-color: #f8f9fa; border-radius: 6px; padding: 15px;">
      ${data.loginTime ? `<tr><td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Tarih:</strong> ${data.loginTime}</td></tr>` : ""}
      ${data.ipAddress ? `<tr><td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>IP Adresi:</strong> ${data.ipAddress}</td></tr>` : ""}
      ${data.deviceInfo ? `<tr><td style="padding: 5px 0; font-size: 14px; color: #666;"><strong>Cihaz:</strong> ${data.deviceInfo}</td></tr>` : ""}
    </table>
  `
    : "";

  const content = `
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Merhaba ${customerName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Hesabınıza yeni bir giriş yapıldı.
    </p>
    ${loginInfo}
    <p style="margin: 0 0 15px 0; font-size: 14px; color: #d32f2f; line-height: 1.6; font-weight: bold;">
      Eğer bu girişi siz yapmadıysanız, lütfen derhal şifrenizi değiştirin ve bizimle iletişime geçin.
    </p>
    <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
      Bu girişi siz yaptıysanız, bu e-postayı görmezden gelebilirsiniz.
    </p>
  `;

  return renderBase({
    title: "Yeni Giriş Bildirimi",
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

export function text(data: LoginAlertData): string {
  const customerName = getCustomerName(data.customer);
  const links = data.links;

  const loginInfo = [
    data.loginTime && `Tarih: ${data.loginTime}`,
    data.ipAddress && `IP Adresi: ${data.ipAddress}`,
    data.deviceInfo && `Cihaz: ${data.deviceInfo}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `
Yeni Giriş Bildirimi

Merhaba ${customerName},

Hesabınıza yeni bir giriş yapıldı.

${loginInfo ? loginInfo + "\n" : ""}
Eğer bu girişi siz yapmadıysanız, lütfen derhal şifrenizi değiştirin ve bizimle iletişime geçin.

Bu girişi siz yaptıysanız, bu e-postayı görmezden gelebilirsiniz.

${links.accountUrl ? `Hesabınıza gitmek için: ${links.accountUrl}` : ""}
  `.trim();
}


