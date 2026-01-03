/**
 * Base email template utilities
 * Table-based layout with inline CSS for email client compatibility
 */

import type { BaseEmailData, Brand, Links } from "./_types";

export interface RenderBaseOptions {
  title: string;
  content: string;
  data: BaseEmailData;
  primaryButton?: {
    text: string;
    url: string;
  };
}

/**
 * Format price in cents to Turkish Lira
 */
export function formatPrice(cents: number, currency: string = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Get customer display name
 */
export function getCustomerName(customer: BaseEmailData["customer"]): string {
  if (customer.firstName && customer.lastName) {
    return `${customer.firstName} ${customer.lastName}`;
  }
  if (customer.firstName) {
    return customer.firstName;
  }
  return "Değerli Müşterimiz";
}

/**
 * Get base URL from environment or default
 */
function getBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  return "https://cinselhobi.com";
}

/**
 * Get default links if not provided
 */
export function getDefaultLinks(links?: Links): Links {
  const baseUrl = getBaseUrl();
  return {
    accountUrl: links?.accountUrl || `${baseUrl}/account`,
    orderUrl: links?.orderUrl || `${baseUrl}/account/orders`,
    supportUrl: links?.supportUrl || `${baseUrl}/support`,
    verifyEmailUrl: links?.verifyEmailUrl,
    resetPasswordUrl: links?.resetPasswordUrl,
    trackingUrl: links?.trackingUrl,
    ...links,
  };
}

/**
 * Get default brand info
 */
export function getDefaultBrand(brand?: Partial<Brand>): Brand {
  const baseUrl = getBaseUrl();
  return {
    fromNameDefault: brand?.fromNameDefault || "CinselHobi",
    supportEmail: brand?.supportEmail || "destek@cinselhobi.com",
    logoUrl: brand?.logoUrl || `${baseUrl}/logo.svg`,
  };
}

/**
 * Render email footer
 */
function renderFooter(data: BaseEmailData): string {
  const links = getDefaultLinks(data.links);
  const brand = getDefaultBrand(data.brand);
  const baseUrl = getBaseUrl();

  return `
    <tr>
      <td style="padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size: 12px; color: #666; line-height: 1.6;">
              <p style="margin: 0 0 10px 0;">
                Bu e-posta otomatik gönderilmiştir. Lütfen bu e-postaya yanıt vermeyin.
              </p>
              <p style="margin: 0 0 10px 0;">
                Sorularınız için: <a href="mailto:${brand.supportEmail}" style="color: #ff2357; text-decoration: none;">${brand.supportEmail}</a>
              </p>
              <p style="margin: 0;">
                <a href="${baseUrl}/gizlilik-ve-guvenlik" style="color: #666; text-decoration: underline;">Gizlilik Politikası</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Render email header with optional logo
 */
function renderHeader(data: BaseEmailData): string {
  const brand = getDefaultBrand(data.brand);
  const baseUrl = getBaseUrl();

  return `
    <tr>
      <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #ff2357;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="CinselHobi" style="max-height: 40px; height: auto;" />` : '<span style="font-size: 24px; font-weight: bold; color: #ff2357;">CinselHobi</span>'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Render primary button
 */
function renderButton(text: string, url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display: inline-block; background-color: #ff2357; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Render base email HTML structure
 */
export function renderBase(options: RenderBaseOptions): string {
  const { title, content, data, primaryButton } = options;
  const brand = getDefaultBrand(data.brand);

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${renderHeader(data)}
          <tr>
            <td style="padding: 30px 20px;">
              <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #333; line-height: 1.4;">
                ${title}
              </h1>
              ${content}
              ${primaryButton ? renderButton(primaryButton.text, primaryButton.url) : ""}
            </td>
          </tr>
          ${renderFooter(data)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

