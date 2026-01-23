# Hub Native Navigation Lock Document

> **Versiyon:** v2  
> **Tarih:** 2026-01-16  
> **Durum:** KİLİT (Locked)  
> **Amaç:** Hub native navigation implementasyonu için tek kaynak dokümantasyon
> **v2 Güncellemeleri:** Story bubble → Chip/Pill rail, hero images 5/5, inStock=1 filter, category cards grid kaldırıldı

---

## 1. Goal

Hub native navigation sistemi, kullanıcılara hızlı kategori keşfi ve ürün önizlemesi sağlayan native mobile app benzeri bir deneyim sunar. Sistem, chip/pill rail (kategori çipleri) ve bottom sheet quick look (hızlı önizleme) pattern'lerini kullanarak performanslı ve akıcı bir navigasyon sağlar.

**Hedefler:**
- Hub sayfalarında hızlı kategori erişimi (chip/pill rail)
- Bottom sheet ile anında ürün önizlemesi (skeleton → data)
- "Tümünü Gör" navigasyonu ile tam kategori sayfasına geçiş
- Tek drawer açık kuralı (cart + quick look çakışmasını önleme)
- Guardrail kurallarına uyum (male/female intent)
- Boş kategorilerin gizlenmesi
- N+1 query probleminin önlenmesi
- Stokta olmayan ürünlerin quick look'ta filtrelenmesi (inStock=1)

**Evidence:** `src/app/hub/[hubSlug]/page.tsx`, `src/components/hub/hub-category-rail.tsx`, `src/components/hub/category-quick-look-sheet.tsx`, `src/components/hub/category-bubble-rail.tsx`

---

## 2. Non-negotiables (Locked)

### 2.1 Template Yapısı
- `/hub` = Bento grid (hub kartları)
- `/hub/[hubSlug]` = Hero + Stream (hub detay sayfası)

**Evidence:** `src/app/hub/page.tsx` (lines 17-35: grid layout), `src/app/hub/[hubSlug]/page.tsx` (lines 72-100: hero section)

### 2.2 Quick Category Rail
- Chip/Pill pattern kullanılır (h-11, rounded-full, px-4)
- Her chip: sol tarafta initials (w-8 h-8 rounded-full), sağ tarafta label (text-sm, max-w-[160px], ellipsis)
- Boş kategoriler asla render edilmez
- Chip'ler tıklandığında bottom sheet açılır
- Horizontal scroll container (overflow-x-auto, scrollbar-hide)
- Fade masks (gradient) scroll affordance için

**Evidence:** `src/components/hub/category-bubble-rail.tsx` (lines 77-125: chip/pill UI structure, lines 94-118: button with initials + label)

### 2.3 Bottom Sheet Quick Look
- Fetch sadece sheet açıldığında yapılır (user-triggered)
- İlk render'da skeleton gösterilir
- 8 ürün limit ile fetch edilir
- **KİLİT:** Sadece stokta olan ürünler gösterilir (`inStock=1` parametresi ile)

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 45-92: useEffect fetch logic, line 64: limit=8&inStock=1)

### 2.4 "Tümünü Gör" Navigasyonu
- Route format: `/${parentSlug}?sub=${childWcId}`
- `sub` parametresi wcId bekler (number)
- URL generation: `buildHubCardHref(parentSlug, childWcId)`

**Evidence:** `src/config/hub-ui.ts` (lines 30-32: buildHubCardHref function), `src/components/hub/category-quick-look-sheet.tsx` (line 95: buildHubCardHref usage)

### 2.5 Database Schema
- **KİLİT:** DB schema değişikliği yok
- Mevcut `categories` ve `products` tabloları kullanılır
- Yeni endpoint yok (mevcut `/api/products` kullanılır)

**Evidence:** `src/db/schema.ts` (categories, products tables), `src/app/api/products/route.ts` (existing endpoint)

### 2.6 Empty Category Policy
- Empty categories (direct_publish = 0) asla render edilmez
- `policy: "hidden-if-empty"` kontrolü yapılır

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (lines 47-54: filter logic)

### 2.7 Guardrail Compliance
- Male/female intent kuralları korunur
- Guardrail script'i (`npm run guardrail:forbidden`) geçmeli

**Evidence:** `scripts/guardrail-forbidden.ts`, `src/lib/intent-heuristics.ts`

---

## 3. IA & Routes (Locked)

### 3.1 Route Structure

| Route | File Path | Type | Description |
|-------|-----------|------|-------------|
| `/hub` | `src/app/hub/page.tsx` | Server Component | Hub index (Bento grid) |
| `/hub/[hubSlug]` | `src/app/hub/[hubSlug]/page.tsx` | Server Component | Hub detail (Hero + Stream) |
| `/hub/[hubSlug]/loading.tsx` | `src/app/hub/[hubSlug]/loading.tsx` | Loading UI | Hub detail loading state |
| `/hub/loading.tsx` | `src/app/hub/loading.tsx` | Loading UI | Hub index loading state |

**Evidence:** `src/app/hub/page.tsx`, `src/app/hub/[hubSlug]/page.tsx`

### 3.2 Navigation Flow

```
/hub
  └─> [hubSlug] (e.g., "erkek-ve-performans")
      ├─> Hero section (title + subtitle + CTA + hero image)
      └─> Quick Category Rail (chip/pill)
          └─> Chip tap → Bottom Sheet opens
              ├─> Skeleton (instant)
              ├─> Fetch products (8 items, inStock=1)
              └─> "Tümünü Gör" → /${parentSlug}?sub=${childWcId}
```

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (full flow)

### 3.3 URL Parameters

- `sub` (query param): Child category wcId (number)
  - Format: `?sub=123` (single) veya `?sub=123,456` (multiple)
  - API'de wcId'ler internal id'lere çevrilir

**Evidence:** `src/app/api/products/route.ts` (lines 76-93: sub param parsing)

---

## 4. Hub Definitions (5 hubs)

### 4.1 Hub List

Hub tanımları `src/config/hub-ui.ts` dosyasında `HUBS` array'inde bulunur:

1. **erkek-ve-performans**
   - Label: "Erkek & Performans"
   - Subtitle: "Performans ve güven için özel ürünler"
   - Primary CTA: `/erkeklere-ozel`
   - Cards: 5 (geciktiriciler, sertlesme-pompalar, masturbatorler, realistik-mankenler, halkalar-kiliflar)

2. **kadin-ve-haz**
   - Label: "Kadın & Haz"
   - Subtitle: "Zevk ve haz için özenle seçilmiş ürünler"
   - Primary CTA: `/sex-oyuncaklari`
   - Cards: 5 (modern-vibratorler, realistik-vibratorler, realistik-dildolar, fantezi-giyim, istek-arttiricilar)

3. **ciftlere-ozel**
   - Label: "Çiftlere Özel"
   - Subtitle: "Birlikte keyif alabileceğiniz özel ürünler"
   - Primary CTA: `/kozmetik`
   - Cards: 5 (kayganlastiricilar, masaj-yaglari, prezervatifler, belden-baglamalilar, fetis-fantezi)

4. **saglik-ve-bakim**
   - Label: "Sağlık & Bakım"
   - Subtitle: "Sağlık ve bakım için güvenilir ürünler"
   - Primary CTA: `/kozmetik`
   - Cards: 5 (kayganlastiricilar, masaj-yaglari, prezervatifler, parfumler, geciktiriciler)

5. **fantezi-dunyasi**
   - Label: "Fantezi Dünyası"
   - Subtitle: "Hayal gücünüzün sınırlarını zorlayan ürünler"
   - Primary CTA: `/kadinlara-ozel`
   - Cards: 4 (fetis-fantezi, fantezi-giyim, anal-oyuncaklar, belden-baglamalilar)

**Evidence:** `src/config/hub-ui.ts` (lines 34-258: HUBS array)

### 4.2 Hub Card Structure

```typescript
interface HubCard {
  key: string;              // Unique identifier
  label: string;            // Display name
  parentSlug: string;       // Parent category slug
  childSlug: string;        // Child category slug
  policy: "hidden-if-empty"; // Visibility policy
}
```

**Evidence:** `src/config/hub-ui.ts` (lines 8-14: HubCard interface)

---

## 5. Data & Query Rules

### 5.1 Category Fetching

**Parent Categories:**
- Hub cards'dan unique `parentSlug`'ler toplanır
- `getCategoryBySlug(parentSlug)` ile parent kategori çekilir
- `getChildCategoriesByParentWcId(parent.wcId)` ile child'lar çekilir

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (lines 22-32: parent fetch logic)

### 5.2 Child Category Filtering

**Visibility Rules:**
- `policy: "hidden-if-empty"` → Child category'nin DB'de var olması ve `direct_publish > 0` olması gerekir
- `getChildCategoriesByParentWcId` zaten `direct_publish > 0` filtrelemesi yapar (HAVING clause)

**Evidence:** `src/db/queries/catalog.ts` (lines 87-108: getChildCategoriesByParentWcId, line 103: HAVING clause)

### 5.3 Product Fetching (Quick Look Sheet)

**API Endpoint:**
- `/api/products?categorySlug=${parentSlug}&sub=${childWcId}&limit=8&sort=newest&inStock=1`
- `sub` parametresi wcId bekler (virgülle ayrılmış multiple desteklenir)
- **KİLİT:** `inStock=1` parametresi ile sadece stokta olan ürünler getirilir
- API internal id'lere çevirir

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (line 64: API call with inStock=1), `src/app/api/products/route.ts` (lines 76-93: sub parsing)

### 5.4 Query Optimization

**N+1 Prevention:**
- Parent categories `Promise.all` ile parallel fetch edilir
- Child categories batch olarak çekilir (single query per parent)
- Product fetch sadece sheet açıldığında yapılır (lazy load)

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (lines 25-32: Promise.all), `src/components/hub/category-quick-look-sheet.tsx` (lines 45-89: lazy fetch)

---

## 6. UX Template (Bento + Stream)

### 6.1 Hub Index (`/hub`)

**Layout:** Bento grid (2 columns on mobile, responsive)

**Components:**
- Hero section: "Hub'lar" title + subtitle
- Hub cards grid: `grid-cols-1 gap-4 sm:grid-cols-2`
- Each card: Link to `/hub/${hubSlug}`

**Evidence:** `src/app/hub/page.tsx` (lines 7-35: layout structure)

### 6.2 Hub Detail (`/hub/[hubSlug]`)

**Layout:** Vertical stream

**Sections (top to bottom):**
1. **Back Link:** `/hub`'a dönüş
2. **Hero Section:**
   - Hero image (`/images/hub/hero/${hubSlug}.webp`, fill, object-cover)
   - Gradient overlay (text readability için)
   - Title (text-3xl font-extrabold)
   - Subtitle (text-lg text-muted-foreground)
   - Primary CTA button (Link to parent category)
3. **Quick Category Rail:** Chip/Pill rail (horizontal scroll, "Hızlı Keşfet" başlığı ile)

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (lines 57-136: full layout)

---

## 7. Quick Category Rail (Chip/Pill Pattern)

### 7.1 Component Structure

**Component:** `CategoryBubbleRail` (`src/components/hub/category-bubble-rail.tsx`)

**Props:**
```typescript
interface CategoryBubble {
  key: string;
  label: string;
  childWcId: number;
  parentSlug: string;
}

interface CategoryBubbleRailProps {
  categories: CategoryBubble[];
  onCategoryClick: (category: CategoryBubble) => void;
}
```

**Evidence:** `src/components/hub/category-bubble-rail.tsx` (lines 7-17: interfaces)

### 7.2 Visual Design

**Chip/Pill:**
- Height: h-11 (44px)
- Shape: rounded-full
- Background: bg-muted/40
- Border: border border-border/50
- Padding: px-4
- Content: 
  - Sol: Initials circle (w-8 h-8 rounded-full, bg-background/20, text-xs font-semibold)
  - Sağ: Label (text-sm font-medium, max-w-[160px], whitespace-nowrap, text-ellipsis)
- Gap: gap-2 (initials ile label arası)

**Layout:**
- Horizontal scroll container (overflow-x-auto, scrollbar-hide)
- Gap: gap-2 (chip'ler arası)
- Padding: px-4 (container padding)
- Fade masks: sol ve sağ tarafta gradient (scroll affordance)

**Evidence:** `src/components/hub/category-bubble-rail.tsx` (lines 77-125: chip/pill UI structure, lines 94-118: button with initials + label)

### 7.3 Interaction

**Tap Behavior:**
- `onCategoryClick` callback tetiklenir
- `active:scale-[0.98]` transition (tactile feedback)
- Focus ring: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- aria-label: Tam kategori adı (accessibility için)

**Evidence:** `src/components/hub/category-bubble-rail.tsx` (lines 94-118: button structure with aria-label)

### 7.4 Initials Generation

**Function:** `generateInitials(label: string)`

**Logic:**
- Stopwords filtrelenir (&, ve, ile, için, özel, vb.)
- 2+ token varsa: ilk 2 token'ın ilk harfleri (örn: "Sertleşme Pompalar" → "SP")
- 1 token varsa: ilk 2 harf (örn: "Kayganlaştırıcılar" → "KA")
- Türkçe karakter desteği (toLocaleUpperCase("tr-TR"))

**Evidence:** `src/components/hub/category-bubble-rail.tsx` (lines 34-75: generateInitials function)

### 7.5 Wrapper Component

**Component:** `HubCategoryRail` (`src/components/hub/hub-category-rail.tsx`)

**Responsibilities:**
- State management (selectedCategory, sheetOpen)
- Chip rail + sheet coordination
- Click handler: set selectedCategory, open sheet

**Evidence:** `src/components/hub/hub-category-rail.tsx` (full file)

---

## 8. Bottom Sheet Quick Look (User-triggered fetch)

### 8.1 Component Structure

**Component:** `CategoryQuickLookSheet` (`src/components/hub/category-quick-look-sheet.tsx`)

**Props:**
```typescript
interface CategoryQuickLookSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryBubble | null;
}
```

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 30-34: interface)

### 8.2 Fetch Strategy

**Lazy Loading:**
- Fetch sadece `open === true && category !== null` olduğunda yapılır
- `useEffect` dependency: `[open, category]`
- Cleanup: cancelled flag ile abort

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 45-89: fetch logic)

### 8.3 Loading States

**Skeleton:**
- 4 skeleton items gösterilir
- Structure: image (h-20 w-20) + text lines (h-4)
- Animation: animate-pulse

**Error:**
- Error message gösterilir
- Retry mekanizması yok (user sheet'i kapatıp tekrar açabilir)

**Empty:**
- "Bu kategoride henüz ürün bulunmuyor." mesajı

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 103-130: loading/error/empty states)

### 8.4 Product List

**Limit:** 8 ürün
**Sort:** newest (default)
**Display:**
- Image (80x80px, rounded-lg)
- Name (line-clamp-2)
- Price (formatPrice)
- Stock status badge (if out of stock)

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 132-169: product list)

### 8.5 "Tümünü Gör" Button

**Location:** DrawerFooter
**Action:** Navigate to `/${parentSlug}?sub=${childWcId}`
**Behavior:** Sheet kapanır, navigation yapılır

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 173-181: footer button)

### 8.6 Drawer Implementation

**Library:** Vaul (`vaul` package)
**Components:** Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter
**Styling:** max-h-[85dvh], rounded-t-2xl, shouldScaleBackground

**Evidence:** `src/components/ui/drawer.tsx` (base implementation), `src/components/hub/category-quick-look-sheet.tsx` (line 96: Drawer usage)

---

## 9. Drawer Rules (Single drawer open rule + cart interaction)

### 9.1 Single Drawer Rule

**Kural:** Aynı anda sadece bir drawer açık olabilir.

**Implementation:**
- Quick look sheet ve cart drawer aynı Vaul library'yi kullanır
- Vaul zaten single drawer pattern'i destekler (overlay + z-index)
- Açık drawer varsa, yeni drawer açılmaya çalışıldığında önceki kapanır

**Evidence:** `src/components/ui/drawer.tsx` (Vaul primitive), `src/components/app/mobile-bottom-nav.tsx` (cart drawer)

### 9.2 Cart Interaction

**Cart Drawer:**
- Mobile bottom nav'da cart tab'ı tıklandığında açılır
- Quick look sheet açıkken cart açılırsa, quick look kapanır (Vaul behavior)

**Evidence:** `src/components/app/mobile-bottom-nav.tsx` (lines 82, 93-138: cart drawer)

### 9.3 Quick Look + Cart Conflict

**Scenario:** User quick look'u açıkken cart'a ürün eklemek ister.

**Behavior:**
- Quick look'dan ürün tıklanırsa → Sheet kapanır, product detail sayfasına gider
- Product detail'den sepete ekleme yapılabilir
- Cart drawer ayrı bir flow (bottom nav'dan açılır)

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (line 139: onClick={() => onOpenChange(false)})

---

## 10. Guardrail Rules

### 10.1 Intent Guardrail

**Rules:**
- RULE-1: Manken ürünleri `et-dokulu-urunler` kategorisinde bulunamaz
- RULE-2: `kadinlara-ozel` hub altında erkek-intent ürün olamaz
- RULE-3: `erkeklere-ozel` hub altında kadın-intent ürün olamaz

**Verification:**
- `npm run guardrail:forbidden` komutu çalıştırılır
- İhlal varsa script FAIL eder (exit code 1)

**Evidence:** `scripts/guardrail-forbidden.ts` (lines 214-238: rule checks), `src/lib/intent-heuristics.ts` (intent detection)

### 10.2 Hub Intent Mapping

**Hub Intent:**
- `erkek-ve-performans` → men intent
- `kadin-ve-haz` → women intent
- `ciftlere-ozel` → unisex intent
- `saglik-ve-bakim` → unisex intent
- `fantezi-dunyasi` → mixed intent

**Category Filtering:**
- Hub cards'da `policy: "hidden-if-empty"` ile boş kategoriler filtrelenir
- Guardrail script'i ürün seviyesinde kontrol yapar

**Evidence:** `src/config/hub-ui.ts` (hub definitions), `scripts/guardrail-forbidden.ts` (hub intent checks)

---

## 11. Performance Strategy (avoid N+1, lazy load)

### 11.1 Server Component Optimization

**Parallel Fetching:**
- Parent categories `Promise.all` ile parallel çekilir
- Her parent için child categories ayrı query (batch per parent)

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (lines 25-32: Promise.all)

### 11.2 Client Component Optimization

**Lazy Loading:**
- Quick look sheet'te product fetch sadece sheet açıldığında yapılır
- `useEffect` cleanup ile cancelled flag kullanılır (unmount protection)

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 45-89: lazy fetch with cleanup)

### 11.3 Query Optimization

**Database:**
- `getChildCategoriesByParentWcId` HAVING clause ile `direct_publish > 0` filtrelemesi yapar (DB-side filtering)
- Product fetch'te limit=8 ile pagination

**Evidence:** `src/db/queries/catalog.ts` (lines 87-108: HAVING clause), `src/components/hub/category-quick-look-sheet.tsx` (line 61: limit=8)

### 11.4 Image Optimization

**Next.js Image:**
- Product images Next.js Image component ile optimize edilir
- Sizes prop: "80px" (quick look sheet)
- Lazy loading: default

**Evidence:** `src/components/hub/category-quick-look-sheet.tsx` (lines 141-149: Image component)

---

## 12. Asset Strategy (hero images + optional category icons; naming convention)

### 12.1 Hero Images

**Location:** `public/images/hub/hero/`
**Naming:** `${hubSlug}.webp`
**Examples:**
- `erkek-ve-performans.webp`
- `kadin-ve-haz.webp`
- `ciftlere-ozel.webp`
- `saglik-ve-bakim.webp`
- `fantezi-dunyasi.webp`

**Current Status:**
- **5/5 hub hero image mevcut:**
  - `erkek-ve-performans.webp` ✅
  - `kadin-ve-haz.webp` ✅
  - `ciftlere-ozel.webp` ✅
  - `saglik-ve-bakim.webp` ✅
  - `fantezi-dunyasi.webp` ✅
- Tüm hub'lar için hero image kullanılıyor (fallback yok)

**Evidence:** `public/images/hub/hero/` (directory listing: 5 files), `src/app/hub/[hubSlug]/page.tsx` (lines 57-100: hero section with Image component)

### 12.2 Category Icons (Optional)

**Location:** `public/images/hub/categories/` (not implemented yet)
**Naming:** `${categorySlug}.webp` (optional)
**Usage:** Chip/Pill'de icon gösterimi (şu an initials kullanılıyor)

**Current Status:**
- Category icons henüz kullanılmıyor
- Chip/Pill pattern initials circle gösteriyor (w-8 h-8 rounded-full)
- Future enhancement olarak eklenebilir

**Evidence:** `src/components/hub/category-bubble-rail.tsx` (lines 106-108: initials circle, lines 34-75: generateInitials function)

### 12.3 Image Loading

**Hero Images:**
- Next.js Image component kullanılıyor (optimization için)
- Server Component'te (fill, object-cover, priority)
- Gradient overlay text readability için

**Category Icons:**
- Şu an kullanılmıyor (initials circle gösteriliyor)
- Eklendiğinde Next.js Image component kullanılmalı

**Evidence:** `src/app/hub/[hubSlug]/page.tsx` (lines 73-79: Image component with fill, priority)

---

## 13. Implementation Plan (step-by-step)

### Phase 1: Hub Index Page
1. ✅ Create `/hub` route (`src/app/hub/page.tsx`)
2. ✅ Implement Bento grid layout
3. ✅ Add hub cards with links to `/hub/[hubSlug]`

### Phase 2: Hub Detail Page
1. ✅ Create `/hub/[hubSlug]` route (`src/app/hub/[hubSlug]/page.tsx`)
2. ✅ Implement hero section (title + subtitle + CTA + hero image)
3. ✅ Fetch parent categories and children
4. ✅ Filter empty categories
5. ✅ Implement Quick Category Rail (chip/pill pattern)

### Phase 3: Quick Category Rail
1. ✅ Create `CategoryBubbleRail` component
2. ✅ Implement chip/pill UI (h-11, rounded-full, initials + label)
3. ✅ Create `HubCategoryRail` wrapper
4. ✅ Integrate with hub detail page

### Phase 4: Bottom Sheet Quick Look
1. ✅ Create `CategoryQuickLookSheet` component
2. ✅ Implement lazy fetch (useEffect with open/category deps)
3. ✅ Add skeleton loading state
4. ✅ Implement product list (8 items, inStock=1 filter)
5. ✅ Add "Tümünü Gör" button with navigation
6. ✅ Image normalization (string | {src, alt} → imgSrc/imgAlt)

### Phase 5: Integration & Testing
1. ✅ Integrate all components
2. ✅ Test drawer single-open rule
3. ✅ Test cart interaction
4. ✅ Verify guardrail compliance
5. ✅ Performance testing (N+1 check)

**Status:** ✅ All phases completed

**Evidence:** All component files exist and are implemented

---

## 14. Files to Touch (full paths)

### 14.1 Route Files
- `src/app/hub/page.tsx` - Hub index page
- `src/app/hub/[hubSlug]/page.tsx` - Hub detail page
- `src/app/hub/[hubSlug]/loading.tsx` - Hub detail loading
- `src/app/hub/loading.tsx` - Hub index loading

### 14.2 Component Files
- `src/components/hub/category-bubble-rail.tsx` - Chip/Pill rail component
- `src/components/hub/hub-category-rail.tsx` - Wrapper component
- `src/components/hub/category-quick-look-sheet.tsx` - Bottom sheet component

### 14.3 Config Files
- `src/config/hub-ui.ts` - Hub definitions and utilities

### 14.4 Query Files
- `src/db/queries/catalog.ts` - Category and product queries

### 14.5 API Files
- `src/app/api/products/route.ts` - Product API endpoint (existing, used by quick look)

### 14.6 UI Component Files
- `src/components/ui/drawer.tsx` - Base drawer component (Vaul)

### 14.7 Asset Files (Optional)
- `public/images/hub/hero/${hubSlug}.webp` - Hero images
- `public/images/hub/categories/${categorySlug}.webp` - Category icons (future)

---

## 15. DoD & QA Checklist (commands + smoke)

### 15.1 Definition of Done

**Functional:**
- [x] Hub index page loads (`/hub`)
- [x] Hub detail page loads (`/hub/[hubSlug]`)
- [x] Hero images render correctly (5/5 hubs)
- [x] Chip/Pill rail renders correctly
- [x] Chip tap opens bottom sheet
- [x] Sheet shows skeleton → products (8 items, inStock=1)
- [x] "Tümünü Gör" navigates to `/${parentSlug}?sub=${childWcId}`
- [x] Empty categories are hidden
- [x] Only one drawer open at a time

**Performance:**
- [x] No N+1 queries (Promise.all for parents)
- [x] Lazy load products (fetch only on sheet open)
- [x] Images optimized (Next.js Image)

**Guardrail:**
- [x] `npm run guardrail:forbidden` passes
- [x] Intent rules respected

**Build:**
- [x] `npm run build` succeeds
- [x] `npm run lint` passes (no errors)

### 15.2 QA Commands

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Guardrail:**
```bash
npm run guardrail:forbidden
```

**Category Lock:**
```bash
npm run category:lock
```

### 15.3 Smoke Tests

**Manual Testing:**
1. Navigate to `/hub` → Verify hub cards grid
2. Click a hub card → Verify hub detail page loads with hero image
3. Scroll to chip/pill rail → Verify chips render with initials + labels
4. Tap a chip → Verify sheet opens instantly with skeleton
5. Wait for products → Verify 8 products load (only in-stock items)
6. Tap "Tümünü Gör" → Verify navigation to category page with `?sub=` param
7. Open cart drawer while quick look open → Verify quick look closes
8. Verify empty categories don't appear in chip rail

**Evidence:** Manual testing checklist

---

## 16. Risk & Rollback

### 16.1 Risks

**Performance:**
- **Risk:** N+1 queries if Promise.all not used
- **Mitigation:** Already implemented (Promise.all)
- **Rollback:** Revert to sequential fetch (not recommended)

**User Experience:**
- **Risk:** Sheet opens slowly if fetch is slow
- **Mitigation:** Skeleton shows instantly, fetch happens in background
- **Rollback:** Pre-fetch on chip hover (not implemented, future enhancement)

**Data Consistency:**
- **Risk:** Empty categories shown if filter logic breaks
- **Mitigation:** `policy: "hidden-if-empty"` + DB-side filtering (HAVING clause)
- **Rollback:** Manual filter check in component

### 16.2 Rollback Plan

**If Hub Navigation Breaks:**
1. Revert hub route files (`src/app/hub/`)
2. Remove hub components (`src/components/hub/`)
3. Keep hub config (`src/config/hub-ui.ts`) for future use

**If Quick Look Breaks:**
1. Remove `CategoryQuickLookSheet` component
2. Update `HubCategoryRail` to navigate directly (no sheet)
3. Chip tap → direct navigation to category page

**Evidence:** Git history for rollback

---

## 17. Assumptions / Unknowns

### 17.1 Assumptions

**Hero Images:**
- Assumption: Hero images optional (text-only hero works)
- Unknown: Design requirement for hero images (all hubs or none?)

**Category Icons:**
- Assumption: Category icons not required (initials sufficient)
- Unknown: Future design requirement for category icons?

**Performance:**
- Assumption: 8 products per quick look sufficient
- Unknown: User feedback may require more/fewer products

**Drawer Behavior:**
- Assumption: Single drawer rule sufficient (Vaul default)
- Unknown: Edge cases where multiple drawers needed?

### 17.2 Unknowns

**Future Enhancements:**
- Category icons in chip/pill rail (design decision needed)
- Pre-fetch on chip hover (performance vs. bandwidth trade-off)
- Infinite scroll in quick look sheet (UX decision needed)

**Evidence:** Current implementation uses minimal assumptions

---

## 18. Evidence Checklist (what files/commands prove this)

### 18.1 Implementation Evidence

**Hub Routes:**
- ✅ `src/app/hub/page.tsx` - Hub index exists
- ✅ `src/app/hub/[hubSlug]/page.tsx` - Hub detail exists
- ✅ `src/app/hub/[hubSlug]/loading.tsx` - Loading state exists

**Components:**
- ✅ `src/components/hub/category-bubble-rail.tsx` - Chip/Pill rail exists
- ✅ `src/components/hub/hub-category-rail.tsx` - Wrapper exists
- ✅ `src/components/hub/category-quick-look-sheet.tsx` - Sheet exists

**Config:**
- ✅ `src/config/hub-ui.ts` - Hub definitions exist (5 hubs)

**Queries:**
- ✅ `src/db/queries/catalog.ts` - Category queries exist (getChildCategoriesByParentWcId)

**API:**
- ✅ `src/app/api/products/route.ts` - Product API exists (sub param support)

### 18.2 Verification Commands

**Build:**
```bash
npm run build
```
**Expected:** Build succeeds, no errors

**Lint:**
```bash
npm run lint
```
**Expected:** No linting errors

**Guardrail:**
```bash
npm run guardrail:forbidden
```
**Expected:** All rules pass, exit code 0

**Category Lock:**
```bash
npm run category:lock
```
**Expected:** Baseline checks pass, exit code 0

### 18.3 Manual Verification

**Routes:**
- Navigate to `/hub` → Should see hub cards grid
- Navigate to `/hub/erkek-ve-performans` → Should see hub detail page

**Components:**
- Hero images visible on hub detail page (5/5 hubs)
- Chip/Pill rail visible on hub detail page
- Chip tap opens bottom sheet
- Sheet shows skeleton → products (inStock=1)
- "Tümünü Gör" navigates correctly

**Evidence:** Manual testing results

---

## Summary

Bu lock document, Hub Native Navigation implementasyonunun tüm detaylarını içerir. Sistem, chip/pill rail ve bottom sheet quick look pattern'lerini kullanarak native mobile app benzeri bir deneyim sunar. Tüm kararlar kilitlenmiş (locked) ve evidence ile desteklenmiştir.

**Key Locked Decisions:**
- Template: `/hub` = Bento, `/hub/[hubSlug]` = Hero + Stream (no category cards grid)
- Quick Category Rail = Chip/Pill pattern (h-11, initials + label, ellipsis)
- Bottom sheet fetch = User-triggered (lazy load, inStock=1 filter)
- "Tümünü Gör" = `/${parentSlug}?sub=${childWcId}`
- Single drawer rule (Vaul default)
- Empty categories hidden
- Guardrail compliance required
- Hero images: 5/5 hubs (all present)

**Final File Path:** `docs/locks/hub-native-navigation-lock.md`
