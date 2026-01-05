# Product Detail Page Component - Özet Dokümantasyon

## Genel Bakış

**Dosya:** `src/components/product/product-detail-page.tsx`  
**Component:** `ProductDetailPage`  
**Tip:** Client Component (`"use client"`)  
**Route:** `/urun/[slug]`

E-ticaret sitesinde ürün detay sayfasını render eden component. Ürün görselleri, başlık, açıklama ve sepete ekleme işlevselliği sağlar.

---

## Props

```typescript
ProductDetailPage({ slug: string })
```

- **slug:** Ürünün URL slug'ı (zorunlu)

---

## TypeScript Interfaces

### ProductImage
```typescript
interface ProductImage {
  src: string;
  alt?: string;
}
```

### Product
```typescript
interface Product {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  images: ProductImage[];
  sku: string | null;
  stockStatus: string | null;
  stockQuantity: number | null;
}
```

---

## State Yönetimi

### React Hooks
- `product`: Ürün verisi (API'den gelir)
- `loading`: Yükleme durumu
- `error`: Hata mesajları
- `descriptionExpanded`: Açıklama genişletilme durumu
- `activeIndex`: Galeri slider aktif görsel index'i

### Refs
- `abortControllerRef`: API isteklerini iptal etmek için
- `scrollerRef`: Galeri scroll container referansı
- `rafRef`: requestAnimationFrame ID'si (performans için)

### Context
- `useCart()`: Sepete ekleme fonksiyonu

---

## Data Fetching

**API Endpoint:** `/api/products/${slug}`  
**Method:** `GET`

**Özellikler:**
- AbortController ile önceki istekleri iptal eder
- 404 ve network hataları için özel mesajlar
- Loading state ile skeleton UI gösterir

---

## UI Bileşenleri

### 1. Loading State
- Skeleton UI: 55vh hero alanı + başlık/fiyat/açıklama placeholder'ları
- `animate-pulse` ile animasyon

### 2. Error State
- Merkezi hizalama
- Hata mesajı gösterimi
- Dark mode desteği

### 3. Hero Gallery (55vh)
- **Görsel yok:** "Görsel yok" mesajı
- **Tek görsel:** `object-contain` ile gösterim
- **Çoklu görsel:** Horizontal scroll slider
  - Snap scroll mekanizması
  - 1/N indicator (sağ üst)
  - Dots navigation (alt orta)
  - Desktop arrows (md+ breakpoint)
  - Touch swipe desteği

### 4. Info Block
- Ürün adı (`text-2xl font-bold`)

### 5. Description Block
- HTML sanitization (`stripUnsafeHtml`)
- 220+ karakter için "Devamını Oku" butonu
- Genişletilmiş/kısaltılmış toggle

### 6. Add to Cart Button
- Tam genişlik buton
- `ShoppingBag` icon
- Dark mode desteği
- iOS safe area desteği

---

## Utility Fonksiyonlar

### `stripUnsafeHtml(input: string): string`
HTML içeriğinden `<script>`, `<style>` ve event handler'ları temizler (XSS koruması).

### `htmlToPlainText(input: string): string`
HTML içeriğini düz metne çevirir (açıklama kısaltma için).

---

## Performans Optimizasyonları

1. **useMemo:** Görsel listesi ve HTML sanitization için
2. **requestAnimationFrame:** Scroll event throttling
3. **Image Optimization:** Priority loading, responsive sizing
4. **AbortController:** Memory leak önleme

---

## Accessibility

- Semantic HTML (`<h1>`, `<button>`)
- ARIA labels (görsel navigasyon butonları)
- Image alt text (fallback sırası: `img.alt` → `product.name` → "Ürün görseli")
- Focus management (keyboard navigation)

---

## Responsive Design

- **Mobile:** `< 768px` (default)
- **Desktop:** `≥ 768px` (`md:` prefix)
- Galeri okları sadece desktop'ta görünür
- Görseller `object-contain` ile oran korunur

---

## Dark Mode

| Element | Light | Dark |
|---------|-------|------|
| Arka Plan | `bg-white` | `dark:bg-background` |
| Başlık | `text-gray-900` | `dark:text-white` |
| Açıklama | `text-gray-600` | `dark:text-gray-300` |
| Buton | `bg-black text-white` | `dark:bg-white dark:text-black` |

---

## Hata Senaryoları

1. **Slug yok:** Component render edilmez
2. **API 404:** "Ürün bulunamadı" mesajı
3. **Network Error:** "Bir hata oluştu" mesajı
4. **AbortError:** Görmezden gelinir
5. **Görsel yok:** Fallback UI
6. **Açıklama yok:** Block render edilmez

---

## Güvenlik

- HTML sanitization (`stripUnsafeHtml`)
- `dangerouslySetInnerHTML` sadece sanitize edilmiş HTML ile
- Input validation (API tarafında)

---

## Bağımlılıklar

### External
- `react`
- `next/image`
- `lucide-react`

### Internal
- `@/components/cart/cart-provider`
- `/api/products/[slug]`

---

## Özellikler

- ✅ Responsive tasarım
- ✅ Dark mode desteği
- ✅ Accessibility
- ✅ Performans optimizasyonları
- ✅ Güvenlik (HTML sanitization)
- ✅ Error handling
- ✅ Loading states
- ✅ Mobile-first yaklaşım

---

## Gelecek Geliştirmeler

1. Fiyat gösterimi (formatPrice kullanımı)
2. Stok durumu gösterimi
3. SKU gösterimi
4. Miktar seçici
5. Görsel zoom özelliği
6. Lazy loading (ilk görsel hariç)
7. Error retry butonu

