import { getCanonicalBaseUrl } from "@/lib/seo/canonical";

/** 24 saat (CDN: s-maxage=86400) */
export const revalidate = 86400;

const SEO_DEBUG_HEADER = "robots-handler-v1";

export function GET(): Response {
  const baseUrl = getCanonicalBaseUrl();

  const lines: string[] = [];
  lines.push("User-Agent: *");
  lines.push("Allow: /");
  lines.push("Disallow: /account");
  lines.push("Disallow: /cart");
  lines.push("Disallow: /checkout");
  lines.push("Disallow: /admin");
  lines.push("Disallow: /api/auth");
  lines.push(`Host: ${baseUrl}`);
  lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);

  const body = lines.join("\n") + "\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
      "X-SEO-Routes": SEO_DEBUG_HEADER,
    },
  });
}
