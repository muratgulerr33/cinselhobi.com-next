import { getCanonicalBaseUrl } from "@/lib/seo/canonical";

/**
 * robots.txt — explicit Route Handler (Next.js App Router)
 * - Google/SEO için doğru Content-Type
 * - CDN cache: s-maxage + stale-while-revalidate
 * - Debug header: X-SEO-Routes
 */
export const revalidate = 86400; // 24 saat

const SEO_DEBUG_HEADER = "robots-handler-v1";

function normalizeBaseUrl(input: string): string {
  // getCanonicalBaseUrl() zaten düzgün döndürüyor olabilir; yine de sağlamlaştıralım.
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`; // path/query kırp
  } catch {
    return input.replace(/\/+$/, ""); // trailing slash temizle
  }
}

export function GET(): Response {
  const baseUrl = normalizeBaseUrl(getCanonicalBaseUrl());

  const lines = [
    "User-Agent: *",
    "Allow: /",

    // Private / non-index pages
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /admin",
    "Disallow: /api/auth",

    // Canonical host + sitemap
    `Host: ${baseUrl}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ];

  // robots.txt genelde newline ile bitmesi tercih edilir
  const body = lines.join("\n") + "\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Browser cache 0, CDN cache 24h, SWR 24h
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
      "X-SEO-Routes": SEO_DEBUG_HEADER,
    },
  });
}
