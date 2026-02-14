import { getCanonicalBaseUrl } from "@/lib/seo/canonical";

/** 24 saat. CDN: s-maxage=86400, stale-while-revalidate. */
export const revalidate = 86400;

const SEO_DEBUG_HEADER = "robots-handler-v1";

export function GET(): Response {
  const baseUrl = getCanonicalBaseUrl();
  const body = [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /admin",
    "Disallow: /api/auth",
    `Host: ${baseUrl}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
      "X-SEO-Routes": SEO_DEBUG_HEADER,
    },
  });
}
