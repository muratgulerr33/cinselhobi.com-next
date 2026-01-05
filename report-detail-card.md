# Product Detail Page Component - Kapsamlı Dokümantasyon

## Genel Bakış

**Dosya Yolu:** `src/components/product/product-detail-page.tsx`  
**Component Adı:** `ProductDetailPage`  
**Tip:** Client Component (`"use client"`)  
**Route:** `/urun/[slug]` (via `src/app/urun/[slug]/page.tsx`)

Bu component, e-ticaret sitesinde tek bir ürünün detay sayfasını render eden, minimal ve odaklanmış bir ürün detay kartıdır. Component, ürün görselleri, başlık, açıklama ve sepete ekleme işlevselliği sağlar.

---

## Component Yapısı

### 1. TypeScript Interfaces

#### `ProductImage`
```typescript
interface ProductImage {
  src: string;        // Görsel URL'i (zorunlu)
  alt?: string;       // Alternatif metin (opsiyonel)
}
```

#### `Product`
```typescript
interface Product {
  id: number;                    // Veritabanı ID
  wcId: number;                  // WooCommerce ID
  slug: string;                  // URL slug (örn: "urun-adi")
  name: string;                  // Ürün adı
  description: string | null;    // HTML açıklama
  shortDescription: string | null; // Kısa açıklama
  price: number | null;          // Fiyat (kuruş cinsinden)
  regularPrice: number | null;   // Normal fiyat
  salePrice: number | null;      // İndirimli fiyat
  currency: string;              // Para birimi (örn: "TRY")
  images: ProductImage[];        // Görsel dizisi
  sku: string | null;            // SKU kodu
  stockStatus: string | null;     // Stok durumu
  stockQuantity: number | null;  // Stok miktarı
}
```

### 2. Props

```typescript
ProductDetailPage({ slug: string })
```

- **slug:** Ürünün URL slug'ı (örn: "urun-adi")
- **Tip:** `string`
- **Zorunlu:** Evet

### 3. State Yönetimi

#### React State Hooks

```typescript
const [product, setProduct] = useState<Product | null>(null);
```
- **Amaç:** API'den gelen ürün verisini saklar
- **Başlangıç:** `null`
- **Güncelleme:** `useEffect` içinde API çağrısı sonrası

```typescript
const [loading, setLoading] = useState(true);
```
- **Amaç:** Yükleme durumunu takip eder
- **Başlangıç:** `true`
- **Güncelleme:** API çağrısı başında `true`, sonunda `false`

```typescript
const [error, setError] = useState<string | null>(null);
```
- **Amaç:** Hata mesajlarını saklar
- **Başlangıç:** `null`
- **Güncelleme:** API hatalarında mesaj set edilir

```typescript
const [descriptionExpanded, setDescriptionExpanded] = useState(false);
```
- **Amaç:** Açıklama metninin genişletilip genişletilmediğini kontrol eder
- **Başlangıç:** `false` (kapalı)
- **Güncelleme:** "Devamını Oku" / "Kapat" butonları ile toggle edilir

```typescript
const [activeIndex, setActiveIndex] = useState(0);
```
- **Amaç:** Galeri slider'ında aktif görselin index'ini tutar
- **Başlangıç:** `0` (ilk görsel)
- **Güncelleme:** Scroll event'i ile güncellenir

#### React Refs

```typescript
const abortControllerRef = useRef<AbortController | null>(null);
```
- **Amaç:** API çağrılarını iptal etmek için AbortController saklar
- **Kullanım:** Component unmount veya slug değiştiğinde önceki istekleri iptal eder

```typescript
const scrollerRef = useRef<HTMLDivElement | null>(null);
```
- **Amaç:** Galeri slider scroll container'ına referans
- **Kullanım:** Programatik scroll işlemleri için

```typescript
const rafRef = useRef<number | null>(null);
```
- **Amaç:** `requestAnimationFrame` ID'sini saklar
- **Kullanım:** Scroll event handler'ında performans optimizasyonu için

### 4. Context Hooks

```typescript
const { addItem } = useCart();
```
- **Kaynak:** `@/components/cart/cart-provider`
- **Amaç:** Sepete ürün ekleme fonksiyonunu sağlar
- **Kullanım:** `handleAddToCart` fonksiyonunda

---

## Utility Fonksiyonlar

### `stripUnsafeHtml(input: string): string`

**Amaç:** HTML içeriğinden güvenlik riski oluşturan elementleri temizler.

**Temizleme Adımları:**
1. `<script>` tag'leri ve içerikleri kaldırılır
2. `<style>` tag'leri ve içerikleri kaldırılır
3. Event handler attribute'ları kaldırılır (örn: `onclick`, `onerror`)

**Kullanım:** `description` ve `shortDescription` render edilmeden önce sanitize edilir.

**Örnek:**
```typescript
stripUnsafeHtml('<p>Test</p><script>alert("xss")</script>')
// Sonuç: '<p>Test</p>'
```

### `htmlToPlainText(input: string): string`

**Amaç:** HTML içeriğini düz metne çevirir.

**İşlem Sırası:**
1. Önce `stripUnsafeHtml` ile temizlenir
2. SSR-safe fallback: Regex ile tüm HTML tag'leri kaldırılır
3. Browser'da: `DOMParser` kullanılarak daha doğru parsing yapılır
4. Fazla boşluklar normalize edilir

**Kullanım:** "Devamını Oku" özelliği için kısaltılmış metin oluşturulurken kullanılır.

**Örnek:**
```typescript
htmlToPlainText('<p>Merhaba <strong>dünya</strong></p>')
// Sonuç: 'Merhaba dünya'
```

---

## Data Fetching

### API Endpoint

**URL:** `/api/products/${slug}`  
**Method:** `GET`  
**Response Format:** JSON (Product interface'ine uygun)

### Fetch Mekanizması

```typescript
useEffect(() => {
  // 1. Slug kontrolü
  if (!slug) return;

  // 2. Önceki isteği iptal et
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  // 3. Yeni AbortController oluştur
  abortControllerRef.current = new AbortController();
  setLoading(true);
  setError(null);

  // 4. API çağrısı
  fetch(`/api/products/${slug}`, {
    signal: abortControllerRef.current.signal,
  })
    .then((res) => {
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Ürün bulunamadı");
        }
        throw new Error("Bir hata oluştu");
      }
      return res.json();
    })
    .then((data) => {
      setProduct(data);
      setLoading(false);
    })
    .catch((err) => {
      if (err.name === "AbortError") return; // İptal edilmiş istekleri görmezden gel
      setError(err.message || "Bir hata oluştu");
      setLoading(false);
    });

  // 5. Cleanup: Component unmount veya slug değiştiğinde
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, [slug]);
```

**Özellikler:**
- **AbortController:** Önceki istekleri iptal eder (memory leak önleme)
- **Error Handling:** 404 ve diğer hatalar için özel mesajlar
- **Loading State:** Yükleme sırasında skeleton UI gösterilir

---

## UI Bileşenleri ve Görünüm

### Ana Container

```tsx
<div className="relative z-50 min-h-screen bg-white dark:bg-background overflow-x-hidden min-w-0">
```

**CSS Sınıfları:**
- `relative z-50`: Z-index katmanlaması (header/nav üzerinde)
- `min-h-screen`: Minimum ekran yüksekliği
- `bg-white dark:bg-background`: Light/dark mode arka plan
- `overflow-x-hidden`: Yatay scroll'u engeller
- `min-w-0`: Flexbox overflow sorunlarını önler

### 1. Loading State (Skeleton UI)

**Görünüm:**
```
┌─────────────────────────┐
│   [Gri animasyonlu      │ 55vh
│    arka plan]           │
├─────────────────────────┤
│ ████████ (başlık)       │
│ ████ (fiyat)            │
│ ████████████████        │
│ (açıklama)              │
└─────────────────────────┘
```

**Kod:**
```tsx
<>
  <div className="h-[55vh] w-full bg-gray-50 animate-pulse" />
  <div className="pt-6 space-y-4">
    <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
    <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
    <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
  </div>
</>
```

**Özellikler:**
- Hero alanı: `h-[55vh]` (viewport height'ın %55'i)
- Skeleton elementler: `animate-pulse` ile yanıp sönen efekt
- Responsive: Tüm ekran boyutlarında çalışır

### 2. Error State

**Görünüm:**
```
┌─────────────────────────┐
│                         │
│    Ürün bulunamadı      │
│                         │
└─────────────────────────┘
```

**Kod:**
```tsx
<div className="flex items-center justify-center min-h-[50vh]">
  <div className="text-center">
    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
      {error || "Ürün bulunamadı"}
    </p>
  </div>
</div>
```

**Özellikler:**
- Merkezi hizalama
- Dark mode desteği
- Minimum 50vh yükseklik

### 3. Success State - Hero Gallery (A)

**Yükseklik:** `h-[55vh]` (viewport height'ın %55'i)  
**Arka Plan:** `bg-gray-50`

#### 3.1. Görsel Yok Durumu

**Görünüm:**
```
┌─────────────────────────┐
│                         │
│      Görsel yok         │
│                         │
└─────────────────────────┘
```

**Kod:**
```tsx
<div className="h-[55vh] w-full relative bg-gray-50 flex items-center justify-center text-sm text-gray-400">
  Görsel yok
</div>
```

#### 3.2. Tek Görsel Durumu

**Görünüm:**
```
┌─────────────────────────┐
│                         │
│    [Ürün Görseli]       │
│    (object-contain)     │
│                         │
└─────────────────────────┘
```

**Kod:**
```tsx
<div className="h-[55vh] w-full relative bg-gray-50">
  <div className="absolute inset-0 px-4 py-6">
    <Image
      src={galleryImages[0].src}
      alt={galleryImages[0].alt || product.name}
      fill
      sizes="100vw"
      className="object-contain object-center mix-blend-multiply dark:mix-blend-normal"
      priority
    />
  </div>
</div>
```

**Özellikler:**
- `object-contain`: Görsel oranını korur, taşmaz
- `mix-blend-multiply`: Light mode'da görsel arka planla uyumlu
- `priority`: İlk görsel için LCP optimizasyonu
- Padding: `px-4 py-6` (görsel kenarlardan uzak)

#### 3.3. Çoklu Görsel (Slider) Durumu

**Görünüm:**
```
┌─────────────────────────┐
│ 1/3          [‹] [›]    │
│                         │
│    [Ürün Görseli]       │
│                         │
│        ● ○ ○            │
└─────────────────────────┘
```

**Kod Yapısı:**
```tsx
<div className="h-[55vh] w-full relative bg-gray-50">
  {/* Scroll Container */}
  <div
    ref={scrollerRef}
    onScroll={onHeroScroll}
    className="absolute inset-0 overflow-x-auto snap-x snap-mandatory snap-always touch-pan-x overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    <div className="flex h-full">
      {galleryImages.map((img, idx) => (
        <div key={`${img.src}-${idx}`} className="relative h-full min-w-full snap-start">
          <div className="absolute inset-0 px-4 py-6">
            <Image ... />
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* 1/N Indicator (Top-right) */}
  <div className="absolute top-3 right-3 z-20 rounded-full bg-black/40 px-2 py-1 text-xs text-white backdrop-blur">
    {activeIndex + 1}/{galleryImages.length}
  </div>

  {/* Dots Navigation (Bottom-center) */}
  <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/35 px-2 py-1 backdrop-blur">
    <div className="flex items-center gap-1.5">
      {galleryImages.map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Görsel ${i + 1}`}
          onClick={() => scrollToIndex(i)}
          className={
            "h-1.5 rounded-full transition-all " +
            (i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50")
          }
        />
      ))}
    </div>
  </div>

  {/* Desktop Arrows (md+) */}
  <button ... onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}>
    ‹
  </button>
  <button ... onClick={() => scrollToIndex(Math.min(galleryImages.length - 1, activeIndex + 1))}>
    ›
  </button>
</div>
```

**Slider Özellikleri:**

1. **Scroll Mekanizması:**
   - `snap-x snap-mandatory snap-always`: Her scroll'da görsel ortalanır
   - `touch-pan-x`: Mobil dokunmatik kaydırma
   - `overscroll-x-contain`: Scroll bounce'u engeller
   - Scrollbar gizli: `[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`

2. **Görsel Container:**
   - `min-w-full`: Her görsel tam genişlikte
   - `snap-start`: Snap noktası

3. **1/N Indicator:**
   - Konum: Sağ üst köşe (`top-3 right-3`)
   - Stil: Yarı saydam siyah arka plan, blur efekti
   - Format: `{activeIndex + 1}/{galleryImages.length}`

4. **Dots Navigation:**
   - Konum: Alt orta (`bottom-3 left-1/2 -translate-x-1/2`)
   - Aktif dot: `w-4 bg-white` (geniş, beyaz)
   - Pasif dot: `w-1.5 bg-white/50` (dar, yarı saydam)
   - Tıklanabilir: `onClick={() => scrollToIndex(i)}`

5. **Desktop Arrows:**
   - Görünürlük: Sadece `md:` breakpoint ve üzeri (`hidden md:flex`)
   - Konum: Sol ve sağ orta (`left-3 top-1/2 -translate-y-1/2`)
   - Stil: Yuvarlak buton, yarı saydam arka plan
   - İşlev: Önceki/sonraki görsele atlar

**Scroll Event Handler:**
```typescript
const onHeroScroll = () => {
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  rafRef.current = requestAnimationFrame(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    const galleryImages = product?.images ?? [];
    const validImages = galleryImages
      .map((img) => ({ 
        src: (img?.src ?? "").trim(), 
        alt: (img?.alt ?? "").trim() 
      }))
      .filter((img) => img.src.length > 0);
    setActiveIndex(Math.max(0, Math.min(idx, validImages.length - 1)));
  });
};
```

**Özellikler:**
- `requestAnimationFrame`: Performans optimizasyonu (scroll event'i throttling)
- `Math.round`: En yakın görsel index'ini hesaplar
- `Math.max/Math.min`: Index sınırlarını korur

**Programatik Scroll:**
```typescript
const scrollToIndex = (i: number) => {
  const el = scrollerRef.current;
  if (!el) return;
  const w = el.clientWidth;
  el.scrollTo({ left: i * w, behavior: "smooth" });
};
```

### 4. Info Block (B)

**Görünüm:**
```
┌─────────────────────────┐
│ Ürün Adı                │
│ (text-2xl, bold)        │
└─────────────────────────┘
```

**Kod:**
```tsx
<div className="pt-6">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
    {product.name}
  </h1>
</div>
```

**Özellikler:**
- Üst padding: `pt-6` (1.5rem)
- Tipografi: `text-2xl font-bold`
- Renk: `text-gray-900 dark:text-white`
- Alt margin: `mb-3`

### 5. Description Block (C)

**Görünüm - Kısaltılmış:**
```
┌─────────────────────────┐
│ Ürün açıklaması burada  │
│ yer alır. İlk 220       │
│ karakter gösterilir...  │
│                         │
│ [Devamını Oku]          │
└─────────────────────────┘
```

**Görünüm - Genişletilmiş:**
```
┌─────────────────────────┐
│ Ürün açıklaması burada  │
│ yer alır. Tüm HTML      │
│ içeriği render edilir.  │
│                         │
│ [Kapat]                 │
└─────────────────────────┘
```

**Kod:**
```tsx
<div className="pt-4">
  {safeDescriptionHtml && (
    <div>
      {!descriptionExpanded && shouldShowReadMore ? (
        <>
          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {plainText.slice(0, 220)}...
          </div>
          <button
            type="button"
            onClick={() => setDescriptionExpanded(true)}
            className="mt-2 text-sm font-semibold text-black dark:text-white"
          >
            Devamını Oku
          </button>
        </>
      ) : (
        <>
          <div
            className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: safeDescriptionHtml }}
          />
          {shouldShowReadMore && (
            <button
              type="button"
              onClick={() => setDescriptionExpanded(false)}
              className="mt-2 text-sm font-semibold text-black dark:text-white"
            >
              Kapat
            </button>
          )}
        </>
      )}
    </div>
  )}
</div>
```

**Özellikler:**
- Üst padding: `pt-4` (1rem)
- Kısaltma eşiği: 220 karakter
- HTML sanitization: `stripUnsafeHtml` ile güvenli render
- Dark mode: `text-gray-600 dark:text-gray-300`
- Line height: `leading-relaxed`

**Derived Values:**
```typescript
const descriptionHtml = product?.description ?? product?.shortDescription ?? "";
const safeDescriptionHtml = useMemo(() => stripUnsafeHtml(descriptionHtml), [descriptionHtml]);
const plainText = useMemo(() => htmlToPlainText(descriptionHtml), [descriptionHtml]);
const shouldShowReadMore = plainText.length > 220;
```

### 6. Add to Cart Button (D)

**Görünüm:**
```
┌─────────────────────────┐
│                         │
│  [🛍️ Sepete Ekle]      │
│                         │
└─────────────────────────┘
```

**Kod:**
```tsx
<div className="pt-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
  <button
    type="button"
    onClick={handleAddToCart}
    className="w-full h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
  >
    <ShoppingBag className="w-5 h-5" />
    <span>Sepete Ekle</span>
  </button>
</div>
```

**Özellikler:**
- Genişlik: `w-full` (tam genişlik)
- Yükseklik: `h-12` (3rem)
- Border radius: `rounded-xl` (0.75rem)
- Renk: Light mode'da siyah arka plan, beyaz metin; dark mode'da tersi
- Icon: `ShoppingBag` (lucide-react), `w-5 h-5`
- Active state: `active:scale-[0.98]` (basıldığında küçülür)
- Focus state: `focus-visible:ring-2 focus-visible:ring-black/30`
- Safe area: `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` (iOS home indicator için)

**handleAddToCart Fonksiyonu:**
```typescript
const handleAddToCart = () => {
  if (!product) return;

  const displayPrice = product.salePrice ?? product.price ?? product.regularPrice ?? 0;
  const primaryImage = product.images[0]?.src || null;

  addItem(
    {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceCents: displayPrice,
      imageUrl: primaryImage,
    },
    1  // Quantity
  );
};
```

**Fiyat Önceliği:**
1. `salePrice` (varsa)
2. `price` (varsa)
3. `regularPrice` (varsa)
4. `0` (fallback)

---

## Performans Optimizasyonları

### 1. useMemo Kullanımı

```typescript
const galleryImages = useMemo(() => {
  if (!product?.images) return [];
  const list = product.images;
  const filtered = list
    .map((img) => ({ 
      src: (img?.src ?? "").trim(), 
      alt: (img?.alt ?? "").trim() 
    }))
    .filter((img) => img.src.length > 0);
  return filtered;
}, [product?.images]);
```

**Amaç:** Görsel listesi sadece `product.images` değiştiğinde yeniden hesaplanır.

```typescript
const safeDescriptionHtml = useMemo(() => stripUnsafeHtml(descriptionHtml), [descriptionHtml]);
const plainText = useMemo(() => htmlToPlainText(descriptionHtml), [descriptionHtml]);
```

**Amaç:** HTML sanitization ve plain text dönüşümü sadece gerektiğinde yapılır.

### 2. requestAnimationFrame Throttling

```typescript
const onHeroScroll = () => {
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  rafRef.current = requestAnimationFrame(() => {
    // Scroll işlemi
  });
};
```

**Amaç:** Scroll event'lerini 60fps'e sınırlar, performansı artırır.

### 3. Image Optimization

- `priority={idx === 0}`: İlk görsel için LCP optimizasyonu
- `sizes="100vw"`: Responsive image sizing
- `object-contain`: Görsel oranını korur, layout shift'i önler

### 4. AbortController

```typescript
useEffect(() => {
  // ...
  abortControllerRef.current = new AbortController();
  fetch(..., { signal: abortControllerRef.current.signal });
  
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, [slug]);
```

**Amaç:** Component unmount veya slug değiştiğinde önceki istekleri iptal eder, memory leak'i önler.

---

## Accessibility (Erişilebilirlik)

### 1. Semantic HTML

- `<h1>`: Ana başlık için
- `<button>`: Tüm interaktif elementler için
- `type="button"`: Form submit'i engeller

### 2. ARIA Labels

```tsx
<button
  type="button"
  aria-label={`Görsel ${i + 1}`}
  onClick={() => scrollToIndex(i)}
>
```

**Amaç:** Screen reader'lar için görsel navigasyon butonlarını açıklar.

```tsx
<button
  type="button"
  aria-label="Önceki görsel"
  onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
>
```

```tsx
<button
  type="button"
  aria-label="Sonraki görsel"
  onClick={() => scrollToIndex(Math.min(galleryImages.length - 1, activeIndex + 1))}
>
```

### 3. Image Alt Text

```tsx
<Image
  src={img.src}
  alt={img.alt || product?.name || "Ürün görseli"}
  ...
/>
```

**Fallback Sırası:**
1. `img.alt` (varsa)
2. `product.name` (varsa)
3. `"Ürün görseli"` (default)

### 4. Focus Management

```tsx
className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
```

**Amaç:** Keyboard navigation için görsel focus indicator.

---

## Responsive Design

### Breakpoints

- **Mobile:** `< 768px` (default)
- **Desktop:** `≥ 768px` (`md:` prefix)

### Responsive Özellikler

1. **Galeri Okları:**
   - Mobile: Gizli (`hidden`)
   - Desktop: Görünür (`md:flex`)

2. **Padding:**
   - ScreenShell container'ı responsive padding sağlar
   - Component içinde sabit padding kullanılmaz

3. **Görsel Boyutlandırma:**
   - `sizes="100vw"`: Tüm ekran genişliğinde
   - `object-contain`: Her ekran boyutunda oran korunur

---

## Dark Mode Desteği

### Renk Şeması

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Arka Plan | `bg-white` | `dark:bg-background` |
| Başlık | `text-gray-900` | `dark:text-white` |
| Açıklama | `text-gray-600` | `dark:text-gray-300` |
| Buton Arka Plan | `bg-black` | `dark:bg-white` |
| Buton Metin | `text-white` | `dark:text-black` |
| Görsel Blend | `mix-blend-multiply` | `dark:mix-blend-normal` |

---

## Global Styles

```tsx
<style jsx global>{`
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`}</style>
```

**Not:** Bu stiller component içinde tanımlı ancak şu anda kullanılmıyor (gelecekteki kullanım için hazır).

---

## Data Flow

```
┌─────────────────┐
│  Route: /urun/  │
│     [slug]      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  page.tsx       │
│  (useParams)    │
└────────┬────────┘
         │ slug prop
         ▼
┌─────────────────┐
│ ProductDetail   │
│     Page        │
└────────┬────────┘
         │
         ├─► useEffect → fetch(/api/products/${slug})
         │                    │
         │                    ▼
         │              ┌─────────────┐
         │              │   API       │
         │              │  Response   │
         │              └──────┬──────┘
         │                     │
         │                     ▼
         │              setProduct(data)
         │                     │
         │                     ▼
         │              ┌─────────────┐
         │              │   State     │
         │              │  Update    │
         │              └──────┬──────┘
         │                     │
         │                     ▼
         │              ┌─────────────┐
         │              │   Re-render │
         │              │   UI        │
         │              └─────────────┘
         │
         └─► handleAddToCart → useCart().addItem()
                              │
                              ▼
                         ┌─────────────┐
                         │   Cart      │
                         │  Context    │
                         └─────────────┘
```

---

## Bağımlılıklar

### External Packages

- `react`: React hooks (useState, useEffect, useRef, useMemo)
- `next/image`: Next.js Image component (optimization)
- `lucide-react`: ShoppingBag icon
- `@/components/cart/cart-provider`: Cart context hook
- `@/lib/format`: formatPrice utility (import edilmiş ancak kullanılmıyor)

### Internal Dependencies

- `@/components/cart/cart-provider`: `useCart` hook
- API Route: `/api/products/[slug]`

---

## Hata Senaryoları

### 1. Slug Yok

**Durum:** `slug` prop'u `undefined` veya boş string  
**Davranış:** Component render edilmez, `useEffect` erken return eder

### 2. API 404

**Durum:** Ürün bulunamadı  
**Davranış:** `error` state'i "Ürün bulunamadı" mesajı ile set edilir, error UI gösterilir

### 3. API Network Error

**Durum:** Network hatası veya timeout  
**Davranış:** `error` state'i "Bir hata oluştu" mesajı ile set edilir

### 4. AbortError

**Durum:** İstek iptal edildi (component unmount veya slug değişti)  
**Davranış:** Hata görmezden gelinir, state güncellenmez

### 5. Görsel Yok

**Durum:** `product.images` boş veya geçersiz  
**Davranış:** "Görsel yok" fallback UI gösterilir

### 6. Açıklama Yok

**Durum:** `description` ve `shortDescription` null  
**Davranış:** Description block render edilmez (`safeDescriptionHtml && ...`)

---

## Güvenlik

### 1. HTML Sanitization

- `stripUnsafeHtml`: XSS saldırılarını önler
- `<script>`, `<style>`, event handler'lar kaldırılır

### 2. Input Validation

- Slug validation: API tarafında yapılır
- Görsel URL validation: UI tarafında boş string kontrolü

### 3. Safe Rendering

- `dangerouslySetInnerHTML` sadece sanitize edilmiş HTML ile kullanılır
- Plain text fallback mevcut

---

## Test Senaryoları

### 1. Loading State
- Component mount olduğunda skeleton UI gösterilir
- API çağrısı tamamlanana kadar loading state aktif

### 2. Success State
- Ürün verisi geldiğinde tüm UI elementleri render edilir
- Görseller doğru şekilde gösterilir
- Açıklama metni sanitize edilmiş şekilde render edilir

### 3. Error State
- 404 hatası için özel mesaj gösterilir
- Network hatası için genel mesaj gösterilir

### 4. Gallery Interactions
- Tek görsel: Slider UI gösterilmez
- Çoklu görsel: Slider çalışır, dots ve arrows görünür
- Scroll: Aktif index doğru güncellenir
- Dots click: İlgili görsele scroll edilir
- Arrows click: Önceki/sonraki görsele scroll edilir

### 5. Description Toggle
- 220+ karakter: "Devamını Oku" butonu görünür
- < 220 karakter: Buton görünmez
- Expand: Tüm açıklama gösterilir, "Kapat" butonu görünür
- Collapse: Kısaltılmış açıklama gösterilir

### 6. Add to Cart
- Buton tıklanabilir
- `addItem` doğru parametrelerle çağrılır
- Fiyat önceliği doğru (salePrice > price > regularPrice)

### 7. AbortController
- Slug değiştiğinde önceki istek iptal edilir
- Component unmount olduğunda istek iptal edilir

---

## Gelecek Geliştirmeler (Öneriler)

1. **Fiyat Gösterimi:** `formatPrice` import edilmiş ancak kullanılmıyor, fiyat gösterimi eklenebilir
2. **Stok Durumu:** `stockStatus` ve `stockQuantity` verisi mevcut ancak UI'da gösterilmiyor
3. **SKU Gösterimi:** `sku` verisi mevcut ancak UI'da gösterilmiyor
4. **Quantity Selector:** Sepete ekleme için miktar seçici eklenebilir
5. **Image Zoom:** Görsellere tıklanınca full-screen zoom özelliği
6. **Lazy Loading:** Görseller için lazy loading (ilk görsel hariç)
7. **Error Retry:** Hata durumunda "Tekrar Dene" butonu
8. **Loading Skeleton İyileştirme:** Daha detaylı skeleton UI

---

## Sonuç

Bu component, minimal ve odaklanmış bir ürün detay sayfası sağlar. Temel özellikler:
- ✅ Responsive tasarım
- ✅ Dark mode desteği
- ✅ Accessibility
- ✅ Performans optimizasyonları
- ✅ Güvenlik (HTML sanitization)
- ✅ Error handling
- ✅ Loading states
- ✅ Mobile-first yaklaşım

Component, modern React patterns kullanır ve Next.js App Router ile uyumludur.

