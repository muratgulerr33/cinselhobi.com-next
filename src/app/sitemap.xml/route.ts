import { getCanonicalBaseUrl } from "@/lib/seo/canonical";
import { getAllCategorySlugsForSitemap, getAllProductSlugsForSitemap } from "@/db/queries/catalog";
import { getAllHubSlugs } from "@/config/hub-ui";
import { institutionalContent } from "@/data/institutional-content";

/** 1 saat; DB'ye her istekte abanmasın. CDN: s-maxage=3600, stale-while-revalidate. */
export const revalidate = 3600;

const SEO_DEBUG_HEADER = "sitemap-handler-v1";

/** XML loc escape: &, <, >, ", ' (sitemaps.org). */
function escapeLoc(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Geçerli slug: boş/undefined/null/whitespace değil, "/" içermemeli. */
function isValidSlug(s: string | null | undefined): boolean {
  if (s == null) return false;
  const t = String(s).trim();
  if (!t.length) return false;
  if (t.includes("/")) return false;
  return true;
}

/** lastmod: ISO 8601 date (YYYY-MM-DD yeterli; sitemap 0.9). */
function toLastmod(d: Date | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0]!;
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().split("T")[0]!;
}

/** Tek sitemap ~50k URL limiti. Aşılırsa sitemap index + sitemap-1.xml, sitemap-2.xml ... chunk'lamaya geçilebilir. */
const SITEMAP_URL_LIMIT = 50_000;

/** Yanlış/typo slug'lar sitemap'e alınmaz; canonical tek girer (308 ile yönlendiriliyor). */
const SITEMAP_EXCLUDE_TYPO_SLUGS = new Set<string>(["pozizyon-zari-siyah"]);

export async function GET(): Promise<Response> {
  const baseUrl = getCanonicalBaseUrl();
  const seen = new Set<string>();
  const now = new Date().toISOString().split("T")[0]!;

  type UrlEntry = { loc: string; lastmod: string; changefreq: string; priority: string };
  const entries: UrlEntry[] = [];

  function add(url: string, lastmod: string, changefreq: string, priority: string): void {
    if (seen.has(url)) return;
    seen.add(url);
    entries.push({ loc: url, lastmod, changefreq, priority });
  }

  // --- Statik ---
  add(baseUrl, now, "daily", "1.0");
  add(`${baseUrl}/hub`, now, "weekly", "0.9");
  add(`${baseUrl}/search`, now, "weekly", "0.6");
  add(`${baseUrl}/categories`, now, "weekly", "0.6");

  // --- Kurumsal ([slug]) ---
  for (const slug of Object.keys(institutionalContent)) {
    if (!isValidSlug(slug)) continue;
    add(`${baseUrl}/${encodeURIComponent(slug)}`, now, "yearly", "0.3");
  }

  // --- Hub (/hub/[hubSlug]) ---
  for (const hubSlug of getAllHubSlugs()) {
    if (!isValidSlug(hubSlug)) continue;
    add(`${baseUrl}/hub/${encodeURIComponent(hubSlug)}`, now, "weekly", "0.8");
  }

  // --- Kategoriler (DB) — [slug] ---
  const categorySlugs = await getAllCategorySlugsForSitemap();
  for (const { slug, updatedAt } of categorySlugs) {
    if (!isValidSlug(slug)) continue;
    add(`${baseUrl}/${encodeURIComponent(slug)}`, toLastmod(updatedAt), "weekly", "0.6");
  }

  // --- Ürünler (DB) — /urun/[slug] (sadece canonical; typo slug'lar 308 ile yönlendiriliyor, sitemap'e girmez) ---
  const productSlugs = await getAllProductSlugsForSitemap();
  for (const { slug, updatedAt } of productSlugs) {
    if (!isValidSlug(slug)) continue;
    if (SITEMAP_EXCLUDE_TYPO_SLUGS.has(slug)) continue;
    add(`${baseUrl}/urun/${encodeURIComponent(slug)}`, toLastmod(updatedAt), "weekly", "0.7");
  }

  // Chunking: entries.length > SITEMAP_URL_LIMIT ise sitemap index + birden fazla sitemap-*.xml üretilebilir.
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (e) =>
        `  <url>\n    <loc>${escapeLoc(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    ),
    "</urlset>",
  ];
  const body = xmlLines.join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "X-SEO-Routes": SEO_DEBUG_HEADER,
    },
  });
}
