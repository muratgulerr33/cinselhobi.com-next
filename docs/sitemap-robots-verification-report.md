# Sitemap / Robots doğrulama raporu

**Tarih:** 2026-02-14  
**Repo:** cinselhobi-com-next

**Güncel (Route Handler dönemi):** Sitemap ve robots artık **explicit Route Handler** ile servis ediliyor: `src/app/sitemap.xml/route.ts` ve `src/app/robots.txt/route.ts`. Metadata route (`sitemap.ts` / `robots.ts`) kullanılmıyor; path bu handler’larla kilitlendiği için root `[slug]` shadow riski yok. Doğrulama: `docs/seo-sitemap-robots.md`.

---

## 1) `src/app/sitemap.xml/route.ts`

| Kontrol | Sonuç |
|--------|--------|
| `/sitemap.xml` 200 + `application/xml` | Evet. `GET` → `Response(xml, { headers: { "Content-Type": "application/xml" } })`. |
| XML standardı (urlset + loc/lastmod) | Evet. `urlset` xmlns `http://www.sitemaps.org/schemas/sitemap/0.9`, her `<url>` içinde `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`. |
| **Önceki durum:** Statik kaç URL? | Sadece **5** statik URL: `/`, `/hub`, `/kadinlara-ozel`, `/erkeklere-ozel`, `/geciktiriciler`. **Ürün ve kategori URL’leri yoktu.** |
| **NOT:** “Tüm ürünler otomatik indexleniyor” | **Yanlış.** Sitemap’te ürün/kategori yoktu; sadece 5 statik sayfa vardı. Düzeltme: sitemap artık DB’den `getAllProductSlugsForSitemap` ve `getAllCategorySlugsForSitemap` ile ürün + kategori URL’lerini ekliyor. |

**Yapılan değişiklik:** Base URL için `getCanonicalBaseUrl()` kullanıldı; sitemap dinamik hale getirildi (async GET, kategori + ürün slug’ları ekleniyor). `<loc>` için XML escape eklendi.

---

## 2) `src/app/robots.txt/route.ts` (explicit Route Handler)

| Kontrol | Sonuç |
|--------|--------|
| `/robots.txt` 200 + `text/plain` | Evet. GET → Response(body, Content-Type: text/plain; charset=utf-8). |
| Sitemap satırı `baseUrl/sitemap.xml` mi? | Evet. Body’de `Sitemap: {getCanonicalBaseUrl()}/sitemap.xml`. |

Metadata route (`robots.ts`) kullanılmıyor; tek kaynak `getCanonicalBaseUrl()`.

---

## 3) Base URL env standardı

| Kaynak | Kanıt |
|--------|--------|
| `SITE_URL` | `src/lib/seo/canonical.ts` → `getCanonicalBaseUrl()`; layout `metadataBase` bunu kullanıyor. |
| `NEXT_PUBLIC_SITE_URL` | Eski: sitemap.xml/route ve robots.ts’te kullanılıyordu. Artık sitemap/robots **tek kaynak** için `getCanonicalBaseUrl()` kullanıyor (yani `SITE_URL`). |
| `AUTH_URL` / `NEXT_PUBLIC_BASE_URL` | `src/actions/checkout.ts`, PayTR callback, paytr-provider: ödeme/email base URL için kullanılıyor (master-pack ile uyumlu). Sitemap/robots ile aynı değil; ödeme tarafı değiştirilmedi. |

**Seçim:** Canonical base (sitemap, robots, metadata) için **tek anahtar:** `SITE_URL`. Değer `src/lib/seo/canonical.ts` içinde normalize ediliyor (https, www). Sitemap ve robots bu fonksiyonu import ediyor.

---

## 4) Özet patch

- **robots.ts:** `NEXT_PUBLIC_SITE_URL` kaldırıldı; `getCanonicalBaseUrl()` import edilip kullanıldı.
- **sitemap.xml/route.ts:**  
  - Base URL → `getCanonicalBaseUrl()`.  
  - `getAllCategorySlugsForSitemap` ve `getAllProductSlugsForSitemap` ile kategori (`/{slug}`) ve ürün (`/urun/{slug}`) URL’leri eklendi.  
  - `<loc>` için XML escape; `lastmod` için DB `updatedAt` kullanıldı.

Yeni endpoint/contract eklenmedi; mevcut route’lar ve `catalog.ts` sitemap fonksiyonları kullanıldı.
