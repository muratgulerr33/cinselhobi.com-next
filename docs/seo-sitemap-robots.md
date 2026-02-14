# SEO: Sitemap, robots, canonical URL

## Canonical base URL

- **Env key:** `SITE_URL` (server). `getCanonicalBaseUrl()` ([src/lib/seo/canonical.ts](src/lib/seo/canonical.ts)) bu key ile canonical base URL üretir.
- Sitemap, robots.txt, metadataBase ve JSON-LD’deki mutlak URL’ler bu değeri kullanır. Çift kaynak olmaması için tek kaynak olarak `SITE_URL` kullanılır.

## Sitemap

- **Route:** [src/app/sitemap.xml/route.ts](src/app/sitemap.xml/route.ts) — **explicit Route Handler**. Prod’da `/sitemap.xml` bu handler ile servis edilir; root `[slug]` ile shadow edilmez.
- **Çıktı:** Tek XML sitemap (sitemaps.org/0.9): statik (/ , /hub, /search, /categories), kurumsal sayfalar, hub slug’ları, DB’den kategoriler ve ürünler. Tüm URL’ler absolute. `lastmod` DB `updatedAt` veya şu anki tarih.
- **Cache:** `revalidate = 3600`. Response: `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`.
- **Debug:** `X-SEO-Routes: sitemap-handler-v1` — deploy’un güncel build’i kullandığını doğrulamak için.
- **Limit:** Tek sitemap ~50.000 URL; aşılırsa sitemap index + chunk’lara geçiş için kod içi yapı/yorum hazır.

## Robots

- **Route:** [src/app/robots.txt/route.ts](src/app/robots.txt/route.ts) — **explicit Route Handler**. Prod’da `/robots.txt` bu handler ile servis edilir.
- **Cache:** `revalidate = 86400`. Response: `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=86400`.
- **İçerik:** User-Agent: *, Allow: /, Disallow: /account, /cart, /checkout, /admin, /api/auth, Host, **Sitemap: {baseUrl}/sitemap.xml**.
- **Debug:** `X-SEO-Routes: robots-handler-v1`.

## Doğrulama komutları ve beklenen çıktılar

### Production

```bash
# 200 + application/xml + X-SEO-Routes header
curl -sI https://www.cinselhobi.com/sitemap.xml
# Beklenen: HTTP/1.1 200, Content-Type: application/xml; charset=utf-8, X-SEO-Routes: sitemap-handler-v1

# XML başı ve urlset
curl -s https://www.cinselhobi.com/sitemap.xml | head
# Beklenen: <?xml ... <urlset ...><url><loc>https://...

# Örnek loc satırları
curl -s https://www.cinselhobi.com/sitemap.xml | grep -o '<loc>[^<]*</loc>' | head

# robots.txt içinde Sitemap satırı
curl -s https://www.cinselhobi.com/robots.txt
# Beklenen: Sitemap: https://www.cinselhobi.com/sitemap.xml görünsün
```

### Local (build + start sonrası)

```bash
npm run build
PORT=3001 npm start

# Sitemap: 200 + application/xml + X-SEO-Routes
curl -sI http://localhost:3001/sitemap.xml

# Sitemap body (XML)
curl -s http://localhost:3001/sitemap.xml | head

# Robots: Sitemap satırı
curl -s http://localhost:3001/robots.txt

# Bir ürün slug’ı alıp 200 (308 değil) kontrolü
curl -s http://localhost:3001/sitemap.xml | grep -o '/urun/[^<]*' | head -1
# Çıkan slug için:
curl -sI http://localhost:3001/urun/<slug>
# Beklenen: 200 OK
```

## Notlar

- Metadata route (`sitemap.ts` / `robots.ts`) kullanılmıyor; explicit Route Handler’lar path’i kilitleyerek shadow riskini sıfırlar.
- JSON-LD: Ürün/kategori sayfalarında view-source ile `application/ld+json` script blokları kontrol edilir.
