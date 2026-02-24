import { getCanonicalBaseUrl } from "@/lib/seo/canonical";

/** 24 saat (CDN: s-maxage=86400) */
export const revalidate = 86400;

const SEO_DEBUG_HEADER = "robots-handler-v1";
const AI_BOT_USER_AGENTS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "Google-Extended",
  "GPTBot",
  "meta-externalagent",
] as const;

export function GET(): Response {
  const baseUrl = getCanonicalBaseUrl();

  const lines: string[] = [];
  lines.push("User-agent: *");
  lines.push("Allow: /");
  lines.push("Disallow: /account");
  lines.push("Disallow: /cart");
  lines.push("Disallow: /checkout");
  lines.push("Disallow: /admin");
  lines.push("Disallow: /api/auth");
  for (const botUserAgent of AI_BOT_USER_AGENTS) {
    lines.push("");
    lines.push(`User-agent: ${botUserAgent}`);
    lines.push("Disallow: /");
  }
  lines.push("");
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
