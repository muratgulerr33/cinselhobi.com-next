const CANONICAL_HOST = "www.cinselhobi.com";
const CANONICAL_BASE = `https://${CANONICAL_HOST}`;

/**
 * Tek canonical base URL (www zorunlu).
 * Öncelik: SITE_URL → hardcoded https://www.cinselhobi.com
 * Normalize: https://, host www.cinselhobi.com (cinselhobi.com → www), sondaki slash yok.
 */
export function getCanonicalBaseUrl(): string {
  const raw = process.env.SITE_URL ?? CANONICAL_BASE;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return CANONICAL_BASE;
  }

  url.protocol = "https:";
  const host = url.hostname.toLowerCase();
  if (host === "cinselhobi.com") {
    url.hostname = CANONICAL_HOST;
  } else if (host !== CANONICAL_HOST) {
    url.hostname = CANONICAL_HOST;
  }
  url.port = "";
  let out = url.origin;
  if (out.endsWith("/")) {
    out = out.slice(0, -1);
  }
  return out;
}
