# Mobile Bottom Navigation

## Purpose / Non-goals / Assumptions

**Purpose:**
Bu doküman, Next.js 15 App Router projesi için mobile-first bottom navigation komponentinin teknik spesifikasyonunu içerir. Bottom nav, native mobile app hissi veren, floating glassmorphism tasarımlı, safe area uyumlu bir navigasyon çubuğudur.

**Non-goals:**
- Desktop görünümü (sadece mobilde aktif, `md:hidden` ile gizlenir)
- Hamburger menü entegrasyonu (bottom nav bağımsız çalışır)
- Deep linking / URL state management (Next.js routing kullanılır)

**Assumptions:**
- Next.js 15 App Router (`usePathname` hook mevcut)
- React 19
- Tailwind CSS v4
- shadcn/ui atomları: `Badge`, `GlassContainer`, `IconWrapper`, `Avatar`
- Framer Motion (micro-interactions için)
- lucide-react (ikonlar için)
- Mevcut cart store: `src/components/cart/cart-store.ts` (localStorage tabanlı)
- Icons mapping: `src/components/ui/icons.tsx`

---

## 1. Anatomy & Layout

### Container Structure

Bottom navigation, fixed positioning ile ekranın altında sabitlenir:

```tsx
<nav className="fixed bottom-0 inset-x-0 z-40 md:hidden">
  <GlassContainer className="border-t border-border/40 shadow-lg">
    {/* Safe area + grid içerik */}
  </GlassContainer>
</nav>
```

**Container Özellikleri:**
- **Position**: `fixed bottom-0 inset-x-0` (full width, bottom'da sabit)
- **Z-index**: `z-40` (içerikten üstte, overlay/modallar `z-50+` üstünde kalmalı)
- **Responsive**: `md:hidden` (768px ve üzeri ekranlarda gizli)
- **Glass Effect**: `GlassContainer` atomu kullanılır (`bg-background/80 backdrop-blur-md`)
- **Border**: Üst kenarda subtle border: `border-t border-border/40`
- **Shadow**: Soft shadow: `shadow-lg` veya `shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]`

### Safe Area Support

iOS home indicator alanına uyum **ZORUNLU**. İki yöntem desteklenir:

**Yöntem 1: Utility Class (Tercih Edilen)**
```tsx
<div className="pb-safe">
  {/* Grid içerik */}
</div>
```

**Yöntem 2: Inline Style Fallback**
```tsx
<div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
  {/* Grid içerik */}
</div>
```

**Kombine Yaklaşım (Önerilen):**
```tsx
<div className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
  {/* Grid içerik */}
</div>
```

**Alternatif (Inline Style):**
```tsx
<div 
  style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
>
  {/* Grid içerik */}
</div>
```

**Not:** Bu inline style yaklaşımı, Tailwind utility class'larının kullanılamadığı durumlarda fallback olarak kullanılabilir.

**Not:** `pb-safe` utility class'ı Tailwind config'inde tanımlı olmalı veya CSS'te:
```css
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
```

**iOS Safe Area Notu:**
iOS'ta `env(safe-area-inset-bottom)` çalışması için viewport meta tag'inde `viewport-fit=cover` olmalıdır:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### Height & Spacing

**Nav Yüksekliği:**
- Minimum yükseklik: `64px` (safe area hariç)
- Safe area ile toplam: `64px + env(safe-area-inset-bottom)`
- İç padding: `px-4` (16px horizontal)
- Vertical padding: `py-2` (8px üst-alt, safe area hariç)

**Grid System:**
- 5 eşit kolon: `grid grid-cols-5 gap-1`
- Her kolon: `flex flex-col items-center justify-center`
- Gap: `gap-1` (4px) veya `gap-2` (8px)

### Item Structure

Her tab item şu yapıya sahiptir:

```
┌─────────────────┐
│   [Icon 24px]   │  ← IconWrapper veya eşdeğer (44x44px min)
│                 │
│  [Label 10px]   │  ← Always visible tiny label
└─────────────────┘
```

**Icon:**
- Boyut: `24px` (h-6 w-6)
- Container: `IconWrapper` tercih edilir (standart), yoksa `min-h-[44px] min-w-[44px]` (touch target standardı)
- **Touch Target Garantisi:** Her tab item wrapper'ı `min-h-[44px] min-w-[44px]` ile 44x44px minimum alan garantiler
- Aktif durum: `text-primary`
- Pasif durum: `text-muted-foreground`
- Transition: `transition-colors duration-200`

**Label:**
- Font size: `text-[10px]` (10px, always visible)
- Font weight: `font-medium` veya `font-semibold`
- Aktif durum: `text-primary`
- Pasif durum: `text-muted-foreground opacity-60`
- Line height: `leading-tight`
- Truncate: `truncate max-w-[60px]` (uzun label'lar için)

**Spacing:**
- Icon-label arası: `gap-0.5` (2px) veya `gap-1` (4px)
- Item iç padding: `px-2 py-1` (minimal, touch area yeterli)

### Main Content Padding

Bottom nav, içeriğin üstüne binmemesi için layout'ta bottom padding eklenmelidir:

```tsx
<main className="pb-[calc(64px+env(safe-area-inset-bottom))]">
  {/* İçerik */}
</main>
```

**Alternatif (Tailwind config ile):**
```tsx
<main className="pb-bottom-nav-safe">
```

CSS:
```css
.pb-bottom-nav-safe {
  padding-bottom: calc(4rem + env(safe-area-inset-bottom));
}
```

---

## 2. Logic & Data Injection (The Brain)

### Active State Detection

Aktif sekme, `usePathname()` hook'u ile tespit edilir:

```tsx
import { usePathname } from 'next/navigation';

const pathname = usePathname();
```

**Matching Rules:**

1. **Home Aktif:**
   - `pathname === "/"` (yalnızca exact match, başka route'ları kapsamaz)

2. **Cart Aktif:**
   - `pathname.startsWith("/cart")`

3. **Wishlist Aktif:**
   - `pathname.startsWith("/account/wishlist")`
   - **Öncelik:** Wishlist kontrolü Account kontrolünden önce yapılmalı (matching precedence)

4. **Account/Profile Aktif:**
   - `pathname.startsWith("/account")` (wishlist hariç, yukarıda kontrol edilir)

5. **Categories/Search Aktif:**
   - `pathname.startsWith("/urun/")` (ürün detay sayfası, browsing domain)
   - **Kategori Detay Sayfası:** Root route `/{slug}` (reserved slug'lar hariç)
   - Gelecekte: `pathname === "/search"` veya `pathname === "/categories"` eklendiğinde ayrıca match edebilir

**Kategori Detay Tespiti:**

Reserved slug listesi:
```tsx
const RESERVED_SLUGS = [
  'cart',
  'account',
  'urun',
  'about',
  'support',
  'styleguide',
  'gizlilik-ve-guvenlik',
  'mesafeli-satis-sozlesmesi',
  'cayma-ve-iade-kosullari',
  'odeme-ve-teslimat',
  'product',
  'product-category',
  'search',
  'categories',
] as const;
```

**Not:** `search` ve `categories` reserved listesine eklenmiştir. Bu sayfalar ileride eklendiğinde "category" olarak yanlış algılanmasın diye.

Kategori route kontrolü:
```tsx
function isCategoryRoute(pathname: string): boolean {
  // Tek segment kontrolü: /{slug}
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return false;
  
  const slug = segments[0];
  // Tek-segment route reserved değilse category kabul edilir
  return !RESERVED_SLUGS.includes(slug as any);
}
```

**Categories Tab Aktif:**
- `pathname.startsWith("/urun/")` VEYA (ürün detay sayfası)
- `isCategoryRoute(pathname) === true` VEYA (kategori detay sayfası)
- Gelecekte: `pathname === "/search"` veya `pathname === "/categories"` eklendiğinde ayrıca match edebilir

### Badge System

Badge'ler, `Badge` atomu ile gösterilir:

**Konum:**
- Icon wrapper'ın top-right köşesi
- Absolute positioning: `absolute top-0 right-0`
- Transform: `-translate-y-1 translate-x-1` (icon'un dışına taşmaması için)

**Cart Badge:**
- **Değer:** Cart store'dan toplam item sayısı (sum of qty)
- **Gösterim:**
  - 0 ise: Gizli (`hidden` veya `opacity-0 pointer-events-none`)
  - 1-99: Sayı gösterilir
  - 99+: `"99+"` gösterilir
- **Stil:** `Badge` default variant (primary)
- **Boyut:** `min-w-[18px] h-[18px] text-[10px] px-1`

**Cart Store Entegrasyonu:**
```tsx
import { useCart } from '@/components/cart/cart-provider'; // veya hook

const { items } = useCart();
const cartCount = items.reduce((sum, item) => sum + item.qty, 0);
```

**Profile/Inbox Badge (Dot):**
- **Tip:** "Dot" variant (sadece nokta, sayı yok)
- **Gösterim:** Okunmamış bildirim/mesaj varsa
- **Stil:** `Badge` atomu ile `variant="dot"` (veya `size="dot"` standardı)
- **Konum:** Icon wrapper'ın top-right köşesi, absolute positioning: `absolute top-0 right-0`
- **Transform:** `-translate-y-1 translate-x-1` (icon'un dışına taşmaması için)
- **Gizleme:** Okunmamış yoksa gizli
- **Not:** Badge atomu default'ta dot variant içermiyorsa, `variant="dot"` eklenecek şekilde Badge atomu genişletilmelidir; custom div kullanılmaz.

### Auth State Awareness

**Profile Tab Icon:**

1. **Guest (Logged-out):**
   - Icon: `Icons.user` (User icon, 24px)
   - Stil: Standart icon wrapper

2. **Logged-in:**
   - Icon: `Avatar` component (küçük, ring-bordered)
   - Boyut: `h-6 w-6` (24px)
   - Fallback: Initials (kullanıcı adının baş harfleri)
   - Ring: `ring-2 ring-border` (subtle border)

**Auth Veri Kaynağı (İki Seçenek):**

**Seçenek 1: Props ile Enjeksiyon (MVP)**
```tsx
interface MobileBottomNavProps {
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  } | null;
}
```

**Seçenek 2: Global Auth Provider/Hook (Gelecek)**
```tsx
import { useAuth } from '@/hooks/use-auth';

const { user } = useAuth();
```

**Doküman Notu:** İlk implementasyonda props ile başlanabilir, ileride global auth provider'a geçilebilir.

**Avatar Fallback:**
- Avatar URL yoksa: Initials gösterilir
- Initials yoksa: `Icons.user` fallback

---

## 3. Variants & Configuration

### Config Array Structure

Bottom nav, bir config array kabul eder:

```tsx
interface TabConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon; // lucide-react icon component
  iconActive?: LucideIcon; // Opsiyonel: aktif durumda farklı icon
  match: string[] | ((pathname: string) => boolean); // Route matching
  matchMode?: 'exact' | 'prefix'; // Opsiyonel: match array için exact/prefix modu (default: prefix)
  badge?: {
    mode: 'count' | 'dot';
    // getValue kaldırıldı: badge değeri component içinde hook/store ile hesaplanır
  };
  requiresAuth?: boolean; // Auth gerektiriyor mu?
  ariaLabel: string; // Accessibility
}

type TabConfigArray = TabConfig[];
```

### Default Tabs (Proje Standardı)

```tsx
const DEFAULT_TABS: TabConfig[] = [
  {
    id: 'home',
    label: 'Ana Sayfa',
    href: '/',
    icon: Icons.home, // Home icon (lucide-react'ten)
    match: (pathname) => pathname === '/', // Exact match: yalnızca "/" iken aktif
    ariaLabel: 'Ana sayfaya git',
  },
  {
    id: 'categories',
    label: 'Kategoriler',
    href: '/#categories', // MVP: Home'da categories section id (Future: /search page)
    icon: Icons.search, // Search icon (veya Grid icon)
    match: (pathname) => {
      return pathname === '/search' // Search sayfası
        || pathname === '/categories' // Categories sayfası
        || pathname.startsWith('/urun/') // Ürün detay sayfası
        || isCategoryRoute(pathname); // Kategori detay sayfası
    },
    ariaLabel: 'Kategorileri görüntüle',
  },
  {
    id: 'wishlist',
    label: 'Favoriler',
    href: '/account/wishlist',
    icon: Icons.heart,
    match: ['/account/wishlist'],
    requiresAuth: true, // İsteğe bağlı: auth gerektirebilir
    ariaLabel: 'Favori ürünleri görüntüle',
  },
  {
    id: 'cart',
    label: 'Sepet',
    href: '/cart',
    icon: Icons.cart, // ShoppingBag
    match: ['/cart'],
    badge: {
      mode: 'count',
      // Badge değeri component içinde useCart() hook'u ile hesaplanır
    },
    ariaLabel: 'Sepeti görüntüle',
  },
  {
    id: 'profile',
    label: 'Hesabım',
    href: '/account',
    icon: Icons.user, // Veya Avatar (auth durumuna göre)
    match: ['/account'],
    // hiddenWhen kaldırıldı: wishlist matching precedence ile çözülür
    ariaLabel: 'Hesap ayarları',
  },
];
```

**Icon Standardı:**

- İkonlar `src/components/ui/icons.tsx` dosyasından mapping ile alınır
- Filled/solid variant yoksa: Active'de `text-primary`, inactive'de `text-muted-foreground`
- Icon component'leri Lucide React'ten import edilir

**Icon Mapping Örneği:**
```tsx
// src/components/ui/icons.tsx
import { Home, Search, Heart, ShoppingBag, User } from 'lucide-react';

export const Icons = {
  home: Home,
  search: Search,
  heart: Heart,
  cart: ShoppingBag,
  user: User,
} as const;
```

---

## 4. Micro-Interactions (Framer Motion)

### Tap Animation

Her tab item'a tıklandığında:

```tsx
import { motion } from 'framer-motion';

<motion.div
  whileTap={{ scale: 0.9 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  {/* Tab item içeriği */}
</motion.div>
```

**Özellikler:**
- Scale: `0.9` (hafif küçülme)
- Spring: `stiffness: 400, damping: 17` (hızlı, yumuşak geri dönüş)
- Süre: ~150-200ms (native feel)

### Active Indicator

Aktif sekme için görsel gösterge:

**Opsiyon 1: Background Pill (Tercih Edilen)**
```tsx
<motion.div
  layoutId="activeTab"
  className="absolute inset-0 rounded-lg bg-primary/10"
  initial={false}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
/>
```

**Opsiyon 2: Top Border Line**
```tsx
<motion.div
  layoutId="activeTabLine"
  className="absolute top-0 inset-x-0 h-0.5 bg-primary"
  initial={false}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
/>
```

**Tercih: Pill + layoutId**
- `layoutId` ile Framer Motion, aktif tab değiştiğinde pill'i smooth animasyonla taşır
- `initial={false}` ile ilk render'da animasyon yok
- Spring: `stiffness: 300, damping: 30` (yumuşak, native feel)

**Pill Konumu:**
- Tab item container'ının içinde, absolute
- `inset-0` ile tam kaplar
- `rounded-lg` ile köşeler yuvarlatılır
- `bg-primary/10` ile subtle background

### Reduced Motion Support

```tsx
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();

<motion.div
  whileTap={shouldReduceMotion ? {} : { scale: 0.9 }}
  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', ... }}
>
```

**Doküman Notu:** `prefers-reduced-motion` media query'sine uyum zorunludur. Motion'lar minimalleştirilir veya kaldırılır.

### Haptic-like Feel

- Süreler kısa: 150-200ms max
- Easing: Spring (natural, bouncy değil)
- Gecikme yok: `delay: 0`
- Smooth transitions: `transition-colors duration-200` (icon/label renk değişimleri)

---

## 5. Accessibility & UX Quality Bar

### ARIA Attributes

```tsx
<nav aria-label="Ana navigasyon">
  <Link
    href={tab.href}
    aria-label={tab.ariaLabel}
    aria-current={isActive ? 'page' : undefined}
    className="..."
  >
    {/* Icon + Label */}
  </Link>
</nav>
```

**Gereksinimler:**
- `aria-label` her tab için zorunlu
- `aria-current="page"` aktif tab için
- `nav` container'a `aria-label="Ana navigasyon"`

### Keyboard Navigation

- Focus-visible ring standardı: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- Tab order: Sıralı (Home → Categories → Wishlist → Cart → Profile)
- Enter/Space: Link'i aktifleştirir (Next.js Link default davranışı)

### Touch Targets

- **Minimum:** 44x44px (her tab item)
- **Icon:** 24px (h-6 w-6)
- **Label:** 10px (okunabilirlik için yeterli)
- **Gap:** Icon-label arası minimal (2-4px)

### Visual Feedback

- Aktif durum: Icon `text-primary`, label `text-primary`
- Pasif durum: Icon `text-muted-foreground`, label `text-muted-foreground opacity-60`
- Hover: `hover:bg-muted/50` (subtle background)
- Transition: `transition-colors duration-200`

---

## 6. Integration Points (App Shell)

### Component Location

**Önerilen Yol:**
```
src/components/app/mobile-bottom-nav.tsx
```

**Export:**
```tsx
export function MobileBottomNav(props: MobileBottomNavProps) {
  // Implementation
}
```

### Layout Integration

`src/app/layout.tsx` içinde:

```tsx
import { MobileBottomNav } from '@/components/app/mobile-bottom-nav';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <CartProvider>
            <div className="min-h-dvh">
              <TopBar />
              <main className="pb-[calc(64px+env(safe-area-inset-bottom))]">
                {children}
              </main>
              <MobileBottomNav user={user} /> {/* Props ile user geçilebilir */}
            </div>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Not:** `MobileBottomNav` provider'lardan sonra render edilir (CartProvider, ThemeProvider erişimi için).

### Cart Badge Data Source

Cart badge verisi, mevcut cart store'dan alınır:

```tsx
import { useCart } from '@/components/cart/cart-provider';
// veya
import { loadCart } from '@/components/cart/cart-store';

// Hook kullanımı (tercih edilen):
const { items } = useCart();
const cartCount = items.reduce((sum, item) => sum + item.qty, 0);

// Veya store'dan direkt:
const cart = loadCart();
const cartCount = cart.items.reduce((sum, item) => sum + item.qty, 0);
```

**Not:** Cart store localStorage tabanlıdır, client-side'da çalışır. Component `"use client"` directive'i ile işaretlenmelidir.

### Auth Integration (Future)

İleride global auth provider eklendiğinde:

```tsx
import { useAuth } from '@/hooks/use-auth';

export function MobileBottomNav() {
  const { user } = useAuth();
  // ...
}
```

Şimdilik props ile user geçilebilir.

---

## 7. QA Checklist

### Safe Area Testing

- [ ] iPhone simülatörde (iPhone X ve üzeri) home indicator alanı doğru padding alıyor mu?
- [ ] Android'de safe area sorunsuz mu? (Android'de genelde 0, ama kontrol edilmeli)
- [ ] iPad'de (landscape) bottom nav gizli mi? (`md:hidden` çalışıyor mu?)

### Route Matching

- [ ] Home (`/`) aktif mi?
- [ ] Cart (`/cart`) aktif mi?
- [ ] Account (`/account`) aktif mi?
- [ ] Wishlist (`/account/wishlist`) aktif mi? (Account'tan önce kontrol ediliyor mu?)
- [ ] Kategori route (`/{slug}`) Categories tab'ını aktif yapıyor mu?
- [ ] Reserved slug'lar (`/cart`, `/account`, `/urun`, vb.) kategori olarak algılanmıyor mu?
- [ ] Ürün sayfası (`/urun/{slug}`) Categories tab'ını aktif yapıyor mu? (Browsing domain)

### Badge Behavior

- [ ] Cart badge 0 ise gizli mi?
- [ ] Cart badge 1-99 arası sayı gösteriyor mu?
- [ ] Cart badge 99+ ise "99+" gösteriyor mu?
- [ ] Badge konumu icon'un top-right'ında mı?
- [ ] Badge taşma yapmıyor mu? (overflow hidden)

### Auth State

- [ ] Guest durumunda User icon gösteriliyor mu?
- [ ] Logged-in durumunda Avatar gösteriliyor mu?
- [ ] Avatar fallback (initials) çalışıyor mu?
- [ ] Avatar URL yoksa initials gösteriliyor mu?

### Motion & Interactions

- [ ] Tap animation çalışıyor mu? (scale 0.9)
- [ ] Active indicator (pill) smooth animasyonla taşınıyor mu?
- [ ] `prefers-reduced-motion` açıkken motion'lar minimal mi?
- [ ] Icon/label renk geçişleri smooth mu?

### Responsive

- [ ] Mobilde (`< 768px`) görünüyor mu?
- [ ] Desktop'ta (`>= 768px`) gizli mi? (`md:hidden`)
- [ ] Main content bottom padding doğru mu? (nav üstüne binmiyor mu?)

### Accessibility

- [ ] `aria-label` her tab'da var mı?
- [ ] `aria-current="page"` aktif tab'da var mı?
- [ ] Focus-visible ring görünüyor mu?
- [ ] Keyboard navigation çalışıyor mu? (Tab, Enter)

---

## Implementation Notes

### TypeScript Types

```tsx
import type { LucideIcon } from 'lucide-react';

interface TabConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  iconActive?: LucideIcon;
  match: string[] | ((pathname: string) => boolean);
  matchMode?: 'exact' | 'prefix'; // Opsiyonel: match array için exact/prefix modu (default: prefix)
  badge?: {
    mode: 'count' | 'dot';
    // getValue kaldırıldı: badge değeri component içinde hook/store ile hesaplanır
  };
  requiresAuth?: boolean;
  ariaLabel: string;
}

interface MobileBottomNavProps {
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  } | null;
  tabs?: TabConfig[]; // Opsiyonel: custom tabs
}
```

### Pseudo-code Structure

```tsx
"use client";

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { GlassContainer } from '@/components/ui/glass-container';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { useCart } from '@/components/cart/cart-provider';

export function MobileBottomNav({ user, tabs = DEFAULT_TABS }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { items } = useCart();
  
  // Cart count hesaplama (component içinde)
  const cartCount = items.reduce((sum, item) => sum + item.qty, 0);
  
  // Active tab detection
  const activeTabId = tabs.find(tab => {
    if (Array.isArray(tab.match)) {
      const matchMode = tab.matchMode ?? 'prefix';
      if (matchMode === 'exact') {
        return tab.match.some(m => pathname === m);
      }
      return tab.match.some(m => pathname.startsWith(m));
    }
    return tab.match(pathname);
  })?.id;
  
  // Render tabs
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden">
      <GlassContainer className="border-t border-border/40">
        <div className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-5 gap-1 px-4 py-2">
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              // Badge değeri component içinde hesaplanır
              const badgeValue = tab.id === 'cart' ? cartCount : 0;
              
              return (
                <Link 
                  key={tab.id} 
                  href={tab.href} 
                  aria-label={tab.ariaLabel} 
                  aria-current={isActive ? 'page' : undefined}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <motion.div 
                    whileTap={{ scale: 0.9 }} 
                    className="relative flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px]"
                  >
                    {/* Active indicator pill */}
                    {isActive && (
                      <motion.div 
                        layoutId="activeTab" 
                        className="absolute inset-0 rounded-lg bg-primary/10 pointer-events-none" 
                      />
                    )}
                    
                    {/* Icon */}
                    <div className="relative z-10">
                      {tab.id === 'profile' && user ? (
                        <Avatar src={user.avatarUrl} alt={user.name} className="h-6 w-6" />
                      ) : (
                        <tab.icon className={cn("h-6 w-6", isActive ? "text-primary" : "text-muted-foreground")} />
                      )}
                      
                      {/* Badge */}
                      {tab.badge && (
                        <>
                          {tab.badge.mode === 'count' && badgeValue > 0 && (
                            <Badge className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] px-1">
                              {badgeValue > 99 ? '99+' : badgeValue}
                            </Badge>
                          )}
                          {tab.badge.mode === 'dot' && (
                            <Badge variant="dot" className="absolute -top-1 -right-1" />
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Label */}
                    <span className={cn("text-[10px] font-medium truncate max-w-[60px] relative z-10", isActive ? "text-primary" : "text-muted-foreground opacity-60")}>
                      {tab.label}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </GlassContainer>
    </nav>
  );
}
```

**Not:** Bu pseudo-code, implementasyon için yönlendirme amaçlıdır. Gerçek implementasyonda edge case'ler, error handling, ve optimizasyonlar eklenmelidir.

---

## Decision Recap

Bu doküman, mobile bottom navigation komponentinin **tek referans kaynağı**dır. Tüm kararlar, ölçüler, ve mantık burada tanımlanmıştır.

**Temel Prensipler:**
1. **Immersive & Floating:** GlassContainer, fixed bottom, subtle border
2. **Safe Area:** iOS home indicator uyumu zorunlu (`viewport-fit=cover` gerekli)
3. **Touch Targets:** 44px minimum, 24px icon, 10px label
4. **Native Feel:** Framer Motion micro-interactions, smooth transitions
5. **Accessibility:** ARIA, keyboard nav, focus-visible ring
6. **Deterministic:** Her karar dokümanda, implementasyon net
7. **Z-index Hierarchy:** BottomNav `z-40`, overlays `z-50+`
8. **Route Matching:** Home exact match, diğerleri prefix; matching precedence ile çakışmalar çözülür

