# 05-storefront-mvp-ui-routing.md

Tarih: 2025-12-26  
Kapsam: Cinselhobi Next’te storefront MVP (UI iskeleti + DB katalog + local sepet) + URL routing refactor + hukuki/about/support/account sayfaları.

## 0) Mevcut altyapı varsayımları
- Next.js App Router çalışıyor.
- Postgres docker ile localde ayakta.
- Drizzle schema + migration hazır.
- Woo import script çalışıyor (sample import ile ürün/kategori geldi).
- Tailwind v4 kullanılıyor (tokenlar CSS tarafında).

---

## 1) Design System ve Theme altyapısı (Token + Toggle)
### Yapılanlar
- Başka projedeki `page.tsx` içinden **CSS variable tokenlar** çıkarılıp projeye entegre edildi:
  - `:root` (light)
  - `.dark` (dark)
- Tailwind v4 uyumu için tokenlar `globals.css` + `@theme` yaklaşımıyla Tailwind class’larına bağlandı.
- Theme toggle altyapısı kuruldu:
  - Default: system preference
  - Persist: localStorage
  - HTML’de `.dark` class toggle
  - İlk paint’te flash olmaması için head’e init script eklendi

### İlgili dosyalar
- `src/app/globals.css`
- `src/components/theme/theme-script.ts`
- `src/components/theme/theme-provider.tsx`
- `src/components/theme/theme-toggle.tsx`
- `src/app/layout.tsx`

### Debug
- Token doğrulama sayfası:
  - `src/app/styleguide/page.tsx`
  - URL: `/styleguide`

---

## 2) App Shell (Mobile hissi)
### Yapılanlar
- Üst bar + container + spacing standardı kuruldu.
- TopBar: logo + ikonlar + theme toggle.

### Dosyalar
- `src/components/app/top-bar.tsx`
- `src/app/layout.tsx`

---

## 3) Katalog: DB’den okuma + route’lar (MVP browsing)
### Yapılanlar
- Drizzle üzerinden katalog sorguları yazıldı:
  - top categories
  - latest products
  - category by slug + products by category
  - product by slug + product categories
- Sayfalar:
  - Home vitrini
  - Kategori sayfası
  - Ürün detay sayfası
  - loading skeleton ve not-found

### Dosyalar
- `src/db/queries/catalog.ts`
- `src/lib/format.ts` (formatPrice + image url helper)
- `src/components/catalog/category-grid.tsx`
- `src/components/catalog/product-card.tsx`
- `src/components/catalog/product-grid.tsx`
- `src/app/page.tsx`
- (başlangıçta) `src/app/product-category/[slug]/page.tsx`
- (başlangıçta) `src/app/product/[slug]/page.tsx`
- `src/app/not-found.tsx`

---

## 4) Sepet (Client-side, localStorage)
### Yapılanlar
- Tamamen client-side sepet:
  - localStorage key: `ch.cart`
  - context provider + hook
  - cross-tab sync (storage event)
- TopBar’da sepet badge
- `/cart` sayfası (liste, qty +/-, sil, temizle, subtotal)
- Ürün detayda sticky “Sepete Ekle” gerçek çalışır

### Dosyalar
- `src/components/cart/cart-types.ts`
- `src/components/cart/cart-store.ts`
- `src/components/cart/cart-provider.tsx`
- `src/components/cart/cart-icon-button.tsx`
- `src/components/cart/add-to-cart-bar.tsx`
- `src/app/cart/page.tsx`
- `src/components/app/top-bar.tsx` (badge entegrasyonu)
- `src/app/layout.tsx` (CartProvider sarımı)

---

## 5) Routing Refactor — Kategori URL’leri root’a taşındı
### Hedef URL
- Kategori (parent/child fark etmez, flat):
  - `/{categorySlug}`
  - Örn: `/erkeklere-ozel`, `/penis-pompalari`

### Yapılanlar
- Root dynamic kategori route eklendi:
  - `src/app/[slug]/page.tsx`
- Reserved slug koruması eklendi (account/urun/cart/about/support/styleguide vb.).
- Kategori linkleri güncellendi:
  - Eski: `/product-category/{slug}`
  - Yeni: `/{slug}`

### (Geçiş dönemi) Eski kategori route
- Başlangıçta: `/product-category/[slug]` sayfası yeni URL’ye redirect ediyordu.
  - Not: Daha sonra redirectleri kaldırma kararı alınırsa bu klasör silinebilir.

### Dosyalar
- `src/app/[slug]/page.tsx`
- `src/app/[slug]/loading.tsx`
- `src/components/catalog/category-grid.tsx`
- `src/app/product/[slug]/page.tsx` (kategori chip linkleri)

---

## 6) Routing Refactor — Ürün URL’leri /urun altına taşındı
### Hedef URL
- Ürün detay:
  - `/urun/{productSlug}`
  - Örn: `/urun/cabs-glide-kayganlastirici-jel-250ml`

### Yapılanlar
- Yeni ürün route eklendi:
  - `src/app/urun/[slug]/page.tsx`
  - `src/app/urun/[slug]/loading.tsx`
- Ürün linkleri güncellendi:
  - ProductCard linkleri `/urun/...`
  - Cart içindeki ürün linkleri `/urun/...`

### (Geçiş dönemi) Eski ürün route
- Başlangıçta: `/product/[slug]` yeni URL’ye redirect ediyordu.
  - Not: Redirect istenmiyorsa bu klasör silinebilir.

### Dosyalar
- `src/app/urun/[slug]/page.tsx`
- `src/app/urun/[slug]/loading.tsx`
- `src/components/catalog/product-card.tsx`
- `src/app/cart/page.tsx`
- `src/app/product/[slug]/page.tsx` (redirect veya silinecek)

---

## 7) Hukuki / About / Support (MD’den)
### İçerik kaynağı
- Repo kökünde tek dosya:
  - `/<repoRoot>/hukuki.md`

### Hedef URL’ler
- `/gizlilik-ve-guvenlik`
- `/odeme-ve-teslimat`
- `/cayma-ve-iade-kosullari`
- `/mesafeli-satis-sozlesmesi`
- `/about`
- `/support`

### Yapılanlar
- `hukuki.md` parse eden utility eklendi (özel karakterli başlıklar dahil daha toleranslı).
- Minimal markdown renderer eklendi (dependency yok).
- Sayfa şablonu oluşturuldu.

### Dosyalar
- `hukuki.md` (repo root)
- `src/lib/hukuki.ts`
- `src/components/content/markdown.tsx`
- `src/components/content/static-page.tsx`
- `src/app/gizlilik-ve-guvenlik/page.tsx`
- `src/app/odeme-ve-teslimat/page.tsx`
- `src/app/cayma-ve-iade-kosullari/page.tsx`
- `src/app/mesafeli-satis-sozlesmesi/page.tsx`
- `src/app/about/page.tsx`
- `src/app/support/page.tsx`

---

## 8) Account alanı (placeholder)
### Hedef URL
- `/account`
- `/account/orders`
- `/account/wishlist`
- `/account/coupons`
- `/account/addresses`
- `/account/settings`

### Yapılanlar
- Hepsi şimdilik placeholder (auth yok).

### Dosyalar
- `src/app/account/page.tsx`
- `src/app/account/orders/page.tsx`
- `src/app/account/wishlist/page.tsx`
- `src/app/account/coupons/page.tsx`
- `src/app/account/addresses/page.tsx`
- `src/app/account/settings/page.tsx`

---

## 9) URL Haritası (son durum)
### Aktif
- Home: `/`
- Styleguide: `/styleguide`
- Cart: `/cart`
- Kategori: `/{slug}`
- Ürün: `/urun/{slug}`
- Hukuki/About/Support: yukarıdaki static root sayfalar
- Account: `/account/...`

### Geçiş (varsa)
- `/product/{slug}` -> `/urun/{slug}` (redirect veya sil)
- `/product-category/{slug}` -> `/{slug}` (redirect veya sil)

---

## 10) Test komutları
- `docker compose up -d`
- (sample import) `WOO_AUTH_MODE=query WOO_IMPORT_MODE=sample WOO_IMPORT_LIMIT=20 npm run woo:import`
- `npm run build`
- `npm run dev`

### Manuel smoke test linkleri
- `/`
- `/styleguide`
- `/cart`
- `/{categorySlug}`
- `/urun/{productSlug}`
- `/gizlilik-ve-guvenlik`
- `/mesafeli-satis-sozlesmesi`
- `/account`
