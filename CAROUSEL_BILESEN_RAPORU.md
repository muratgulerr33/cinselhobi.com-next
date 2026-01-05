# Related Products Carousel Bileşeni - Detaylı Teknik Rapor

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Bileşen Hiyerarşisi](#bileşen-hiyerarşisi)
3. [Dosya Yapısı ve Kod İncelemesi](#dosya-yapısı-ve-kod-incelemesi)
4. [Sayfa İçinde Konumlandırma](#sayfa-içinde-konumlandırma)
5. [Responsive Tasarım ve Breakpoint'ler](#responsive-tasarım-ve-breakpointler)
6. [Padding/Margin Hiyerarşisi](#paddingmargin-hiyerarşisi)
7. [Render Sırası ve Veri Akışı](#render-sırası-ve-veri-akışı)
8. [Stil Detayları](#stil-detayları)

---

## Genel Bakış

**Bileşen Adı:** Related Products Carousel  
**Kullanım Amacı:** Ürün detay sayfasında "Bunlar da ilgini çekebilir" bölümünde ilgili ürünleri yatay kaydırılabilir slider olarak göstermek  
**Teknoloji:** Embla Carousel React + Shadcn/ui wrapper  
**Component Type:** Client Component (interaktif)

---

## Bileşen Hiyerarşisi

```
src/app/urun/[slug]/page.tsx (Server Component)
  └─ ProductView (Client Component)
     └─ [Ürün detay içeriği]
  
  └─ <div className="w-full max-w-[100vw] overflow-x-hidden px-4 py-8">
     └─ RelatedProducts (Server Component)
        └─ RelatedProductsCarousel (Client Component)
           ├─ <h2>Bunlar da ilgini çekebilir</h2>
           └─ <div className="w-full overflow-hidden px-1">
              └─ Carousel (UI Component)
                 └─ CarouselContent
                    └─ CarouselItem[] (her ürün için)
                       └─ <div className="p-2">
                          └─ ProductCard
```

---

## Dosya Yapısı ve Kod İncelemesi

### 1. Ana Sayfa: `src/app/urun/[slug]/page.tsx`

**Component Type:** Server Component (async)  
**Satır 115-126:** Carousel'in render edildiği bölüm

```tsx
return (
  <>
    <ProductView product={productData} />
    <div className="w-full max-w-[100vw] overflow-x-hidden px-4 py-8">
      <RelatedProducts 
        productId={Number(rawProduct.id)} 
        categoryId={categoryId}
        slug={slug}
      />
    </div>
  </>
);
```

**Önemli Noktalar:**
- `ProductView` önce render edilir (üstte)
- Carousel wrapper'ı `ProductView`'den sonra gelir (altta)
- Wrapper `px-4` (16px) yan padding'e sahip
- `py-8` (32px) üst/alt padding
- `max-w-[100vw]` viewport genişliğini aşmayı engeller
- `overflow-x-hidden` yatay scroll'u gizler

---

### 2. Server Component: `src/components/product/detail/related-products.tsx`

**Component Type:** Server Component (async)  
**Görev:** Veritabanından ilgili ürünleri çeker ve normalize eder

```tsx
export async function RelatedProducts({ productId, categoryId, slug }: RelatedProductsProps) {
  // Slug kullanarak ilgili ürünleri çek (max 10 ürün)
  const relatedProducts = await getRelatedProductsBySlug(slug, 10);

  // Eğer ürün yoksa debug mesajı göster
  if (relatedProducts.length === 0) {
    return (
      <div className="p-4 border border-red-500">
        Slider Yüklendi ama Ürün Yok (Debug Modu)
      </div>
    );
  }

  // Veriyi normalize et
  const normalized: RelatedProduct[] = relatedProducts.map((product) => {
    const images = normalizeImages(product.images);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      currency: product.currency || "TRY",
      images: images,
      stockStatus: product.stockStatus || null,
    };
  });

  return <RelatedProductsCarousel products={normalized} />;
}
```

**Önemli Noktalar:**
- `getRelatedProductsBySlug(slug, 10)` ile maksimum 10 ürün çekilir
- Görseller normalize edilir (string veya object formatından array'e)
- Fiyat bilgileri korunur (price, regularPrice, salePrice)
- Eğer ürün yoksa kırmızı border'li debug mesajı gösterilir

---

### 3. Client Component: `src/components/product/detail/related-products-carousel.tsx`

**Component Type:** Client Component ("use client")  
**Tam Kod:**

```tsx
"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { ProductCard } from "@/components/catalog/product-card";
import type { RelatedProduct } from "./types";

interface RelatedProductsCarouselProps {
  products: RelatedProduct[];
}

export function RelatedProductsCarousel({ products }: RelatedProductsCarouselProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Bunlar da ilgini çekebilir
      </h2>
      <div className="w-full overflow-hidden px-1">
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent>
            {products.map((product) => {
              const relatedPrice = product.salePrice ?? product.price ?? product.regularPrice ?? 0;
              const relatedImages = product.images.map((img) => img.src);

              return (
                <CarouselItem
                  key={`related-${product.id}-${product.slug}`}
                  className="basis-1/2 md:basis-1/3 lg:basis-1/4"
                >
                  <div className="p-2">
                    <ProductCard
                      product={{
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        price: relatedPrice,
                        images: relatedImages,
                        stockStatus: product.stockStatus,
                      }}
                    />
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}
```

**Kod Analizi:**

1. **Başlık (Satır 22-24):**
   - `text-lg`: Büyük metin boyutu
   - `font-bold`: Kalın yazı tipi
   - `text-gray-900 dark:text-white`: Dark mode desteği
   - `mb-4`: Alt margin 16px

2. **Carousel Container (Satır 25):**
   - `w-full`: Tam genişlik
   - `overflow-hidden`: Taşan içeriği gizler
   - `px-1`: Minimal yan padding (4px)

3. **Carousel Component (Satır 26-31):**
   - `opts={{ align: "start", loop: true }}`: Baştan hizalama, sonsuz döngü
   - `className="w-full"`: Tam genişlik

4. **CarouselItem (Satır 39-41):**
   - `basis-1/2`: Mobilde 2 item (50% genişlik)
   - `md:basis-1/3`: Tablet'te 3 item (33.33% genişlik)
   - `lg:basis-1/4`: Desktop'ta 4 item (25% genişlik)

5. **ProductCard Wrapper (Satır 43):**
   - `p-2`: 8px padding (her yönde)

---

### 4. UI Component: `src/components/ui/carousel.tsx`

**Component Type:** Client Component  
**Teknoloji:** Embla Carousel React

**Ana Bileşenler:**

#### Carousel (Satır 45-151)
- Context Provider
- Embla Carousel hook'u kullanır
- Keyboard navigasyon desteği (ArrowLeft/ArrowRight)
- Scroll state yönetimi

#### CarouselContent (Satır 153-173)
```tsx
const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div
          ref={ref}
          className={cn(
            "flex",
            orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
```

**Önemli Stil:**
- `-ml-4`: Negative margin left (16px) - CarouselItem'ların `pl-4` padding'ini telafi eder

#### CarouselItem (Satır 175-195)
```tsx
const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-4" : "pt-4",
          className
        )}
        {...props}
      />
    );
  }
);
```

**Önemli Stiller:**
- `min-w-0 shrink-0 grow-0 basis-full`: Flexbox item davranışı
- `pl-4`: Padding left 16px (ilk item'ın sol kenardan 16px içeride başlaması için)

---

## Sayfa İçinde Konumlandırma

### Layout Hiyerarşisi

```
ScreenShell (page-transition.tsx)
  └─ className="mx-auto w-full max-w-screen-2xl px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12"
     └─ ProductPage (page.tsx)
        ├─ ProductView
        │  └─ [Ürün galeri, başlık, fiyat, açıklama, sticky action bar]
        │
        └─ <div className="w-full max-w-[100vw] overflow-x-hidden px-4 py-8">
           └─ RelatedProducts
              └─ RelatedProductsCarousel
```

### ScreenShell Padding (Mobil → Desktop)

**Dosya:** `src/components/app/page-transition.tsx` (Satır 72)

```tsx
<div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12">
```

**Breakpoint Bazlı Padding:**
- **Mobil (< 640px):** `px-4` = 16px
- **sm (≥ 640px):** `px-5` = 20px
- **md (≥ 768px):** `px-6` = 24px
- **lg (≥ 1024px):** `px-8` = 32px
- **2xl (≥ 1536px):** `px-12` = 48px

**Not:** Carousel wrapper'ı (`px-4`) ScreenShell'in padding'ine ek olarak uygulanır, bu da "double padding" sorununa yol açabilir.

---

## Responsive Tasarım ve Breakpoint'ler

### Tailwind CSS Breakpoint'leri

| Breakpoint | Min Width | Açıklama |
|------------|-----------|----------|
| `sm` | 640px | Küçük tablet |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Büyük desktop |
| `2xl` | 1536px | Çok büyük ekran |

### CarouselItem Responsive Davranışı

**Kod:**
```tsx
className="basis-1/2 md:basis-1/3 lg:basis-1/4"
```

**Görünüm:**
- **< 768px (Mobil):** `basis-1/2` → **2 item** yan yana (her biri %50 genişlik)
- **≥ 768px (Tablet):** `md:basis-1/3` → **3 item** yan yana (her biri %33.33 genişlik)
- **≥ 1024px (Desktop):** `lg:basis-1/4` → **4 item** yan yana (her biri %25 genişlik)

**Örnek Hesaplama (Mobil, 375px ekran):**
- Wrapper genişlik: 375px - 32px (padding) = 343px
- Her item genişlik: 343px / 2 = 171.5px
- Item padding: 8px (p-2) × 2 = 16px
- Gerçek içerik genişliği: 171.5px - 16px = 155.5px

---

## Padding/Margin Hiyerarşisi

### Tam Hiyerarşi (Dıştan İçe)

```
1. ScreenShell Container
   └─ px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12
      │
2. Page Wrapper (page.tsx)
   └─ px-4 (16px) + py-8 (32px)
      │
3. RelatedProductsCarousel Container
   └─ [padding yok]
      │
4. Carousel Container
   └─ px-1 (4px)
      │
5. CarouselContent
   └─ -ml-4 (negative margin -16px)
      │
6. CarouselItem
   └─ pl-4 (padding-left 16px)
      │
7. ProductCard Wrapper
   └─ p-2 (8px her yönde)
      │
8. ProductCard
   └─ [kendi padding'leri]
```

### Padding Hesaplaması

**İlk Item'ın Sol Kenardan Mesafesi:**

1. ScreenShell padding: 16px (mobil)
2. Page wrapper padding: 16px
3. CarouselContent negative margin: -16px
4. CarouselItem padding-left: 16px
5. ProductCard wrapper padding: 8px

**Toplam:** 16px + 16px - 16px + 16px + 8px = **40px** (mobil)

**Desktop (lg breakpoint):**
- ScreenShell padding: 32px
- Page wrapper padding: 16px
- CarouselContent negative margin: -16px
- CarouselItem padding-left: 16px
- ProductCard wrapper padding: 8px

**Toplam:** 32px + 16px - 16px + 16px + 8px = **56px** (desktop)

---

## Render Sırası ve Veri Akışı

### 1. Server-Side Render (SSR)

**Adım 1:** `page.tsx` (Server Component)
```tsx
const rawProduct = await getProductBySlug(slug);
const productCats = await db.select(...).from(productCategories)...;
const categoryId = productCats[0]?.categoryId || null;
```

**Adım 2:** `RelatedProducts` (Server Component)
```tsx
const relatedProducts = await getRelatedProductsBySlug(slug, 10);
const normalized = relatedProducts.map(...);
```

**Adım 3:** HTML'e render
- `ProductView` → HTML
- `RelatedProducts` → HTML (carousel henüz interaktif değil)

### 2. Client-Side Hydration

**Adım 4:** `RelatedProductsCarousel` (Client Component)
- React hydration başlar
- Embla Carousel hook'u initialize olur
- Scroll event listener'lar eklenir
- Carousel interaktif hale gelir

### 3. Veri Akışı Diyagramı

```
Database
  │
  ├─ getProductBySlug(slug)
  │  └─→ rawProduct
  │     └─→ productData (normalize)
  │        └─→ ProductView
  │
  └─ getRelatedProductsBySlug(slug, 10)
     └─→ relatedProducts[]
        └─→ normalized[]
           └─→ RelatedProductsCarousel
              └─→ products.map()
                 └─→ CarouselItem[]
                    └─→ ProductCard[]
```

---

## Stil Detayları

### Typography

**Başlık:**
- Font size: `text-lg` = 18px (1.125rem)
- Font weight: `font-bold` = 700
- Color: `text-gray-900` (light) / `text-white` (dark)
- Margin bottom: `mb-4` = 16px

### Spacing

| Element | Padding/Margin | Değer |
|---------|----------------|-------|
| Page wrapper | `px-4 py-8` | 16px / 32px |
| Carousel container | `px-1` | 4px |
| CarouselContent | `-ml-4` | -16px (negative) |
| CarouselItem | `pl-4` | 16px (left) |
| ProductCard wrapper | `p-2` | 8px (all) |

### Overflow Kontrolü

**Page wrapper:**
```tsx
className="w-full max-w-[100vw] overflow-x-hidden"
```
- `w-full`: Tam genişlik
- `max-w-[100vw]`: Viewport genişliğini aşmaz
- `overflow-x-hidden`: Yatay scroll gizli

**Carousel container:**
```tsx
className="w-full overflow-hidden"
```
- `overflow-hidden`: Taşan içerik gizlenir

### Dark Mode Desteği

**Başlık:**
```tsx
className="text-gray-900 dark:text-white"
```

**ProductCard:**
- ProductCard component'i kendi dark mode stillerine sahip

### Carousel Özellikleri

**Embla Options:**
```tsx
opts={{
  align: "start",  // İlk item soldan başlar
  loop: true,      // Sonsuz döngü aktif
}}
```

**Navigasyon:**
- ❌ Butonlar kaldırıldı (sadece swipe/scroll)
- ✅ Keyboard navigasyon aktif (ArrowLeft/ArrowRight)
- ✅ Touch/swipe desteği (Embla Carousel otomatik)

---

## Özet

### Bileşen Özellikleri
- ✅ Responsive (2/3/4 item breakpoint'lere göre)
- ✅ Dark mode desteği
- ✅ Touch/swipe navigasyon
- ✅ Keyboard navigasyon
- ✅ Sonsuz döngü (loop)
- ✅ Overflow koruması
- ❌ Navigasyon butonları yok (kaldırıldı)

### Kullanım Yeri
- **Sayfa:** `/urun/[slug]` (Ürün detay sayfası)
- **Konum:** `ProductView` component'inden sonra, sayfanın altında
- **Görünürlük:** Sadece ilgili ürünler varsa gösterilir (boş array ise `null` döner)

### Performans Notları
- Server Component ile veri çekilir (SSR)
- Client Component ile interaktivite sağlanır (hydration)
- Maksimum 10 ürün gösterilir
- Lazy loading yok (tüm ürünler başta yüklenir)

---

**Rapor Tarihi:** 2025-01-27  
**Versiyon:** 1.0  
**Hazırlayan:** AI Assistant

