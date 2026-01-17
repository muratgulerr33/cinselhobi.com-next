# Hub Detail (`/hub/[hubSlug]`) Keşif Raporu

**Tarih:** 2026-01-16  
**Amaç:** Hub detail sayfası akışını %100 netleştirmek

---

## 0) Lock Dokümanı Özeti

**Dosya:** `docs/locks/hub-native-navigation-lock.md`

### Dokunma Kuralları (Non-negotiables):

1. **Template Yapısı:**
   - `/hub` = Bento grid (hub kartları)
   - `/hub/[hubSlug]` = Hero + Stream (hub detay sayfası)
   - Category cards grid kaldırıldı (v2 güncellemesi)

2. **Quick Category Rail:**
   - Chip/Pill pattern kullanılır (h-11, rounded-full, px-4)
   - Her chip: sol tarafta initials (w-8 h-8 rounded-full), sağ tarafta label
   - Boş kategoriler asla render edilmez
   - Chip'ler tıklandığında bottom sheet açılır

3. **Bottom Sheet Quick Look:**
   - Fetch sadece sheet açıldığında yapılır (user-triggered)
   - İlk render'da skeleton gösterilir
   - 8 ürün limit ile fetch edilir
   - **KİLİT:** Sadece stokta olan ürünler gösterilir (`inStock=1` parametresi ile)

4. **"Tümünü Gör" Navigasyonu:**
   - Route format: `/${parentSlug}?sub=${childWcId}`
   - `sub` parametresi wcId bekler (number)
   - URL generation: `buildHubCardHref(parentSlug, childWcId)`

5. **Database Schema:**
   - **KİLİT:** DB schema değişikliği yok
   - Mevcut `categories` ve `products` tabloları kullanılır
   - Yeni endpoint yok (mevcut `/api/products` kullanılır)

6. **Empty Category Policy:**
   - Empty categories (direct_publish = 0) asla render edilmez
   - `policy: "hidden-if-empty"` kontrolü yapılır

### Hub Sayfasında Kullanılacak Component'ler:

1. `HubCategoryRail` - Wrapper component (state management)
2. `CategoryBubbleRail` - Chip/Pill rail component
3. `CategoryQuickLookSheet` - Bottom sheet component
4. `Drawer` (Vaul) - Base drawer implementation

### Link Contract:

- Format: `/${parentSlug}?sub=${childWcId}`
- `sub` parametresi wcId bekler (number)
- Function: `buildHubCardHref(parentSlug, childWcId)` (`src/config/hub-ui.ts`)

---

## 1) Hub Detail Sayfa Yapısı

**Dosya:** `src/app/hub/[hubSlug]/page.tsx`

### Sayfa Akışı:

1. **Back Link:** `/hub`'a dönüş linki (ArrowLeft icon ile)

2. **Hero Section:**
   - Hero image: `/images/hub/hero/${hubSlug}.webp` (fill, object-cover, priority)
   - Gradient overlay: text readability için (`bg-gradient-to-r from-background/95 via-background/70 to-background/25`)
   - Title: `hub.label` (text-3xl font-extrabold)
   - Subtitle: `hub.subtitle` (text-lg text-muted-foreground)
   - Primary CTA button: `hub.primaryCta.href` linki

3. **Category Bubble Rail:**
   - `HubCategoryRail` component render ediliyor
   - `visibleCards` array'i prop olarak geçiliyor

### `visibleCategories` Hesaplama:

**Konum:** `src/app/hub/[hubSlug]/page.tsx` (lines 47-55)

```47:55:src/app/hub/[hubSlug]/page.tsx
  // Filter cards: only show if child category exists (direct_publish > 0) and has wcId
  const visibleCards = hub.cards.filter((card) => {
    if (card.policy === "hidden-if-empty") {
      const exists = childSlugExists.get(card.childSlug) === true;
      const hasWcId = childSlugToWcId.has(card.childSlug);
      return exists && hasWcId;
    }
    return true;
  });
```

**Mantık:**
- Hub cards'dan unique `parentSlug`'ler toplanır
- `Promise.all` ile parent categories parallel fetch edilir
- Her parent için `getChildCategoriesByParentWcId(parent.wcId)` ile child'lar çekilir
- `childSlugExists` Map'i oluşturulur (child slug → exists)
- `childSlugToWcId` Map'i oluşturulur (child slug → wcId)
- `visibleCards` filtrelenir: `policy: "hidden-if-empty"` ise, child category'nin DB'de var olması (`direct_publish > 0`) ve wcId'ye sahip olması gerekir

### "Empty Category Hide" Filtresi:

**Konum:** `src/app/hub/[hubSlug]/page.tsx` (lines 47-55)

**Filtre:** `policy: "hidden-if-empty"` kontrolü yapılır. Child category'nin:
1. DB'de var olması (`childSlugExists.get(card.childSlug) === true`)
2. wcId'ye sahip olması (`childSlugToWcId.has(card.childSlug)`)

**DB-side filtering:** `getChildCategoriesByParentWcId` zaten `direct_publish > 0` filtrelemesi yapar (HAVING clause) - `src/db/queries/catalog.ts`

---

## 2) Chip Tıklama → Sheet Açma Akışı

### Component Yapısı:

**Wrapper:** `HubCategoryRail` (`src/components/hub/hub-category-rail.tsx`)
- State management: `selectedCategory`, `sheetOpen`
- Click handler: `handleCategoryClick`

**Chip Rail:** `CategoryBubbleRail` (`src/components/hub/category-bubble-rail.tsx`)
- Props: `categories`, `onCategoryClick`
- Chip render: button with initials + label

**Sheet:** `CategoryQuickLookSheet` (`src/components/hub/category-quick-look-sheet.tsx`)
- Props: `open`, `onOpenChange`, `category`

### Akış Detayları:

#### Chip'e Basınca Hangi Function Çalışıyor?

**Konum:** `src/components/hub/category-bubble-rail.tsx` (line 97)

```94:118:src/components/hub/category-bubble-rail.tsx
              <button
                key={category.key}
                type="button"
                onClick={() => onCategoryClick(category)}
                className={cn(
                  "h-11 rounded-full border border-border/50 bg-muted/40 px-4 flex items-center gap-2 shrink-0",
                  "motion-safe:active:scale-[0.98] transition-transform",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                aria-label={category.label}
              >
```

**Function:** `onCategoryClick(category)` callback'i tetiklenir.

#### Sheet'i Açan State Nerede?

**Konum:** `src/components/hub/hub-category-rail.tsx` (lines 12-18)

```12:18:src/components/hub/hub-category-rail.tsx
  const [selectedCategory, setSelectedCategory] = useState<CategoryBubble | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleCategoryClick = (category: CategoryBubble) => {
    setSelectedCategory(category);
    setSheetOpen(true);
  };
```

**State:**
- `sheetOpen`: boolean state (Drawer'ın `open` prop'una geçiliyor)
- `selectedCategory`: CategoryBubble | null (Sheet'e `category` prop olarak geçiliyor)

#### "Selected Category" Nerede Tutuluyor?

**Konum:** `src/components/hub/hub-category-rail.tsx` (line 12)

**Tutulduğu yer:** `selectedCategory` state'i (`CategoryBubble` tipinde)

**CategoryBubble Interface:**
```6:11:src/components/hub/category-bubble-rail.tsx
export interface CategoryBubble {
  key: string;
  label: string;
  childWcId: number;
  parentSlug: string;
}
```

**İçerik:**
- `key`: Unique identifier
- `label`: Display name
- `childWcId`: Child category wcId (number)
- `parentSlug`: Parent category slug

#### Sheet Açılırken Ürün Fetch'i Nerede Tetikleniyor?

**Konum:** `src/components/hub/category-quick-look-sheet.tsx` (lines 46-92)

```46:92:src/components/hub/category-quick-look-sheet.tsx
  useEffect(() => {
    if (!open || !category) {
      setProducts([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchProducts() {
      if (!category) return;
      
      setLoading(true);
      setError(null);

      try {
        // Fetch products for the child category using parentSlug and sub (childWcId)
        const response = await fetch(
          `/api/products?categorySlug=${category.parentSlug}&sub=${category.childWcId}&limit=8&sort=newest&inStock=1`
        );

        if (!response.ok) {
          throw new Error("Ürünler yüklenemedi");
        }

        const data = await response.json();
        
        if (!cancelled) {
          setProducts(data.products || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Bir hata oluştu");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [open, category]);
```

**Tetikleyici:** `useEffect` hook'u, `open === true && category !== null` olduğunda çalışır.

**API Call:**
- Endpoint: `/api/products`
- Params: `categorySlug=${parentSlug}&sub=${childWcId}&limit=8&sort=newest&inStock=1`
- Lazy loading: Sadece sheet açıldığında fetch yapılır
- Cleanup: `cancelled` flag ile unmount protection

---

## 3) Tek Drawer Kuralı

### Drawer Implementation:

**Library:** Vaul (`vaul` package)
**Base Component:** `src/components/ui/drawer.tsx`

```4:4:src/components/ui/drawer.tsx
import { Drawer as DrawerPrimitive } from "vaul";
```

### Tek Drawer Kuralı Nasıl Enforce Ediliyor?

**Vaul Default Behavior:**
- Vaul kütüphanesi zaten single drawer pattern'i destekler
- Overlay + z-index ile yönetilir
- Açık drawer varsa, yeni drawer açılmaya çalışıldığında önceki kapanır

**Evidence:**
- Quick look sheet: `src/components/hub/category-quick-look-sheet.tsx` (line 99: `<Drawer open={open} onOpenChange={onOpenChange}>`)
- Cart drawer: `src/components/app/mobile-bottom-nav.tsx` (line 82: `<Drawer open={cartOpen} onOpenChange={setCartOpen}>`)

### Quick Look Sheet Cart ile Çakışmayı Nasıl Önlüyor?

**Scenario:** User quick look'u açıkken cart'a ürün eklemek ister.

**Behavior:**
1. Quick look'dan ürün tıklanırsa → Sheet kapanır (`onClick={() => onOpenChange(false)}`), product detail sayfasına gider
2. Product detail'den sepete ekleme yapılabilir
3. Cart drawer ayrı bir flow (bottom nav'dan açılır)

**Evidence:**
- Quick look product click: `src/components/hub/category-quick-look-sheet.tsx` (line 147: `onClick={() => onOpenChange(false)}`)
- Cart drawer: `src/components/app/mobile-bottom-nav.tsx` (lines 93-138: cart tab button)

**Global Drawer Manager:** Yok. Vaul kütüphanesi otomatik olarak tek drawer açık kalmasını sağlar.

---

## 4) /api/products Contract + inStock Doğrulaması

**Dosya:** `src/app/api/products/route.ts`

### Desteklenen Query Params:

1. **limit** (optional): 1-50 arası, default: `PRODUCTS_PER_PAGE`
2. **cursor** (optional): Pagination cursor (number)
3. **categorySlug** (optional): Parent category slug
4. **sort** (optional): `"newest" | "price_asc" | "price_desc" | "name_asc"`, default: `"newest"`
5. **min** (optional): Minimum price (TL cinsinden, kuruşa çevrilir)
6. **max** (optional): Maximum price (TL cinsinden, kuruşa çevrilir)
7. **inStock** (optional): `"1" | "true"` → sadece stokta olan ürünler
8. **sub** (optional): Child category wcId'ler (virgülle ayrılmış, örn: `"123"` veya `"123,456"`)

### Response Shape:

```typescript
{
  products: Array<{
    id: number;
    wcId: number;
    name: string;
    slug: string;
    price: number; // kuruş cinsinden
    images: ProductImage[]; // string | { src: string; alt?: string }
    stockStatus: string; // "instock" | "outofstock" | ...
    isFavorite?: boolean;
  }>;
  nextCursor: number | null;
}
```

### `inStock=1` Gerçekten Filtreliyor mu?

**Evet, filtreliyor.**

**Konum:** `src/app/api/products/route.ts` (lines 71-74)

```71:74:src/app/api/products/route.ts
  // Stok durumunu parse et
  let inStock: boolean | null = null;
  if (inStockParam === "1" || inStockParam === "true") {
    inStock = true;
  }
```

**DB Query:** `src/db/queries/catalog.ts` (lines 352-354)

```352:354:src/db/queries/catalog.ts
  // Stok durumu filtresi
  if (inStock === true) {
    whereConditions.push(eq(products.stockStatus, "instock"));
  }
```

**Hangi Field'a Bakıyor:** `products.stockStatus` field'ına bakıyor. `stockStatus === "instock"` olan ürünler filtrelenir.

---

## 5) Ürün Kartı ve Ürün Detay Route'u

### Hub/Rail'de Ürünler Hangi Card Component ile Gösteriliyor?

**Quick Look Sheet'te:** Custom Link component kullanılıyor (ProductCard değil)

**Konum:** `src/components/hub/category-quick-look-sheet.tsx` (lines 143-176)

```143:176:src/components/hub/category-quick-look-sheet.tsx
                  <Link
                    key={product.id}
                    href={`/urun/${product.slug}`}
                    className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors active:scale-[0.98]"
                    onClick={() => onOpenChange(false)}
                  >
                    {imgSrc ? (
                      <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                        <Image
                          src={imgSrc}
                          alt={imgAlt}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2 text-sm">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatPrice(product.price)}
                      </p>
                      {product.stockStatus !== "instock" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stokta yok
                        </p>
                      )}
                    </div>
                  </Link>
```

**Not:** Quick look sheet'te ProductCard component'i kullanılmıyor, custom Link component kullanılıyor.

**Diğer Yerlerde ProductCard Kullanımı:**
- `src/components/catalog/product-card.tsx` - Wrapper component
- `src/components/product/product-card.tsx` - Actual ProductCard component
- Kullanım: `src/components/catalog/product-grid.tsx`, `src/components/favorites/wishlist-client.tsx`, `src/components/product/detail/related-products-carousel.tsx`

### Tıklayınca Hangi Route'a Gidiyor?

**Route:** `/urun/${product.slug}`

**Konum:** `src/components/hub/category-quick-look-sheet.tsx` (line 145)

**Product Detail Page:** `src/app/urun/[slug]/page.tsx`

---

## 6) Sonuç Raporu

### A) Data Flow

#### `visibleCategories` Kaynağı:

**Konum:** `src/app/hub/[hubSlug]/page.tsx` (lines 47-55)

**Akış:**
1. Hub cards'dan unique `parentSlug`'ler toplanır
2. `Promise.all` ile parent categories parallel fetch edilir
3. Her parent için `getChildCategoriesByParentWcId(parent.wcId)` ile child'lar çekilir
4. `childSlugExists` ve `childSlugToWcId` Map'leri oluşturulur
5. `visibleCards` filtrelenir: `policy: "hidden-if-empty"` kontrolü yapılır
6. `visibleCards` → `HubCategoryRail` component'ine `categories` prop olarak geçilir

#### Chip → Sheet Open Flow:

**Konum:** `src/components/hub/hub-category-rail.tsx` (lines 15-18)

**Akış:**
1. User chip'e tıklar → `CategoryBubbleRail` içindeki button'un `onClick` handler'ı tetiklenir
2. `onCategoryClick(category)` callback çağrılır
3. `HubCategoryRail` içindeki `handleCategoryClick` çalışır:
   - `setSelectedCategory(category)` → selected category state'i güncellenir
   - `setSheetOpen(true)` → sheet open state'i true yapılır
4. `CategoryQuickLookSheet` component'i `open={sheetOpen}` prop'u ile render edilir

#### Sheet → Ürün Fetch Tetikleyici:

**Konum:** `src/components/hub/category-quick-look-sheet.tsx` (lines 46-92)

**Akış:**
1. `useEffect` hook'u `[open, category]` dependency array'i ile çalışır
2. `open === true && category !== null` olduğunda:
   - `fetchProducts()` async function çalışır
   - API call: `/api/products?categorySlug=${parentSlug}&sub=${childWcId}&limit=8&sort=newest&inStock=1`
   - Response'dan `products` array'i alınır
   - `setProducts(data.products || [])` ile state güncellenir
3. Cleanup: `cancelled` flag ile unmount protection

#### Tek Drawer Kontrolü:

**Konum:** Vaul kütüphanesi (otomatik)

**Akış:**
- Vaul kütüphanesi zaten single drawer pattern'i destekler
- Overlay + z-index ile yönetilir
- Açık drawer varsa, yeni drawer açılmaya çalışıldığında önceki kapanır
- Global drawer manager yok, Vaul otomatik yönetiyor

---

### B) En Güvenli Ekleme Noktası

#### Subcategory Grid'i Koymak İçin En Doğru Dosya:

**Dosya:** `src/app/hub/[hubSlug]/page.tsx`

**Konum:** `HubCategoryRail` component'inden sonra, aynı `<section>` içinde veya yeni bir section olarak

**Öneri:** `visibleCards.length > 0` bloğu içinde, `HubCategoryRail`'den sonra:

```typescript
{visibleCards.length > 0 ? (
  <section className="space-y-4">
    <h2 className="text-xl font-semibold px-4">Hızlı Keşfet</h2>
    <HubCategoryRail categories={...} />
    
    {/* Subcategory Grid buraya eklenebilir */}
    <SubcategoryGrid categories={visibleCards} />
  </section>
) : (...)}
```

#### Featured Rail'i Koymak İçin En Doğru Dosya:

**Dosya:** `src/app/hub/[hubSlug]/page.tsx`

**Konum:** `HubCategoryRail` component'inden sonra, aynı `<section>` içinde veya yeni bir section olarak

**Öneri:** `visibleCards.length > 0` bloğu içinde, `HubCategoryRail`'den sonra:

```typescript
{visibleCards.length > 0 ? (
  <section className="space-y-4">
    <h2 className="text-xl font-semibold px-4">Hızlı Keşfet</h2>
    <HubCategoryRail categories={...} />
    
    {/* Featured Rail buraya eklenebilir */}
    <FeaturedRail hubSlug={hubSlug} />
  </section>
) : (...)}
```

**Alternatif:** Hero section'dan sonra, Category Rail'den önce de eklenebilir (daha üstte görünür).

---

### C) API

#### `/api/products` Parametreleri:

**Tam Liste:**
- `limit`: 1-50 arası (default: `PRODUCTS_PER_PAGE`)
- `cursor`: Pagination cursor (number)
- `categorySlug`: Parent category slug (string)
- `sub`: Child category wcId'ler (virgülle ayrılmış, örn: `"123"` veya `"123,456"`)
- `sort`: `"newest" | "price_asc" | "price_desc" | "name_asc"` (default: `"newest"`)
- `min`: Minimum price (TL cinsinden)
- `max`: Maximum price (TL cinsinden)
- `inStock`: `"1" | "true"` → sadece stokta olan ürünler

#### Minimum Gerekli Product Field'ları:

**API Response'dan:**
```typescript
{
  id: number;
  wcId: number;
  name: string;
  slug: string;
  price: number; // kuruş cinsinden
  images: ProductImage[]; // string | { src: string; alt?: string }
  stockStatus: string; // "instock" | "outofstock" | ...
  isFavorite?: boolean;
}
```

**ProductCard Component İçin:**
- `slug` (veya `handle`, `permalinkSlug`) → route için
- `name` (veya `title`) → display için
- `price` → fiyat gösterimi için (kuruş cinsinden)
- `images` → görsel gösterimi için
- `id` → favorite için (opsiyonel)

#### Örnek Query (6 Ürün, inStock):

```
GET /api/products?categorySlug=erkeklere-ozel&sub=123&limit=6&sort=newest&inStock=1
```

**Response:**
```json
{
  "products": [
    {
      "id": 1,
      "wcId": 1001,
      "name": "Ürün Adı",
      "slug": "urun-adi",
      "price": 19900,
      "images": ["/images/products/urun-adi.webp"],
      "stockStatus": "instock",
      "isFavorite": false
    },
    ...
  ],
  "nextCursor": 995
}
```

---

### D) UI Reuse

#### Kullanılacak Mevcut ProductCard Component'i:

**Component:** `src/components/catalog/product-card.tsx`

**Wrapper Component:** `ProductCard` (eski API'yi yeni API'ye map ediyor)

**Actual Component:** `src/components/product/product-card.tsx` → `ProductCard` (yeni API)

**Kullanım:**
```typescript
import { ProductCard } from "@/components/catalog/product-card";

<ProductCard 
  product={{
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    images: product.images,
    stockStatus: product.stockStatus,
    isFavorite: product.isFavorite
  }}
  isFavorite={product.isFavorite}
/>
```

**Not:** Quick look sheet'te ProductCard kullanılmıyor, custom Link component kullanılıyor. Ancak featured rail veya subcategory grid için ProductCard kullanılabilir.

#### Ürün Detay Route'u:

**Route:** `/urun/[slug]`

**Dosya:** `src/app/urun/[slug]/page.tsx`

**Kullanım:**
```typescript
<Link href={`/urun/${product.slug}`}>
  {/* ProductCard veya custom link */}
</Link>
```

---

## Özet

### Key Findings:

1. **visibleCategories:** Server component'te (`page.tsx`) hesaplanıyor, `policy: "hidden-if-empty"` ile filtreleniyor
2. **Chip → Sheet:** `HubCategoryRail` wrapper component'i state yönetiyor, `handleCategoryClick` ile sheet açılıyor
3. **Tek Drawer:** Vaul kütüphanesi otomatik olarak tek drawer açık kalmasını sağlıyor (global manager yok)
4. **API:** `/api/products` endpoint'i `inStock=1` parametresi ile `stockStatus === "instock"` filtrelemesi yapıyor
5. **ProductCard:** `src/components/catalog/product-card.tsx` wrapper component'i kullanılabilir
6. **Route:** `/urun/[slug]` product detail sayfası

### En Güvenli Ekleme Noktaları:

- **Subcategory Grid:** `src/app/hub/[hubSlug]/page.tsx` içinde, `HubCategoryRail`'den sonra
- **Featured Rail:** `src/app/hub/[hubSlug]/page.tsx` içinde, `HubCategoryRail`'den sonra veya hero'dan sonra

---

**Rapor Tamamlandı:** 2026-01-16
