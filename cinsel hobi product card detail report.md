# Ürün Detay Sayfası - Kapsamlı Teknik Rapor

## İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [ProductDetailPage Component](#productdetailpage-component)
3. [Route Yapısı](#route-yapısı)
4. [API Endpoint'leri](#api-endpointleri)
5. [Database Yapısı ve Query'ler](#database-yapısı-ve-queryler)
6. [Bağımlılıklar ve Yardımcı Fonksiyonlar](#bağımlılıklar-ve-yardımcı-fonksiyonlar)
7. [State Yönetimi](#state-yönetimi)
8. [UI/UX Özellikleri](#uiux-özellikleri)
9. [Mobil ve Responsive Özellikler (Mobile-First)](#mobil-ve-responsive-özellikler-mobile-first)
10. [Kullanım Senaryoları](#kullanım-senaryoları)
11. [Dosya Yapısı](#dosya-yapısı)

---

## Genel Bakış

Ürün detay sayfası sistemi, e-ticaret uygulamasında ürünlerin detaylı görüntülenmesi, görsel galeri gösterimi, açıklama ve ilgili ürün önerileri için kullanılan kapsamlı bir component sistemidir. Sistem, Next.js 14+ App Router yapısı üzerine kurulmuştur ve TypeScript ile geliştirilmiştir.

### Temel Özellikler
- Tam ekran ürün detay görüntüleme
- Hero gallery slider (çoklu görsel desteği)
- Ürün bilgileri ve açıklama gösterimi
- Accordion sistem (teslimat, gizlilik bilgileri)
- İlgili ürünler önerisi
- Sticky action bar (fiyat, favori, sepete ekle)
- Loading ve error state yönetimi
- Responsive tasarım
- Dark mode desteği
- Mobil dokunmatik etkileşimler

---

## ProductDetailPage Component

**Dosya:** `src/components/product/product-detail-page.tsx`

### Özellikler
- Tam ekran ürün detay görüntüleme
- Hero gallery slider (çoklu görsel)
- Ürün bilgileri ve açıklama
- Accordion sistem (teslimat, gizlilik bilgileri)
- İlgili ürünler önerisi
- Sticky action bar (fiyat, favori, sepete ekle)
- Loading ve error state yönetimi

### Props
```typescript
{ slug: string }
```

### State Yönetimi
- `product` - Ürün verisi
- `loading` - Yükleme durumu
- `error` - Hata mesajı
- `descriptionExpanded` - Açıklama genişletilme durumu
- `relatedProducts` - İlgili ürünler listesi
- `isFavorite` - Favori durumu
- `activeIndex` - Hero gallery aktif indeks
- `abortControllerRef` - API istek iptal kontrolü

### API İstekleri
1. **Ana Ürün Verisi:** `GET /api/products/${slug}`
   - Ürün detayları
   - Görseller
   - Fiyat bilgileri
   - Stok durumu

2. **İlgili Ürünler:** `GET /api/products/${slug}/related`
   - Aynı kategorideki diğer ürünler
   - Maksimum 10 ürün

### Hero Gallery Özellikleri
- Tek görsel: Basit görüntüleme
- Çoklu görsel: Horizontal slider
  - Snap scroll
  - Touch pan desteği
  - Aktif görsel göstergesi (1/N)
  - Alt kısımda dot navigasyon
  - Desktop ok tuşları (md+)
  - Scroll event ile aktif indeks güncelleme

### Güvenlik Özellikleri
- `stripUnsafeHtml` - XSS koruması için HTML temizleme
- `htmlToPlainText` - HTML'den düz metin çıkarma
- Script ve style tag'lerinin kaldırılması
- Event handler'ların temizlenmesi

### Accordion Sistemi
- Framer Motion animasyon desteği
- Açılır/kapanır içerik
- İçerikler:
  - 📦 Teslimat ve İade Koşulları
  - 🛡️ Gizlilik ve Paketleme Garantisi

### Sticky Action Bar
- Sabit alt bar (z-index: 60)
- Fiyat gösterimi
- Favori butonu
- Sepete ekle butonu
- Safe area inset desteği (iOS)

### İlgili Ürünler Bölümü
- Horizontal scroll
- Link ile detay sayfasına yönlendirme
- Fiyat gösterimi
- Görsel gösterimi

### Yardımcı Fonksiyonlar

#### stripUnsafeHtml
```typescript
function stripUnsafeHtml(input: string): string
```
- XSS koruması için HTML temizleme
- Script tag'lerini kaldırır
- Style tag'lerini kaldırır
- Event handler'ları temizler

#### htmlToPlainText
```typescript
function htmlToPlainText(input: string): string
```
- HTML'den düz metin çıkarma
- SSR-safe fallback
- DOMParser kullanımı (browser'da)

#### AccordionItem Component
```typescript
function AccordionItem({ title, children }: { title: string; children: React.ReactNode })
```
- Accordion item component
- Framer Motion animasyon
- ChevronDown icon
- Açılır/kapanır state yönetimi

---

## Route Yapısı

### 1. Ürün Detay Sayfası (Türkçe)
**Dosya:** `src/app/urun/[slug]/page.tsx`

```typescript
export default function Page() {
  const params = useParams();
  const slug = params?.slug as string;
  
  if (!slug) {
    return <ErrorState />;
  }
  
  return <ProductDetailPage slug={slug} />;
}
```

**Route:** `/urun/[slug]`

### 2. Ürün Detay Sayfası (İngilizce)
**Dosya:** `src/app/product/[slug]/page.tsx`

Aynı yapı, farklı route: `/product/[slug]`

---

## API Endpoint'leri

### 1. Ürün Detay API
**Dosya:** `src/app/api/products/[slug]/route.ts`
**Method:** `GET`
**Route:** `/api/products/[slug]`

#### Response Format
```typescript
{
  id: number;
  wcId: number;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  price: number | null; // kuruş
  regularPrice: number | null; // kuruş
  salePrice: number | null; // kuruş
  currency: string; // default: "TRY"
  images: Array<{ src: string; alt?: string }>;
  sku: string | null;
  stockStatus: string | null;
  stockQuantity: number | null;
}
```

#### Görsel Normalizasyon
- `normalizeImages` fonksiyonu ile görseller normalize edilir
- String array veya object array formatlarını destekler
- Boş görseller filtrelenir

#### Hata Durumları
- `400`: Slug eksik
- `404`: Ürün bulunamadı

---

### 2. İlgili Ürünler API
**Dosya:** `src/app/api/products/[slug]/related/route.ts`
**Method:** `GET`
**Route:** `/api/products/[slug]/related`

#### Response Format
```typescript
Array<{
  id: number;
  slug: string;
  name: string;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  images: Array<{ src: string; alt?: string }>; // Sadece ilk görsel
  stockStatus: string | null;
}>
```

#### Özellikler
- Maksimum 10 ürün döner
- Aynı kategorideki ürünler
- Mevcut ürün hariç
- Sadece ilk görsel döner (performans)

#### Hata Durumları
- `400`: Slug eksik
- Hata durumunda sessizce boş array döner (non-critical)

---

## Database Yapısı ve Query'ler

### Database Schema
**Dosya:** `src/db/schema.ts`

#### Products Table
```typescript
{
  id: serial (PK)
  wcId: integer (unique, not null)
  slug: text (unique, not null)
  name: text (not null)
  status: text (not null) // "publish", "draft", etc.
  type: text (not null)
  sku: text
  price: integer // kuruş cinsinden
  regularPrice: integer // kuruş
  salePrice: integer // kuruş
  currency: text (default: "TRY")
  shortDescription: text
  description: text
  stockStatus: text
  stockQuantity: integer
  images: jsonb // Array formatında
  raw: jsonb (not null) // Ham WooCommerce verisi
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### Categories Table
```typescript
{
  id: serial (PK)
  wcId: integer (unique, not null)
  slug: text (unique, not null)
  name: text (not null)
  parentWcId: integer
  description: text
  imageUrl: text
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### ProductCategories Table (Junction)
```typescript
{
  productId: integer (FK → products.id, cascade delete)
  categoryId: integer (FK → categories.id, cascade delete)
  // Composite primary key
}
```

---

### Database Query Fonksiyonları
**Dosya:** `src/db/queries/catalog.ts`

#### 1. getProductBySlug
```typescript
export async function getProductBySlug(slug: string)
```
- Slug'a göre tek ürün getirir
- Tüm ürün alanlarını döner
- Sonuç yoksa `null` döner

#### 2. getRelatedProductsBySlug
```typescript
export async function getRelatedProductsBySlug(slug: string, limit = 10)
```
- Mevcut ürünün kategorilerini bulur
- Aynı kategorilerdeki diğer ürünleri getirir
- Mevcut ürünü hariç tutar
- Duplicate'leri kaldırır (aynı ürün birden fazla kategoriye bağlı olabilir)
- `status = "publish"` filtresi uygular
- `updatedAt`'e göre sıralar (desc)
- Limit ile sınırlandırır

---

## Bağımlılıklar ve Yardımcı Fonksiyonlar

### 1. Cart Provider (Sepet Yönetimi)
**Dosya:** `src/components/cart/cart-provider.tsx`

#### useCart Hook
```typescript
const { addItem } = useCart();
```

#### addItem Fonksiyonu
```typescript
addItem(
  {
    productId: number,
    slug: string,
    name: string,
    priceCents: number,
    imageUrl?: string | null
  },
  qty?: number // default: 1
)
```

#### Özellikler
- LocalStorage ile kalıcılık
- Cross-tab senkronizasyon (StorageEvent)
- Quantity normalizasyonu (1-99 arası)
- Otomatik duplicate handling (aynı ürün varsa quantity artar)

#### Cart Store
**Dosya:** `src/components/cart/cart-store.ts`
- `CART_STORAGE_KEY = "ch.cart"`
- `loadCart()` - LocalStorage'dan yükleme
- `saveCart(state)` - LocalStorage'a kaydetme
- `normalizeQty(n)` - Miktar normalizasyonu (1-99)

#### Cart Types
**Dosya:** `src/components/cart/cart-types.ts`
```typescript
type CartItem = {
  productId: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  qty: number;
}

type CartState = {
  items: CartItem[];
}
```

---

### 2. Format Fonksiyonları
**Dosya:** `src/lib/format.ts`

#### formatPrice
```typescript
formatPrice(price: number | string | null | undefined): string
```
- Number (kuruş) veya String (TL) formatını destekler
- Türkçe locale formatı: "1.250 TL"
- Null/undefined durumunda boş string döner

---

## State Yönetimi

### ProductDetailPage State
- **Product Data:** API'den fetch edilir, useState ile saklanır
- **Loading State:** Yükleme durumu
- **Error State:** Hata mesajları
- **UI State:** Description expanded, favorite, active image index
- **AbortController:** Component unmount veya slug değişiminde istekleri iptal eder

### Cart State
- **Global Context:** CartProvider ile sağlanır
- **LocalStorage:** Kalıcılık için
- **Hydration:** SSR sonrası client-side hydration

---

## UI/UX Özellikleri

### ProductDetailPage UI

1. **Hero Gallery**
   - Yükseklik: 55vh
   - Snap scroll
   - Touch pan desteği
   - Görsel sayacı (1/N)
   - Dot navigasyon
   - Desktop ok tuşları

2. **Info Block**
   - Ürün adı (h1, 2xl)
   - Trust tags (scrollable)
   - Açıklama (read more/less)

3. **Accordion**
   - Framer Motion animasyon
   - ChevronDown icon
   - Smooth expand/collapse

4. **Related Products**
   - Horizontal scroll
   - 170px genişlik
   - Aspect ratio: 4/5

5. **Sticky Action Bar**
   - Fixed bottom
   - z-index: 60
   - Safe area inset (iOS)
   - Border top
   - Dark mode desteği

6. **Loading State**
   - Skeleton UI
   - Pulse animasyon

7. **Error State**
   - Merkezi hata mesajı
   - Kullanıcı dostu mesajlar

---

## Mobil ve Responsive Özellikler (Mobile-First)

### Genel Yaklaşım
- **Mobile-First Design:** Tüm stiller mobil için optimize edilmiş, desktop için `md:` breakpoint'i ile genişletilmiştir
- **Touch-First Interactions:** Tüm etkileşimler dokunmatik cihazlar için optimize edilmiştir
- **Viewport Units:** `vh` (viewport height) kullanımı ile ekran boyutuna uyumlu tasarım

### Breakpoint'ler
- **Mobile (Default):** 0px - 767px
- **Desktop (md):** 768px ve üzeri
- Tailwind CSS breakpoint sistemi kullanılmaktadır

---

### 1. Hero Gallery - Mobil Davranışları

#### Yükseklik ve Boyutlandırma
- **Yükseklik:** `55vh` (viewport height'ın %55'i)
  - Mobilde: Ekran yüksekliğine göre dinamik
  - Desktop'ta: Aynı oran korunur
- **Genişlik:** `100vw` (tam genişlik)
- **Padding:** `px-4 py-6` (16px yatay, 24px dikey)

#### Touch Etkileşimleri
- **Touch Pan:** `touch-pan-x` - Yatay kaydırma aktif
- **Snap Scroll:** 
  - `snap-x` - Yatay snap
  - `snap-mandatory` - Zorunlu snap
  - `snap-always` - Her zaman snap
  - `snap-start` - Her görsel başlangıçta snap
- **Overscroll:** `overscroll-x-contain` - Yatay overscroll kontrolü
- **Scrollbar:** Gizli (`scrollbar-width:none`, `-webkit-scrollbar:hidden`)

#### Görsel Gösterimi
- **Image Sizes:** `sizes="100vw"` - Tam genişlik için optimize
- **Priority:** İlk görsel `priority={true}` - Above-the-fold optimizasyonu
- **Object Fit:** `object-contain` - Görsel bozulmadan gösterim
- **Mix Blend:** `mix-blend-multiply` (light mode), `mix-blend-normal` (dark mode)

#### Navigasyon Elementleri

**1/N Göstergesi (Top-Right)**
- **Pozisyon:** `absolute top-3 right-3`
- **Boyut:** `text-xs` (12px)
- **Stil:** `bg-black/40`, `backdrop-blur`, `rounded-full`
- **Padding:** `px-2 py-1`
- **Z-index:** `z-20`

**Dot Navigasyon (Bottom-Center)**
- **Pozisyon:** `absolute bottom-3 left-1/2 -translate-x-1/2`
- **Aktif Dot:** `w-4` (16px genişlik), `bg-white`
- **Pasif Dot:** `w-1.5` (6px genişlik), `bg-white/50`
- **Yükseklik:** `h-1.5` (6px)
- **Gap:** `gap-1.5` (6px)
- **Tıklanabilir:** Her dot tıklanabilir, `scrollToIndex` fonksiyonu ile

**Desktop Ok Tuşları (md+)**
- **Görünürlük:** `hidden md:flex` - Sadece 768px+ ekranlarda
- **Boyut:** `h-10 w-10` (40px)
- **Pozisyon:** 
  - Sol: `left-3 top-1/2 -translate-y-1/2`
  - Sağ: `right-3 top-1/2 -translate-y-1/2`
- **Stil:** `bg-black/35`, `backdrop-blur`, `rounded-full`
- **Z-index:** `z-20`

**Favori Butonu (Hero Overlay)**
- **Pozisyon:** `absolute bottom-4 right-4`
- **Boyut:** `p-2` (8px padding)
- **Icon Boyutu:** `w-6 h-6` (24px)
- **Touch Feedback:** `active:scale-75` - Basıldığında %75 küçülme
- **Z-index:** `z-30`
- **Stil:** `bg-white/80 dark:bg-black/80`, `backdrop-blur-sm`

---

### 2. Info Block - Mobil Davranışları

#### Ürün Başlığı
- **Font Size:** `text-2xl` (24px) - Mobil ve desktop'ta aynı
- **Font Weight:** `font-bold` (700)
- **Padding:** `px-5 pt-6` (20px yatay, 24px üst)
- **Margin Bottom:** `mb-3` (12px)

#### Trust Tags (Scrollable)
- **Container:** `flex gap-2 overflow-x-auto`
- **Scrollbar:** Gizli (`.scrollbar-hide`)
- **Max Width:** `max-w-full pr-5` - Sağ padding scroll için
- **Padding Bottom:** `pb-2` (8px)
- **Tag Stilleri:**
  - **Font Size:** `text-xs` (12px)
  - **Font Weight:** `font-semibold` (600)
  - **Padding:** `px-3 py-1.5` (12px yatay, 6px dikey)
  - **Border Radius:** `rounded-full`
  - **Whitespace:** `whitespace-nowrap` - Tek satır
  - **Flex Shrink:** `flex-shrink-0` - Küçülmez

---

### 3. Açıklama Bölümü - Mobil Davranışları

#### Read More/Less
- **Padding:** `px-5 pt-4` (20px yatay, 16px üst)
- **Font Size:** `text-sm` (14px)
- **Line Height:** `leading-relaxed` (1.625)
- **Karakter Limiti:** 220 karakter (mobilde kısaltılmış gösterim)
- **Buton Stili:** `text-sm font-semibold`

#### Açıklama Metni
- **Renk:** `text-gray-600 dark:text-gray-300`
- **HTML Rendering:** `dangerouslySetInnerHTML` (sanitize edilmiş)

---

### 4. Accordion Sistemi - Mobil Davranışları

#### Accordion Item
- **Border:** `border-b border-gray-100` - Alt border
- **Button:**
  - **Min Height:** `min-h-[44px]` - iOS touch target standardı (44x44px)
  - **Padding:** `py-4 px-5` (16px dikey, 20px yatay)
  - **Width:** `w-full` - Tam genişlik
  - **Display:** `flex items-center justify-between`

#### Accordion İçerik
- **Padding:** `px-5 pb-4` (20px yatay, 16px alt)
- **Font Size:** `text-sm` (14px)
- **Line Height:** `leading-relaxed` (1.625)

#### Animasyon
- **Duration:** `0.3s`
- **Easing:** `easeInOut`
- **Framer Motion:** Height ve opacity animasyonu

---

### 5. İlgili Ürünler - Mobil Davranışları

#### Container
- **Margin Top:** `mt-8` (32px)
- **Padding:** `px-5 pt-6` (20px yatay, 24px üst)
- **Başlık:** `text-lg font-bold mb-4` (18px, 700 weight, 16px margin bottom)

#### Horizontal Scroll
- **Container:** `flex overflow-x-auto pb-6`
- **Scrollbar:** Gizli (`.scrollbar-hide`)
- **Max Width:** `max-w-full`

#### Ürün Kartı
- **Genişlik:** `w-[170px]` - Sabit genişlik (mobil için optimize)
- **Flex Shrink:** `flex-shrink-0` - Küçülmez
- **Min Width:** `min-w-0` - Overflow kontrolü
- **Border Radius:** `rounded-xl` (12px)
- **Touch Feedback:** `active:scale-[0.98]` - Basıldığında %98 küçülme
- **Aspect Ratio:** `aspect-[4/5]` - Görsel alanı 4:5 oranı
- **Görsel Padding:** `p-3` (12px)
- **İçerik Padding:** `p-3` (12px)
- **Image Sizes:** `sizes="170px"` - Sabit genişlik için optimize

#### Ürün Bilgileri
- **Başlık:** `text-sm font-medium line-clamp-2` (14px, 2 satır limit)
- **Fiyat:** `text-base font-semibold` (16px, 600 weight)

---

### 6. Sticky Action Bar - Mobil Davranışları

#### Container
- **Pozisyon:** `fixed bottom-0 left-0 right-0`
- **Z-index:** `z-[60]` (60)
- **Background:** `bg-white dark:bg-black`
- **Border:** `border-t border-gray-100 dark:border-gray-800`
- **Padding:** `p-4` (16px)
- **Safe Area:** `pb-[calc(1rem+env(safe-area-inset-bottom))]` - iOS notch/home indicator için

#### İçerik Layout
- **Display:** `flex items-center gap-3`
- **Gap:** `gap-3` (12px)

#### Fiyat Gösterimi
- **Font Size:** `text-2xl` (24px)
- **Font Weight:** `font-bold` (700)

#### Favori Butonu
- **Boyut:** `h-12 w-12` (48x48px) - iOS touch target standardı
- **Border Radius:** `rounded-xl` (12px)
- **Border:** `border border-gray-200 dark:border-gray-700`
- **Touch Feedback:** `active:scale-[0.98]` - Basıldığında %98 küçülme
- **Icon Boyutu:** `w-5 h-5` (20px)

#### Sepete Ekle Butonu
- **Flex:** `flex-1` - Kalan alanı doldurur
- **Yükseklik:** `h-12` (48px) - iOS touch target standardı
- **Border Radius:** `rounded-xl` (12px)
- **Font Weight:** `font-semibold` (600)
- **Gap:** `gap-2` (8px) - Icon ve text arası
- **Icon Boyutu:** `w-5 h-5` (20px)
- **Touch Feedback:** `active:scale-[0.98]` - Basıldığında %98 küçülme

#### Bottom Padding (İçerik için)
- **Padding Bottom:** `pb-32` (128px) - Sticky bar için alan bırakır

---

### 7. Responsive Padding ve Spacing

#### Genel Padding Değerleri
- **Ana Container:** `px-5` (20px) - Mobil ve desktop'ta aynı
- **Hero Gallery:** `px-4 py-6` (16px yatay, 24px dikey)
- **Info Block:** `px-5 pt-6` (20px yatay, 24px üst)
- **Açıklama:** `px-5 pt-4` (20px yatay, 16px üst)
- **Accordion:** `px-5` (20px yatay)
- **İlgili Ürünler:** `px-5 pt-6` (20px yatay, 24px üst)

#### Gap Değerleri
- **Trust Tags:** `gap-2` (8px)
- **Action Bar:** `gap-3` (12px)
- **Dot Navigation:** `gap-1.5` (6px)
- **Sepete Ekle Butonu:** `gap-2` (8px)

#### Margin Değerleri
- **Accordion Top:** `mt-6` (24px)
- **İlgili Ürünler Top:** `mt-8` (32px)
- **Başlık Bottom:** `mb-3` (12px)
- **İlgili Ürünler Başlık Bottom:** `mb-4` (16px)

---

### 8. Touch Event Optimizasyonları

#### Active Scale Animasyonları
- **Favori Butonu (Hero):** `active:scale-75` - %75 küçülme
- **Favori Butonu (Action Bar):** `active:scale-[0.98]` - %98 küçülme
- **Sepete Ekle Butonu:** `active:scale-[0.98]` - %98 küçülme
- **İlgili Ürün Kartı:** `active:scale-[0.98]` - %98 küçülme

#### Touch Action
- **Hero Gallery:** `touch-pan-x` - Sadece yatay kaydırma
- **Scroll Containers:** `overscroll-x-contain` - Overscroll kontrolü

#### Minimum Touch Target
- **Accordion Button:** `min-h-[44px]` - iOS standardı
- **Action Bar Butonları:** `h-12` (48px) - iOS standardı
- **Dot Navigation:** Tıklanabilir alan yeterli

---

### 9. Typography - Responsive Değerler

#### Font Size Hiyerarşisi
- **H1 (Ürün Adı):** `text-2xl` (24px) - Mobil ve desktop'ta aynı
- **H2 (İlgili Ürünler):** `text-lg` (18px)
- **Body (Açıklama):** `text-sm` (14px)
- **Trust Tags:** `text-xs` (12px)
- **Fiyat (Action Bar):** `text-2xl` (24px)
- **İlgili Ürün Fiyat:** `text-base` (16px)
- **İlgili Ürün Başlık:** `text-sm` (14px)

#### Font Weight
- **Bold:** `font-bold` (700) - Başlıklar, fiyat
- **Semibold:** `font-semibold` (600) - Butonlar, trust tags
- **Medium:** `font-medium` (500) - İlgili ürün başlıkları

---

### 10. Dark Mode - Mobil Uyumluluğu

#### Renk Değerleri
- **Background:** `bg-white dark:bg-background`
- **Text:** `text-gray-900 dark:text-white`
- **Secondary Text:** `text-gray-600 dark:text-gray-300`
- **Borders:** `border-gray-100 dark:border-gray-800`
- **Action Bar:** `bg-white dark:bg-black`
- **Sepete Ekle Butonu:** `bg-black dark:bg-white text-white dark:text-black`

#### Mix Blend Mode
- **Light Mode:** `mix-blend-multiply` - Görseller için
- **Dark Mode:** `mix-blend-normal` - Görseller için

---

### 11. Performance Optimizasyonları (Mobil)

#### Image Optimization
- **Priority Loading:** İlk görsel `priority={true}`
- **Responsive Sizes:** `sizes="100vw"` (hero), `sizes="170px"` (related)
- **Lazy Loading:** İlk görsel dışındakiler otomatik lazy load

#### Scroll Optimization
- **requestAnimationFrame:** Scroll event'leri optimize edilmiş
- **RAF Cleanup:** Component unmount'ta temizlenir

#### State Optimization
- **useMemo:** Derived values memoize edilmiş
- **useRef:** DOM referansları ref ile tutulmuş

---

### 12. Accessibility (Mobil)

#### Touch Target Sizes
- **Minimum:** 44x44px (iOS standardı)
- **Accordion:** `min-h-[44px]`
- **Action Bar Butonları:** `h-12 w-12` (48x48px)

#### ARIA Labels
- **Favori Butonları:** `aria-label` ile açıklama
- **Görsel Navigasyon:** `aria-label` ile açıklama
- **Accordion:** `aria-expanded` state

#### Focus States
- **Focus Visible:** `focus-visible:outline-none focus-visible:ring-2`
- **Ring Color:** `focus-visible:ring-black/30`

---

### 13. Mobile-Specific CSS Özellikleri

#### Scrollbar Hiding
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

#### Line Clamp
```css
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

#### Safe Area Insets
- **iOS Notch/Home Indicator:** `env(safe-area-inset-bottom)`
- **Action Bar Padding:** `pb-[calc(1rem+env(safe-area-inset-bottom))]`

---

### 14. Responsive Breakpoint Kullanımı

#### Desktop-Only Elements
- **Ok Tuşları:** `hidden md:flex` - 768px+ görünür
- **Breakpoint:** `md:` (768px)

#### Mobile-First Approach
- Tüm stiller mobil için yazılmış
- Desktop için `md:` prefix'i ile genişletilmiş
- Breakpoint olmadan yazılan stiller mobil için geçerlidir

---

### 15. Viewport ve Container Ayarları

#### Root Container
- **Min Height:** `min-h-screen` - Tam ekran yüksekliği
- **Overflow:** `overflow-x-hidden` - Yatay scroll engellenmiş
- **Min Width:** `min-w-0` - Flexbox overflow kontrolü
- **Z-index:** `z-50` - Üst katmanda

#### Hero Gallery Container
- **Height:** `55vh` - Viewport height'ın %55'i
- **Width:** `100vw` - Tam genişlik
- **Position:** `relative` - Absolute child'lar için

---

### 16. Mobil Test Edilmesi Gereken Senaryolar

1. **Hero Gallery Swipe**
   - Yatay kaydırma çalışıyor mu?
   - Snap scroll düzgün çalışıyor mu?
   - Dot navigation tıklanabilir mi?

2. **Sticky Action Bar**
   - Alt kısımda sabit kalıyor mu?
   - iOS safe area düzgün çalışıyor mu?
   - Butonlar tıklanabilir mi?

3. **Trust Tags Scroll**
   - Yatay scroll çalışıyor mu?
   - Scrollbar gizli mi?

4. **İlgili Ürünler**
   - Yatay scroll çalışıyor mu?
   - Kartlar tıklanabilir mi?
   - Touch feedback çalışıyor mu?

5. **Accordion**
   - Açılır/kapanır çalışıyor mu?
   - Touch target yeterli mi?

6. **Açıklama Read More**
   - Kısaltılmış gösterim çalışıyor mu?
   - "Devamını Oku" butonu çalışıyor mu?

---

### 17. Mobil Performans Metrikleri

#### Önerilen Metrikler
- **First Contentful Paint (FCP):** < 1.8s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Time to Interactive (TTI):** < 3.8s
- **Cumulative Layout Shift (CLS):** < 0.1

#### Optimizasyonlar
- Priority image loading
- Lazy loading (non-critical images)
- requestAnimationFrame optimizasyonu
- Memoized derived values

---

## Kullanım Senaryoları

### Senaryo 1: Ürün Detay Sayfası Görüntüleme
```
/urun/[slug] Route → ProductDetailPage → API Calls → Render
```

### Senaryo 2: Sepete Ekleme
```
ProductDetailPage → Sticky Action Bar → useCart.addItem → CartProvider → LocalStorage
```

### Senaryo 3: İlgili Ürün Keşfi
```
ProductDetailPage → Related API → Related Products Section → Product Links → New Detail Page
```

### Senaryo 4: Favori İşlemleri
```
ProductDetailPage → Heart Button → Local State Toggle
```

### Senaryo 5: Görsel Galeri Navigasyonu
```
ProductDetailPage → Hero Gallery → Scroll/Touch → Active Index Update
```

---

## Dosya Yapısı

```
src/
├── components/
│   └── product/
│       ├── product-detail-page.tsx  # Ürün detay sayfası componenti
│       └── product-detail-page.tsx.backup  # Yedek dosya
├── app/
│   ├── urun/
│   │   └── [slug]/
│   │       └── page.tsx              # Türkçe route
│   ├── product/
│   │   └── [slug]/
│   │       └── page.tsx              # İngilizce route
│   └── api/
│       └── products/
│           └── [slug]/
│               ├── route.ts          # Ürün detay API
│               └── related/
│                   └── route.ts      # İlgili ürünler API
├── db/
│   ├── schema.ts                     # Database schema
│   └── queries/
│       └── catalog.ts                # Catalog query fonksiyonları
└── lib/
    └── format.ts                     # Format fonksiyonları
```

---

## Teknik Detaylar

### Performans Optimizasyonları
1. **Image Optimization**
   - Next.js Image component kullanımı
   - Priority prop (above-the-fold görseller için)
   - Responsive sizes attribute
   - Lazy loading (priority olmayan görseller)

2. **API Optimization**
   - AbortController ile gereksiz isteklerin iptali
   - Related products için sadece ilk görsel
   - Error handling ile graceful degradation

3. **State Optimization**
   - useMemo ile derived values
   - useRef ile DOM referansları
   - requestAnimationFrame ile scroll event optimization

### Güvenlik Önlemleri
1. **XSS Protection**
   - HTML sanitization (stripUnsafeHtml)
   - Script/style tag removal
   - Event handler removal

2. **Input Validation**
   - Slug validation
   - Price validation
   - Image URL validation

3. **Error Handling**
   - Try-catch blokları
   - Graceful error messages
   - AbortError handling

### Accessibility (A11y)
1. **Semantic HTML**
   - Proper heading hierarchy
   - Button elements
   - Link elements

2. **ARIA Labels**
   - Favori butonları için aria-label
   - Görsel navigasyon için aria-label
   - Accordion için aria-expanded

3. **Keyboard Navigation**
   - Focus visible states
   - Tab order
   - Enter/Space key support

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Touch event support
- CSS Grid/Flexbox support
- ES6+ JavaScript features

---

## Bağımlılık Listesi

### NPM Paketleri
- `next` - Next.js framework
- `react` - React library
- `react-dom` - React DOM
- `framer-motion` - Animasyon kütüphanesi
- `lucide-react` - Icon library
- `tailwindcss` - CSS framework
- `drizzle-orm` - ORM (database queries)

### Internal Dependencies
- `@/components/cart/cart-provider` - Cart context
- `@/lib/format` - Format utilities
- `@/db/queries/catalog` - Database queries
- `@/db/connection` - Database connection
- `@/db/schema` - Database schema

---

## Notlar ve Öneriler

### Mevcut Durum
- Sistem stabil çalışıyor
- TypeScript type safety mevcut
- Responsive tasarım uyumlu
- Dark mode desteği var

### Potansiyel İyileştirmeler
1. **Favori Yönetimi**
   - Şu anda local state, backend entegrasyonu eklenebilir
   - Favori listesi sayfası eklenebilir

2. **Görsel Optimizasyonu**
   - WebP format desteği
   - Lazy loading iyileştirmeleri
   - Blur placeholder

3. **Performance**
   - React Query veya SWR entegrasyonu
   - API response caching
   - Image CDN kullanımı

4. **Analytics**
   - Ürün görüntüleme tracking
   - Sepete ekleme tracking
   - İlgili ürün tıklama tracking

5. **SEO**
   - Meta tags (Open Graph, Twitter Cards)
   - Structured data (JSON-LD)
   - Sitemap entegrasyonu

---

## Sonuç

Ürün detay sayfası sistemi, modern web standartlarına uygun, performanslı ve kullanıcı dostu bir yapıya sahiptir. Component-based mimari, type-safe TypeScript kullanımı ve responsive tasarım ile güçlü bir e-ticaret deneyimi sunmaktadır. Sistem, genişletilebilir ve bakımı kolay bir yapıda tasarlanmıştır.

---

**Rapor Tarihi:** 2024
**Versiyon:** 2.0
**Hazırlayan:** AI Assistant
