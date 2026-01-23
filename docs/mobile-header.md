# Mobile Header - Teknik Tasarım Dokümanı

## Genel Bakış

Bu doküman, Next.js 15+ (App Router) projesi için mobile-first header sisteminin teknik spesifikasyonunu içerir. Header, 0-1279px arası ekranlarda aktif olacak şekilde tasarlanmıştır. 1280px ve üzeri ekranlar desktop header kapsamına girer ve bu dokümanın dışındadır.

**Temel Prensipler:**
- Native-like his: iOS/Android app header gibi akıcı, responsive, haptic-ready
- Glassmorphism standardı: `GlassContainer` atom component'i ile (`bg-background/80 backdrop-blur-md`)
- Touch-first: Tüm tıklanabilirler minimum 44x44px (`IconWrapper` kullanımı zorunlu)
- Z-index: Header her şeyin üstünde (`z-50`), içerik altından scroll eder
- Shadcn UI + Lucide icons: `Icons` mapping dosyası referans alınacak
- Framer Motion: Hafif animasyonlar, native hissi bozmayan, jump yok

---

## Content Offset Standardı

**Kritik Kural:** Mobile header `fixed` pozisyonunda olduğu için ve safe-area top kullandığı için, sayfa içeriği header'ın altında kalmamalıdır.

**Zorunlu Offset:**
- Ana sayfa wrapper/main container için padding-top değeri: `56px + env(safe-area-inset-top, 0px)`
- Örnek: `padding-top: calc(56px + env(safe-area-inset-top, 0px))` veya Tailwind: `pt-[calc(56px+env(safe-area-inset-top,0px))]`
- 56px = header yüksekliği (`h-14`)

**Uygulama:**
- Tüm sayfa layout'larında (root layout veya sayfa bazlı) main/content wrapper'a bu offset uygulanmalıdır
- Mobile header kullanılan tüm sayfalarda (`xl:hidden` breakpoint içinde) bu kural geçerlidir
- Desktop header (1280px+) için ayrı offset gerekebilir (bu doküman dışı)

**Örnek:**
```tsx
<main className="pt-[calc(56px+env(safe-area-inset-top,0px))] xl:pt-0">
  {/* Sayfa içeriği */}
</main>
```

**Not:** Root layout'ta veya sayfa bazlı layout'larda bu offset'in uygulanması gerekir. Header component'i bu offset'i sağlamaz; sayfa layout'larının sorumluluğundadır.

---

## 1. Anatomy (The 3-Column Grid)

### Grid Yapısı

Header, 3 kolonlu bir grid sistemi üzerine kuruludur:

```
┌─────────────────────────────────────────┐
│ [Left Slot]  [Center Slot]  [Right Slot] │
└─────────────────────────────────────────┘
```

#### Left Slot (Nav)
- **Genişlik**: Esnek (flex-1 veya auto, içeriğe göre)
- **Hizalama**: Sola hizalı (`justify-start`)
- **İçerik Seçenekleri**:
  - Logo (Home link): Ana sayfada görünür, tıklanınca `/` route'una gider
  - Back Button: Sub-page'lerde görünür, `onBack` callback'i ile çalışır
- **Padding**: `px-4` (16px horizontal)
- **Not:** Hamburger menü V1'de kullanılmayacak. Ana menü hub'ı `/account` (Profile) sayfasıdır. Hamburger menü non-goal/future olarak işaretlenmiştir.

#### Center Slot (Context)
- **Genişlik**: Esnek (flex-1 veya auto)
- **Hizalama**: Mutlak ortalanmış (`absolute center` tekniği)
- **Teknik Detay**: Left ve Right slot'ların içeriği değişse bile center slot her zaman gerçek ortada kalmalı. Bu, CSS Grid veya flexbox ile `justify-center` ve `absolute positioning` kombinasyonu ile sağlanır.
- **Overlay Risk Önleme**: Center container `pointer-events-none` olmalı, içindeki title/search `pointer-events-auto` ile tıklanabilir olmalı. Ayrıca center için `inset-y-0 flex items-center` önerilir (dikey ortalamak için).
- **İçerik Seçenekleri**:
  - Page Title: Truncate edilmiş, scroll ile fade-in (detail variant)
  - Search (Collapsed): Icon olarak görünür, tıklanınca expanded mode'a geçer
  - Search (Expanded): Full-width input (Search Mode variant)
  - Center Logo: Alternatif variant (isteğe bağlı)
- **Typography**: `font-semibold tracking-tight text-sm` veya `text-base`, `truncate` class'ı ile

#### Right Slot (Actions)
- **Genişlik**: Esnek (flex-1 veya auto)
- **Hizalama**: Sağa hizalı (`justify-end`)
- **İçerik Kuralı**: Maksimum 2 ikon görünür. Daha fazla action varsa "More" menü içine alınır.
- **Standart Actions**:
  - Search trigger (Home variant)
  - Notification bell
  - Cart (badge ile)
  - User/Auth (Avatar veya Login trigger)
  - Share (Detail variant)
  - Like/Favorite (Detail variant)
- **Padding**: `px-4` (16px horizontal)

### Ölçüler

- **Header Yüksekliği**: `h-14` (56px) - standart mobile header yüksekliği
- **Safe Area**: iOS notch için `pt-[env(safe-area-inset-top)]` kullanılır. Fallback: `pt-[env(safe-area-inset-top,0px)]` veya CSS'te `padding-top: env(safe-area-inset-top, 0)`
- **Safe Area + h-14 İlişkisi**: `h-14` içerik alanının yüksekliğidir. `pt-[env(safe-area-inset-top,0px)]` safe-area padding'i bunun üstüne eklenir; toplam header yüksekliği safe-area kadar artar.
- **Padding**: Horizontal `px-4` (16px), vertical `py-0` (header yüksekliği içinde)
- **Gap**: Slot'lar arası `gap-2` (8px) veya flexbox ile otomatik spacing
- **Border**: GlassContainer'a default `rounded-none border-0 border-b`. Scroll durumuna göre: `y=0` → `border-transparent`, `y>10` → `border-border`

### Alignment Tekniği

Center slot'un mutlak ortalanması için önerilen teknik:

```tsx
<div className="relative flex items-center h-14">
  {/* Left Slot */}
  <div className="flex-1 flex items-center justify-start">
    {/* Left content */}
  </div>
  
  {/* Center Slot - Absolute, Overlay Risk Önleme */}
  <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 flex items-center pointer-events-none">
    <div className="pointer-events-auto">
      {/* Center content (title, search, vb.) */}
    </div>
  </div>
  
  {/* Right Slot */}
  <div className="flex-1 flex items-center justify-end">
    {/* Right content */}
  </div>
</div>
```

Alternatif: CSS Grid kullanımı (3 eşit kolon, center kolon içeriği ortalanmış).

---

## 2. Variants & States

### Variant A: Home/Root

**Görünen Elemanlar:**
- Left: Logo (Home link)
- Center: Boş veya center logo (isteğe bağlı)
- Right: Search trigger icon + Notification icon (veya Cart + User)

**Scroll Davranışı:**
- `y = 0`: GlassContainer wrapper her zaman kullanılır, ancak glass efekti devre dışı: `bg-transparent backdrop-blur-0`, border: `border-transparent` (immersive görünüm)
- `y > 10`: Glass efekti aktif: `bg-background/80 backdrop-blur-md`, border: `border-border` (glass görünüm)

**States:**
- **Default**: Transparent background
- **Scrolled**: Glass background
- **Loading**: Skeleton veya shimmer effect (isteğe bağlı)
- **Empty**: Title yoksa center slot boş kalır

### Variant B: Detail/Sub-page

**Görünen Elemanlar:**
- Left: Back button (`ChevronLeft` icon)
- Center: Page title (scroll ile fade-in)
- Right: Share icon + Like/Favorite icon (veya Cart + More menu)

**Scroll Davranışı:**
- GlassContainer wrapper her zaman kullanılır, ancak Detail variant'ta glass efekti her zaman aktif (`bg-background/80 backdrop-blur-md border-border`)
- Title opacity: Hero section üstündeyken `opacity-0`, hero geçince `opacity-100` (threshold: hero height veya 200px)
- Smooth transition: `transition-opacity duration-300`

**States:**
- **Default**: Glass background, title hidden
- **Scrolled**: Glass background, title visible
- **Loading**: Title placeholder (skeleton)
- **Empty**: Title yoksa center slot boş, back button + right actions görünür

**Title Fade-in Threshold:**
```tsx
const [showTitle, setShowTitle] = useState(false);
const heroRef = useRef<HTMLDivElement>(null);
const threshold = heroRef.current?.offsetHeight ?? 200; // heroRef varsa onu kullan, yoksa 200px fallback

useEffect(() => {
  const handleScroll = () => {
    setShowTitle(window.scrollY > threshold);
  };
  // ...
}, [threshold]);
```

**Scroll Threshold Standardı:**
- **Öncelik:** Eğer sayfada `heroRef` (hero section referansı) varsa, threshold = `heroRef.current.offsetHeight`
- **Fallback:** Hero section yoksa veya ref henüz mount olmamışsa, threshold = `200px` (sabit değer)
- **Algoritma:** `const threshold = heroRef.current?.offsetHeight ?? 200;`
- Bu kural tüm Detail variant sayfalarında tutarlı şekilde uygulanır

### Variant C: Search Mode

**Görünen Elemanlar:**
- Left: Boş (veya Cancel button)
- Center: Full-width search input (autofocus)
- Right: Cancel button (input blur + state reset)

**Davranış:**
- Search trigger'a tıklanınca expanded mode'a geçer
- Input otomatik focus alır
- Cancel'a tıklanınca: Input blur, search state reset, collapsed mode'a dönüş
- Keyboard açılışında header yüksekliği korunur (iOS Safari uyumluluğu)

**States:**
- **Collapsed**: Icon olarak görünür
- **Expanded**: Full-width input, Cancel button görünür
- **Typing**: Debounced search query (performans için)

### Disabled/Loading Durumları

- **Icon Disabled**: `opacity-50 pointer-events-none`
- **Loading State**: Skeleton veya spinner (Shadcn Skeleton component)
- **Network Error**: Retry button veya error state (isteğe bağlı)

### "Max 2 Icon" Kuralı ve More Menü

**Kural**: Right slot'ta maksimum 2 ikon görünür. Daha fazla action gerekiyorsa:

1. Öncelik sırası: En önemli 2 action seçilir
2. Diğerleri: "More" menü içine alınır (3 nokta icon veya `MoreHorizontal` Lucide icon - `Icons.more`)
3. More Menü Standardı:
   - **Mobile (0-1279px):** Shadcn `Sheet` component kullanılır (bottom sheet)
   - **Desktop (1280px+):** Shadcn `DropdownMenu` component kullanılır (bu doküman mobile header için, desktop kapsam dışı)
4. Menü İçeriği: Kalan tüm actions listelenir

**Örnek Senaryo:**
- Gerekli actions: Search, Cart, Notifications, Wishlist, Profile
- Görünen: Cart (badge ile) + More (3 nokta)
- More menüde: Notifications, Wishlist, Profile

---

## 3. Component Architecture (Atoms to Molecules)

### Atoms (Zorunlu Kullanım)

#### GlassContainer
**Dosya**: `src/components/ui/glass-container.tsx`

**Kullanım:**
```tsx
<GlassContainer className="border-b border-border">
  {/* Header content */}
</GlassContainer>
```

**Props:**
- `className?: string` - Ek class'lar
- `rounded?: "none" | "lg"` - Header için genelde `rounded="none"`

**CSS:**
- Default: `bg-background/80 backdrop-blur-md` (GlassContainer'ın varsayılan class'ları)
- Header için override: Scroll state'e göre class'lar değişir
- `y = 0`: `bg-transparent backdrop-blur-0` (glass devre dışı)
- `y > 10`: `bg-background/80 backdrop-blur-md` (glass aktif)
- Border: Default `rounded-none border-0 border-b`, state'e göre `border-transparent` veya `border-border`

#### IconWrapper
**Dosya**: `src/components/ui/icon-wrapper.tsx`

**Kullanım:**
```tsx
<IconWrapper onClick={handleClick} aria-label="Search">
  <Icons.search className="w-5 h-5" />
</IconWrapper>
```

**Özellikler:**
- Minimum 44x44px touch target (`w-11 h-11`)
- IconWrapper atomu genel olarak hover stilleri içerebilir; ancak mobile header dokunmatik odaklıdır ve pratikte hover davranışı beklenmez. Mobile header'da esas olan active/press feedback'tir.
- Focus-visible ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` (keyboard navigation için, glass/blur üstünde ring'in kaybolmaması için offset önemli)
- `asChild` prop desteği (Radix Slot)
- **Button Props Forward:** IconWrapper button attribute'larını forward eder; bu yüzden `aria-label`, `disabled`, `type`, `onKeyDown` vb. doğrudan verilebilir.

#### Badge
**Dosya**: `src/components/ui/badge.tsx`

**Kullanım:**
```tsx
<IconWrapper>
  <Icons.cart className="w-5 h-5" />
  <Badge variant="default" className="absolute -top-1 -right-1">
    {cartCount}
  </Badge>
</IconWrapper>
```

**Cart Badge Örneği:**
- Position: `absolute -top-1 -right-1` (icon üzerinde)
- Variant: `default` (primary color)
- Size: `text-xs` (küçük sayılar için)

#### Button
**Dosya**: `src/components/ui/button.tsx`

**Kullanım:**
```tsx
<Button variant="ghost" size="icon" pressable>
  <Icons.chevronLeft className="w-5 h-5" />
</Button>
```

**Pressable Prop Standardı:**
- `pressable={true}`: `active:scale-95` transition ekler
- Native-like touch feedback için önerilir
- **Kural:** Mobile header içinde Button kullanımı sınırlıdır. Genel olarak `IconWrapper` kullanımı tercih edilir. Button component'i `pressable` prop'unu destekler, ancak header içinde `IconWrapper` kullanımı standarttır.
- **Alternatif:** Eğer Button kullanılacaksa, `pressable` prop'u mevcut ve çalışır durumdadır.

#### Avatar
**Dosya**: `src/components/ui/avatar.tsx`

**Kullanım:**
```tsx
<Avatar>
  <AvatarImage src={user.image} alt={user.name} />
  <AvatarFallback>
    <Icons.user className="w-5 h-5" />
  </AvatarFallback>
</Avatar>
```

**Auth State:**
- User logged in: Avatar görünür
- Guest: Login/Sign Up trigger (IconWrapper + text veya sadece icon)

### Molecules/Organisms

#### MobileHeader (Root Component)

**Dosya**: `src/components/header/mobile-header.tsx`

**Props Interface:**
```tsx
interface MobileHeaderProps {
  variant: 'home' | 'category' | 'detail' | 'profile';
  title?: string;
  rightActions?: Array<{
    icon: keyof typeof Icons;
    label: string;
    onClick?: () => void;
    href?: string;
    badge?: number;
  }>;
  onBack?: () => void;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  className?: string;
}
```

**Not:** `showHamburger` prop'u V1'de kullanılmayacak. Hamburger menü yerine `/account` sayfası ana menü hub'ı olarak kullanılır.

**Wrapper Structure:**
```tsx
<header className="fixed top-0 w-full z-50 xl:hidden">
  <GlassContainer 
    rounded="none"
    className={cn(
      "border-0 border-b transition-colors duration-300",
      isScrolled 
        ? "bg-background/80 backdrop-blur-md border-border" 
        : "bg-transparent backdrop-blur-0 border-transparent"
    )}
  >
    <div className="relative flex items-center h-14 px-4 pt-[env(safe-area-inset-top,0px)]">
      {/* 3-column grid */}
    </div>
  </GlassContainer>
</header>
```

**Kritik Kurallar:**
- GlassContainer wrapper **her zaman** kullanılır (zorunlu)
- `y = 0`: Glass efekti class ile devre dışı (`bg-transparent backdrop-blur-0`)
- `y > 10`: Glass efekti aktif (`bg-background/80 backdrop-blur-md`)
- Border: Default `rounded-none border-0 border-b`, state'e göre `border-transparent` veya `border-border`
- Mobile header 1280px+ ekranlarda gizlenir: `xl:hidden` (zorunlu)

#### MobileHeaderLeft

**Dosya**: `src/components/header/mobile-header-left.tsx`

**Responsibility:**
- Logo render (Home variant)
- Back button render (Detail variant)
- **Not:** Hamburger menü V1'de kullanılmayacak. Ana menü hub'ı `/account` sayfasıdır.

#### MobileHeaderCenter

**Dosya**: `src/components/header/mobile-header-center.tsx`

**Responsibility:**
- Page title render (truncate, scroll-aware opacity)
- Search collapsed icon (Home variant)
- Search expanded input (Search Mode)

#### MobileHeaderRight

**Dosya**: `src/components/header/mobile-header-right.tsx`

**Responsibility:**
- Action icons render (max 2)
- More menu trigger (3+ actions varsa)
- Badge rendering (cart, notifications)

#### SearchField

**Dosya**: `src/components/header/search-field.tsx`

**States:**
- Collapsed: Icon button
- Expanded: Full-width input + Cancel button

**Features:**
- Autofocus (expanded mode)
- Debounced search query
- Keyboard handling (Enter, Escape)

#### MoreMenu

**Dosya**: `src/components/header/more-menu.tsx`

**Implementation:**
- Mobile: Shadcn `Sheet` component (bottom sheet)
- Actions listesi
- Icon + label format
- **Not:** Desktop için `DropdownMenu` kullanılır ancak mobile header kapsamı dışındadır

### Typography

**Title Class Önerisi:**
```tsx
<h1 className="font-semibold tracking-tight text-sm truncate max-w-[200px]">
  {title}
</h1>
```

**Varyantlar:**
- `text-sm`: Standart font boyutu (layout breakpoint kuralını değiştirmez)
- `text-base`: Alternatif font boyutu (sadece typography micro-tuning, layout yalnızca base + xl yaklaşımına göre düşünülür)
- `truncate`: Uzun title'lar için
- `max-w-[200px]`: Center slot genişlik limiti

---

## 4. Scroll & Interaction Behaviors

**Kural:** Tek bir scroll handler kullanılır; aynı handler içinde `isScrolled` (y>10), `titleOpacity/showTitle` ve gerekiyorsa `heroThreshold` hesapları güncellenir.

### Scroll-Aware State

**State Yönetimi:**
```tsx
const [isScrolled, setIsScrolled] = useState(false);

useEffect(() => {
  let ticking = false;
  
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 10);
        ticking = false;
      });
      ticking = true;
    }
  };
  
  // Mount olduğunda scroll state'i senkronize et (restore/refresh senaryoları için)
  handleScroll();
  
  // Tek scroll listener, passive ile performans optimizasyonu
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Cleanup: Listener'ı kaldır
  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
}, []);
```

**Initial Sync Kuralı:** Mount olduğunda scroll state'i senkronize etmek için handler ilk render'da bir kez çağrılır (`handleScroll()`), böylece restore/refresh senaryolarında başlangıç state'i doğru olur.

**GlassContainer Kullanımı (Zorunlu):**
- GlassContainer wrapper **her zaman** kullanılır
- `y = 0`: Glass efekti class ile devre dışı: `bg-transparent backdrop-blur-0 border-transparent` (immersive)
- `y > 10`: Glass efekti aktif: `bg-background/80 backdrop-blur-md border-border` (glass)
- Border: Default `rounded-none border-0 border-b`, sadece alt kenar border kullanılır (4 kenar border riski yok)

**CSS Transition (GlassContainer className):**
```tsx
<GlassContainer
  rounded="none"
  className={cn(
    "border-0 border-b transition-colors duration-300",
    isScrolled 
      ? "bg-background/80 backdrop-blur-md border-border" 
      : "bg-transparent backdrop-blur-0 border-transparent"
  )}
>
  {/* Header content */}
</GlassContainer>
```

**Önemli:** GlassContainer her zaman kullanılır, glass efekti class override ile kontrol edilir.

### Detail Variant Title Opacity

**Threshold Tanımı:**
- Hero section height veya sabit 200px
- Scroll position > threshold: Title `opacity-100`
- Scroll position < threshold: Title `opacity-0`

**Implementation (Tek Handler İçinde):**
```tsx
// Tek scroll handler içinde hem isScrolled hem showTitle güncellenir
const [isScrolled, setIsScrolled] = useState(false);
const [showTitle, setShowTitle] = useState(false);
const heroRef = useRef<HTMLDivElement>(null);
const threshold = heroRef.current?.offsetHeight ?? 200; // heroRef varsa onu kullan, yoksa 200px

useEffect(() => {
  let ticking = false;
  
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 10);
        // Threshold'u her scroll'da güncelle (heroRef değişebilir)
        const currentThreshold = heroRef.current?.offsetHeight ?? 200;
        setShowTitle(window.scrollY > currentThreshold);
        ticking = false;
      });
      ticking = true;
    }
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

**CSS:**
```tsx
<h1 className={cn(
  "font-semibold text-sm truncate transition-opacity duration-300",
  showTitle ? "opacity-100" : "opacity-0"
)}>
  {title}
</h1>
```

### Interaction Behaviors

#### Touch Feedback
- **Active State**: `active:scale-95` (Button pressable prop)
- **Focus-Visible**: Keyboard navigation için tam ring seti: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` (glass/blur üstünde ring'in kaybolmaması için offset önemli)

#### Search Mode Transitions
- **Open**: Input autofocus, expanded layout
- **Close**: Input blur, state reset, collapsed layout
- **Animation**: Framer Motion `AnimatePresence` ile smooth transition

**Example:**
```tsx
<AnimatePresence>
  {isSearchOpen ? (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <input autoFocus />
    </motion.div>
  ) : (
    <IconWrapper onClick={handleSearchOpen}>
      <Icons.search />
    </IconWrapper>
  )}
</AnimatePresence>
```

#### Cancel Button Behavior
- Click: Input blur + `onSearchClose()` callback
- State reset: Search query temizlenir
- Layout: Collapsed mode'a dönüş

### Page Transitions

**Route Değişiminde Jump Önleme:**

1. **Layout Stabilite:**
   - Header yüksekliği sabit (`h-14`)
   - Slot'ların genişlikleri tutarlı
   - Initial render'da skeleton/placeholder kullan

2. **Animation Uyumu:**
   - Framer Motion `layoutId` kullan (aynı element farklı sayfalarda)
   - `initial` ve `animate` prop'ları tutarlı
   - Jump yok: `layout="position"` veya `layout={false}`

3. **Hydration Mismatch Minimizasyonu:**
   - Client-only logic: `useEffect` içinde state set
   - SSR-safe: Initial render'da default state
   - `suppressHydrationWarning` kullan (gerekirse)

**Example:**
```tsx
'use client';

export function MobileHeader({ variant, title }: MobileHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Client-only scroll listener (tek listener, rAF + passive)
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  return (
    <header className="fixed top-0 w-full z-50 xl:hidden">
      <GlassContainer
        rounded="none"
        className={cn(
          "border-0 border-b transition-colors duration-300",
          isScrolled 
            ? "bg-background/80 backdrop-blur-md border-border" 
            : "bg-transparent backdrop-blur-0 border-transparent"
        )}
      >
        <div className="relative flex items-center h-14 px-4 pt-[env(safe-area-inset-top,0px)]">
          {/* 3-column grid */}
        </div>
      </GlassContainer>
    </header>
  );
}
```

---

## 5. Context & Logic Handling (The Brain)

### Props Interface

**MobileHeader Props:**
```tsx
interface MobileHeaderProps {
  // Zorunlu
  variant: 'home' | 'category' | 'detail' | 'profile';
  
  // Opsiyonel
  title?: string;
  rightActions?: Array<{
    icon: keyof typeof Icons;
    label: string;
    onClick?: () => void;
    href?: string;
    badge?: number;
    disabled?: boolean;
  }>;
  onBack?: () => void;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  className?: string;
}
```

**Not:** `showHamburger` prop'u V1'de kullanılmayacak. Hamburger menü yerine `/account` sayfası ana menü hub'ı olarak kullanılır.

**Variant Açıklamaları:**
- `home`: Ana sayfa, transparent başlangıç
- `category`: Kategori sayfası, title ile
- `detail`: Ürün/detay sayfası, back button + title
- `profile`: Profil/hesap sayfası, back button + title

### Variant Seçim Standardı (Route → Variant Mapping)

**Prensip:** Variant her sayfada elle setlenmez. Tek bir helper function ile route → variant mapping yapılır.

**Önerilen Standart:**
```tsx
function getMobileHeaderVariant(pathname: string): 'home' | 'category' | 'detail' | 'profile' {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/urun/')) return 'detail';
  if (pathname.startsWith('/account')) return 'profile';
  if (pathname.startsWith('/') && pathname !== '/') return 'category';
  return 'home';
}
```

**Route → Variant Mapping:**
- `/` → `home`
- `/urun/[slug]` → `detail`
- `/account/*` → `profile`
- Diğer tüm route'lar (kategori, sayfa vb.) → `category`

**Kullanım:**
```tsx
const pathname = usePathname();
const variant = getMobileHeaderVariant(pathname);
```

**Not:** Bu helper function root layout veya header wrapper component'inde kullanılır. Her sayfa kendi variant'ını belirlemez.

### Auth State Integration

**Varsayım:**
- `useAuth` hook veya Next.js 15+ `useSession` (NextAuth)
- Session state: `{ user: User | null, isLoading: boolean }`

**Entegrasyon Stratejisi:**

**Guest State:**
```tsx
const { user, isLoading } = useAuth();

if (!user && !isLoading) {
  // Right slot: Login/Sign Up trigger
  rightActions = [
    {
      icon: 'user',
      label: 'Giriş Yap',
      onClick: () => router.push('/login'),
    }
  ];
}
```

**User State:**
```tsx
if (user) {
  // Right slot: Cart + Avatar/Profile (ana menü hub'ı)
  rightActions = [
    {
      icon: 'cart',
      label: 'Sepet',
      href: '/cart',
      badge: cartCount,
    },
    {
      icon: 'user',
      label: 'Profil',
      href: '/account', // Ana menü hub'ı
      // veya Avatar component
    }
  ];
}
```

**Not:** Header'daki "Profile" aksiyonu `/account` sayfasına götürür. Bu sayfa ana menü hub'ı olarak kullanılır (hamburger menü yerine).

**Loading State:**
- Skeleton veya placeholder göster
- `isLoading` true ise disabled state

### Dynamic Title (Detail Variant)

**Scroll ile Opacity Transition:**
- Hero section üstündeyken: `opacity-0`
- Hero geçince: `opacity-100`
- Smooth transition: `duration-300`

**Implementation (Tek Handler İçinde):**
```tsx
// Tek scroll handler içinde hem isScrolled hem titleOpacity güncellenir
const [isScrolled, setIsScrolled] = useState(false);
const [titleOpacity, setTitleOpacity] = useState(0);
const heroRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  let ticking = false;
  
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 10);
        
        // heroRef varsa onu kullan, yoksa 200px fallback
        const heroHeight = heroRef.current?.offsetHeight ?? 200;
        const scrollY = window.scrollY;
        setTitleOpacity(Math.min(scrollY / heroHeight, 1));
        
        ticking = false;
      });
      ticking = true;
    }
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

### Action Routing

**Standart Hedefler:**
- Cart: `/cart`
- Wishlist: `/account/wishlist`
- Profile: `/account`
- Notifications: `/account/notifications` (veya modal)
- Search: Search mode açılır (route değişmez)

**Routing Implementation:**
```tsx
const router = useRouter();

const handleActionClick = (action: RightAction) => {
  if (action.href) {
    router.push(action.href);
  } else if (action.onClick) {
    action.onClick();
  }
};
```

### Analytics/Haptics Readiness

**Haptic Hook Entegrasyon Noktaları:**

1. **Icon Click:**
```tsx
const handleIconClick = () => {
  // Haptic feedback (iOS/Android)
  if (window.navigator.vibrate) {
    window.navigator.vibrate(10); // 10ms haptic
  }
  
  // Analytics
  trackEvent('header_action_click', { action: 'search' });
  
  // Business logic
  onSearchOpen?.();
};
```

2. **Search Submit:**
```tsx
const handleSearchSubmit = (query: string) => {
  // Haptic feedback
  if (window.navigator.vibrate) {
    window.navigator.vibrate(20);
  }
  
  // Analytics
  trackEvent('search_submit', { query });
  
  // Navigation
  router.push(`/search?q=${query}`);
};
```

3. **Back Button:**
```tsx
const handleBack = () => {
  // Haptic feedback
  if (window.navigator.vibrate) {
    window.navigator.vibrate(10);
  }
  
  // Navigation
  router.back();
};
```

**Hook Point Dokümantasyonu:**
- Her interaktif element için haptic hook noktası belirtilmiş
- Implementation: `useHaptic` custom hook (gelecekte eklenecek)
- **Not:** `navigator.vibrate` Android'de fallback olabilir; iOS Safari'de genellikle çalışmaz. iOS için gerçek haptics ancak native bridge/wrapper ile sağlanabilir. Bu doküman sadece hook point tanımlar.

---

## 6. Account (Profile) Page as Main Menu Hub (No Hamburger)

**Kapsam Notu:** Bu bölüm mobile header'ın dışında kalan içerikleri (Account sayfası yapısı) açıklar. Header ile ilgili kısımlar (variant, right actions) yukarıdaki bölümlerde belirtilmiştir. Bu bölüm, header'ın `/account` sayfasına yönlendirdiği kullanıcıların göreceği sayfa yapısını tanımlar.

**Related Docs:** Account sayfası implementasyonu için ayrı bir dokümantasyon gerekebilir. Bu bölüm sadece header ile ilişkili kısımları ve genel sayfa yapısını özetler.

### Amaç / Neden

Bu projede **hamburger menü kullanılmayacak**. Bunun yerine `/account` (Profile) sayfası "Main Menu Hub" olarak görev yapar.

**Tasarım Mantığı:**
- Header'da sağdaki "Profile" aksiyonu (ikon veya Avatar) `/account` sayfasına götürür
- Kullanıcı ana menüye bu sayfadan erişir
- Hamburger menü V1'de non-goal/future olarak işaretlenmiştir
- Mobile header variant'larında hamburger opsiyonu yoktur; profil entrypoint standardı kullanılır

**Mobile Header ile Bağlantı:**
- Mobile header "profile" variant'ında sağ aksiyon:
  - Guest: Login trigger (`/login` veya `/signup`)
  - User: Avatar/Profil ikonu → `/account` route'una gider
- "Main menu hub" olduğu için header'da hamburger yerine profil entrypoint standardı kullanılır

### Sayfa Bölümleme Mantığı (GlassContainer / Card)

Sayfa 3 ana bölüme ayrılır; her bölüm `GlassContainer` veya Shadcn `Card` component'i ile görsel olarak ayrışır.

#### A) Header Section (Profile Hero)

**Yapı:**
- Büyük Avatar (72-96px), kullanıcı adı, alt bilgi (opsiyonel email)
- "Edit Profile" butonu (Shadcn Button, opsiyonel `pressable` prop)
- Layout: Touch-first spacing, tek sütun, temiz hizalama

**Guest State:**
- Avatar yerine placeholder (büyük ikon veya default avatar)
- "Giriş Yap / Üye Ol" CTA butonu (Shadcn Button, primary variant)
- Guest state'de profil bilgileri görünmez

**Container:**
- `GlassContainer` veya `Card` component kullanılır
- Padding: `px-4 py-6` (touch-first spacing)
- Border/Radius: `rounded-lg border` (GlassContainer için `rounded="lg"`)

**Örnek Yapı:**
```tsx
<GlassContainer rounded="lg" className="px-4 py-6">
  {user ? (
    <>
      <Avatar className="h-24 w-24 mb-4">
        <AvatarImage src={user.image} alt={user.name} />
        <AvatarFallback>
          <Icons.user className="h-12 w-12" />
        </AvatarFallback>
      </Avatar>
      <h2 className="text-xl font-semibold">{user.name}</h2>
      {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
      <Button variant="outline" className="mt-4" pressable>
        Profili Düzenle
      </Button>
    </>
  ) : (
    <>
      <Avatar className="h-24 w-24 mb-4">
        <AvatarFallback>
          <Icons.user className="h-12 w-12" />
        </AvatarFallback>
      </Avatar>
      <Button variant="default" className="mt-4" pressable href="/login">
        Giriş Yap / Üye Ol
      </Button>
    </>
  )}
</GlassContainer>
```

#### B) Dashboard Grid (Quick Actions) — 2x2 Grid

**Yapı:**
- 4 hızlı aksiyon kartı (ikon + label)
- Grid: `grid grid-cols-2 gap-3` (yalnızca mobile-first, breakpoint kuralı değişmez)
- Her hücre: `Card` veya `GlassContainer` içinde

**Aksiyonlar:**
1. **Orders** → `/account/orders`
   - İkon: `Icons.cart` veya uygun order ikonu
   - Label: "Siparişlerim"
2. **Messages** → `/account/messages` (TODO: route netleşecek)
   - İkon: `Icons.user` veya message ikonu (Icons mapping'e eklenecek)
   - Label: "Mesajlarım"
3. **Wishlist** → `/account/wishlist`
   - İkon: `Icons.heart`
   - Label: "Favorilerim"
4. **Coupons** → `/account/coupons`
   - İkon: `Icons.cart` veya uygun coupon ikonu
   - Label: "Kuponlarım"

**Her Hücre Yapısı:**
- `Card` veya `GlassContainer` wrapper
- İçerik: `IconWrapper` ile ikon (min 44x44px touch target)
- Label: Kısa, net metin
- Tüm kart tıklanabilir (Link veya Button wrapper)

**Örnek Yapı:**
```tsx
<div className="grid grid-cols-2 gap-3">
  <Link href="/account/orders">
    <Card className="p-4 flex flex-col items-center gap-2">
      <IconWrapper className="w-12 h-12">
        <Icons.cart className="h-6 w-6" />
      </IconWrapper>
      <span className="text-sm font-medium">Siparişlerim</span>
    </Card>
  </Link>
  {/* Diğer kartlar... */}
</div>
```

**İkon Seçimi:**
- `Icons.cart` (Orders, Coupons)
- `Icons.heart` (Wishlist)
- `Icons.user` (Messages - geçici, uygun ikon Icons mapping'e eklenecek)
- İkonlar `src/components/ui/icons.tsx` içindeki `Icons` mapping'inden kullanılır

#### C) General Menu List (Hamburger Replacement) — Gruplu Dikey Liste

**Yapı:**
- Liste item yapısı: Sol (ikon), Orta (başlık + opsiyonel açıklama), Sağ (chevron)
- Tüm satır tıklanabilir, 44px min yükseklik
- `IconWrapper`/Button style yaklaşımı
- Gruplar: Başlık + `Card`/`GlassContainer` içinde liste

**Liste Item Yapısı:**
```tsx
<Link href="/route" className="flex items-center gap-3 px-4 py-3 min-h-[44px]">
  <IconWrapper className="w-10 h-10">
    <Icons.iconName className="h-5 w-5" />
  </IconWrapper>
  <div className="flex-1">
    <span className="font-medium">Başlık</span>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
  <Icons.forward className="h-5 w-5 text-muted-foreground" />
</Link>
```

**Gruplar:**

**Group 1 (App):**
- Notification Settings → `/account/settings` (veya settings modal)
- Language → `/account/settings` (veya settings modal)
- Currency → `/account/settings` (veya settings modal)

**Group 2 (Support):**
- Help Center → `/support`
- Contact Us → `/support` (veya contact modal)
- Legal/Terms → Mevcut hukuki route'lara bağlanır:
  - Mesafeli Satış Sözleşmesi → `/mesafeli-satis-sozlesmesi`
  - Çayma ve İade Koşulları → `/cayma-ve-iade-kosullari`
  - Gizlilik ve Güvenlik → `/gizlilik-ve-guvenlik`

**Group 3 (Danger):**
- Log Out → Logout action (onClick handler)
- Delete Account → Delete account action (confirm modal ile)

**Danger Grup Style:**
- Kırmızı tonlu text: `text-destructive` veya `text-red-600`
- Border (opsiyonel): `border-destructive/20`
- Badge success/warning/info style referansı: Shadcn Badge `variant="destructive"` kullanılabilir
- "Delete Account" için confirm modal: Shadcn `AlertDialog` component önerilir

**Örnek Yapı:**
```tsx
<GlassContainer rounded="lg" className="px-4 py-2">
  <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-4">Uygulama</h3>
  <div className="space-y-1">
    <Link href="/account/settings" className="flex items-center gap-3 px-4 py-3 min-h-[44px]">
      <IconWrapper className="w-10 h-10">
        <Icons.user className="h-5 w-5" />
      </IconWrapper>
      <span className="flex-1 font-medium">Bildirim Ayarları</span>
      <Icons.forward className="h-5 w-5 text-muted-foreground" />
    </Link>
    {/* Diğer item'lar... */}
  </div>
</GlassContainer>

<GlassContainer rounded="lg" className="px-4 py-2 border-destructive/20">
  <h3 className="text-sm font-semibold text-destructive mb-2 px-4">Tehlikeli İşlemler</h3>
  <div className="space-y-1">
    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 min-h-[44px] w-full text-left text-destructive">
      <IconWrapper className="w-10 h-10">
        <Icons.user className="h-5 w-5" />
      </IconWrapper>
      <span className="flex-1 font-medium">Çıkış Yap</span>
    </button>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="flex items-center gap-3 px-4 py-3 min-h-[44px] w-full text-left text-destructive">
          <IconWrapper className="w-10 h-10">
            <Icons.user className="h-5 w-5" />
          </IconWrapper>
          <span className="flex-1 font-medium">Hesabı Sil</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {/* Confirm dialog içeriği */}
      </AlertDialogContent>
    </AlertDialog>
  </div>
</GlassContainer>
```

### Interaction & States

**Tap Feedback:**
- `IconWrapper` ve `Button` component'leri `pressable` prop ile active feedback sağlar
- `active:scale-95` transition ile native-like his

**Navigation:**
- Liste item'larına tıklama → route push (`router.push(href)`)
- Button item'larına tıklama → onClick handler çalışır

**Loading/Disabled State:**
- Session yüklenirken: Skeleton component veya placeholder avatar
- Disabled state: `opacity-50 pointer-events-none` class'ları

**Auth Awareness:**
- **Guest:** 
  - Profile Hero'da "Giriş Yap/Üye Ol" CTA
  - Dashboard Grid ve General Menu List görünmez (veya disabled state)
- **User:**
  - Avatar + isim + email görünür
  - Tüm menü item'ları aktif
  - Logout ve Delete Account görünür

### UI Token Notları

**Bölüm Container Padding/Gap:**
- Ana container: `px-4` (horizontal padding)
- Bölümler arası: `space-y-4` veya `gap-4` (vertical spacing)
- Liste item padding: `px-4 py-3` (touch-first, min 44px yükseklik)

**Card/GlassContainer Radius/Border:**
- Radius: `rounded-lg` (GlassContainer için `rounded="lg"`)
- Border: `border` (default border token)
- Danger grup: `border-destructive/20` (subtle kırmızı border)

**Typography:**
- Başlıklar: `font-semibold text-sm` (grup başlıkları)
- Liste item başlık: `font-medium` (item label)
- Açıklama: `text-xs text-muted-foreground` (opsiyonel alt metin)

**Spacing:**
- Grid gap: `gap-3` (dashboard grid)
- Liste item gap: `gap-3` (ikon, metin, chevron arası)
- Bölümler arası: `space-y-4` (vertical spacing)

---

## 7. Accessibility Checklist

### ARIA Labels

**Zorunlu:**
- Tüm icon button'lar: `aria-label` prop'u
- Search input: `aria-label="Ara"` veya `aria-labelledby`
- More menu: `aria-label="Daha fazla seçenek"`

**Example:**
```tsx
<IconWrapper onClick={handleSearch} aria-label="Ara">
  <Icons.search className="w-5 h-5" />
</IconWrapper>
```

### ARIA Current

**Active State:**
- Current page indicator (isteğe bağlı)
- `aria-current="page"` (home link, active state)

### Focus-Visible

**Keyboard Navigation:**
- Tüm interactive element'ler: Tam focus-visible ring seti (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`)
- Tab order: Mantıklı sıralama (left → center → right)
- Skip link: Ana içeriğe atlama (isteğe bağlı)

**Implementation:**
```tsx
<IconWrapper
  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
>
  {/* Icon */}
</IconWrapper>
```

### Reduced Motion

**Respect User Preferences:**
```tsx
const prefersReducedMotion = useReducedMotion();

<AnimatePresence>
  <motion.div
    initial={prefersReducedMotion ? {} : { opacity: 0 }}
    animate={prefersReducedMotion ? {} : { opacity: 1 }}
    transition={prefersReducedMotion ? {} : { duration: 0.2 }}
  >
    {/* Content */}
  </motion.div>
</AnimatePresence>
```

**CSS:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support

- Semantic HTML: `<header>`, `<nav>`, `<button>`
- Hidden text: `sr-only` class (gerekirse)
- Live regions: Search results için `aria-live` (isteğe bağlı)

---

## 8. Performance Notes

### Scroll Listener Optimizasyonu

**Tek Scroll Listener + rAF + Passive:**
```tsx
useEffect(() => {
  let ticking = false;
  
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 10);
        ticking = false;
      });
      ticking = true;
    }
  };
  
  // Passive listener: Scroll performansını artırır
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Cleanup: Listener'ı kaldır (memory leak önleme)
  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
}, []);
```

**Not:** Dependency eklemeden (lodash gibi) native rAF + passive listener kullanılır. Tek scroll listener yeterlidir, cleanup zorunludur.

### Framer Motion Kullanım Sınırı

**Best Practices:**
- Sadece gerekli animasyonlar için kullan
- `layout={false}` kullan (gereksiz layout animasyonları önle)
- `will-change` CSS property kullan (GPU acceleration)

**Performance Impact:**
- Çok fazla animasyon: 60fps düşebilir
- Öneri: Sadece search mode transition ve title fade-in için kullan

### Lazy Loading

**Code Splitting:**
```tsx
const MoreMenu = dynamic(() => import('./more-menu'), {
  ssr: false,
});
```

**Conditional Rendering:**
- More menu sadece gerektiğinde render
- Search field sadece expanded mode'da render

### Memoization

**React.memo:**
```tsx
export const MobileHeaderLeft = React.memo(({ variant, onBack }: Props) => {
  // Component logic
});
```

**useMemo:**
```tsx
const rightActionsMemo = useMemo(() => {
  return rightActions?.slice(0, 2) || [];
}, [rightActions]);
```

---

## 9. CSS/Token Notes

### Background Token

**Glassmorphism:**
- `bg-background/80` - %80 opacity
- `backdrop-blur-md` - Medium blur (Tailwind default: 12px)

**State Transitions (GlassContainer zorunlu kullanım):**
- GlassContainer wrapper her zaman kullanılır
- `y = 0`: `bg-transparent backdrop-blur-0` (glass devre dışı)
- `y > 10`: `bg-background/80 backdrop-blur-md` (glass aktif)

### Border Token

**Border Standardı:**
- GlassContainer'a default: `rounded-none border-0 border-b` (sadece alt kenar)
- `y = 0`: `border-transparent` (görünmez)
- `y > 10`: `border-border` (görünür)
- **Kural:** 4 kenar border kullanılmaz, sadece `border-b` (alt kenar) kullanılır

**Border Color:**
- `border-border` - Theme token
- State transition: `border-transparent` (y = 0) → `border-border` (y > 10)

### Ring Token

**Focus Ring:**
- `ring-ring` - Theme token
- `ring-offset-2` - Offset (accessibility)

**Usage:**
```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```

**Not:** `ring-offset-*` özellikle glass/blur üstünde ring'in kaybolmaması için çok önemlidir. IconWrapper ve Button component'lerinde bu tam set standardize edilmelidir.

### Shadow Token

**Elevation (isteğe bağlı):**
- Glass aktifken subtle shadow: `shadow-sm`
- Z-index ile yeterli, shadow genelde gerekmez

### Spacing Tokens

**Padding:**
- Horizontal: `px-4` (16px)
- Vertical: Header yüksekliği içinde (`h-14` = 56px)

**Gap:**
- Slot'lar arası: `gap-2` (8px)
- Icon'lar arası: `gap-1` (4px) veya `gap-2` (8px)

### Typography Tokens

**Font:**
- `font-semibold` - Title için
- `tracking-tight` - Letter spacing
- `text-sm` veya `text-base` - Size

**Color:**
- `text-foreground` - Default text color
- `text-muted-foreground` - Secondary text (isteğe bağlı)

---

## 10. Testing Plan

### Breakpoint Testleri

**1279px / 1280px Ayrımı (Zorunlu Kural):**
- 0-1279px: Mobile header görünür (`xl:hidden` class'ı ile 1280px+ gizlenir)
- 1280px+ (xl breakpoint): Mobile header **görünmez** (`xl:hidden`), desktop header görünür (bu doküman dışı)
- Test: Window resize, responsive mode (DevTools), `xl:hidden` class'ının çalıştığını doğrula

### Scroll Threshold Testleri

**Home Variant:**
- `y = 0`: Transparent background
- `y = 10`: Glass background aktif
- Test: Scroll position değişimi, smooth transition

**Detail Variant:**
- Hero üstü: Title opacity 0
- Hero geçince: Title opacity 1
- Test: Farklı hero height'lar, threshold accuracy

### Search Mode Testleri

**State Transitions:**
- Collapsed → Expanded: Input autofocus, layout değişimi
- Expanded → Collapsed: Input blur, state reset
- Cancel button: State reset, layout değişimi

**Keyboard:**
- Enter: Search submit
- Escape: Search close
- Tab: Focus management

### Auth States Testleri

**Guest:**
- Right slot: Login/Sign Up trigger
- Avatar görünmez
- Cart badge görünmez (veya görünür, guest cart)

**User:**
- Right slot: Cart + Avatar (veya More menu)
- Cart badge: Sayı gösterimi
- Avatar: User image veya fallback

**Loading:**
- Skeleton/placeholder gösterimi
- Disabled state

### Edge Cases

**Empty States:**
- Title yok: Center slot boş
- Actions yok: Right slot boş
- Back button yok: Left slot sadece logo

**Long Titles:**
- Truncate: `truncate` class çalışıyor mu?
- Max width: Center slot genişlik limiti

**Many Actions:**
- 3+ actions: More menu görünür mü?
- More menu içeriği: Tüm actions listeleniyor mu?

**Network Errors:**
- Retry button (isteğe bağlı)
- Error state gösterimi

### Browser Compatibility

**iOS Safari:**
- Safe area inset (notch)
- Keyboard açılışında layout
- Scroll behavior

**Android Chrome:**
- Touch feedback
- Haptic support (vibration API)

**Desktop (1280px+ / xl breakpoint):**
- Mobile header **görünmez** (`xl:hidden` zorunlu kural)
- Desktop header görünür (bu doküman dışı)
- Test: `xl:hidden` class'ının doğru çalıştığını doğrula

---

## 11. Non-goals (V1 Dışı)

### Desktop Header

- 1280px+ ekranlar: Desktop header implementasyonu
- Mega menu, complex navigation
- Bu doküman mobile header için, desktop kapsam dışı

### Complex Animations

- Parallax effects
- 3D transforms
- Complex page transitions
- V1: Sadece basit fade-in/out, scale transitions

### Advanced Features

- Voice search
- Barcode scanner
- AR features
- V1: Sadece text search

### Hamburger Menu

- Hamburger menü V1'de kullanılmayacak
- Ana menü hub'ı `/account` (Profile) sayfasıdır
- Hamburger menü future/non-goal olarak işaretlenmiştir

### Internationalization (i18n)

- Multi-language support
- RTL (Right-to-Left) layout
- V1: Sadece Türkçe, LTR

### Offline Support

- Service Worker integration
- Offline search
- Cache management
- V1: Online-only

### Analytics Integration

- Detailed event tracking
- User behavior analysis
- A/B testing
- V1: Basic event hooks (haptic hook points)

---

## 12. Icon İsim Standardı

**Kural:** Tüm icon referansları `Icons` mapping dosyasındaki (`src/components/ui/icons.tsx`) tek isim setini kullanır.

**Standart İsimler:**
- `Icons.cart` - Sepet ikonu (ShoppingBag Lucide icon'u map edilir)
- `Icons.search` - Arama ikonu
- `Icons.user` - Kullanıcı/profil ikonu
- `Icons.heart` - Favori/beğeni ikonu
- `Icons.back` - Geri butonu (ChevronLeft)
- `Icons.forward` - İleri butonu (ChevronRight)
- `Icons.more` - Daha fazla menü (MoreHorizontal)
- `Icons.close` - Kapat butonu (X)
- `Icons.menu` - Menü ikonu (Menu)

**Kullanım:**
- Dokümantasyondaki tüm örnekler bu standart isimleri kullanır
- `Icons.shoppingBag` gibi alternatif isimler kullanılmaz, `Icons.cart` kullanılır
- Yeni icon'lar eklendiğinde `Icons` mapping dosyasına eklenir ve dokümantasyon güncellenir

---

## Sonuç

Bu doküman, mobile header sisteminin implementasyonu için tek referans kaynağıdır. Tüm teknik kararlar, component yapısı, state management, ve edge case'ler burada belirtilmiştir.

**Implementation Sırası Önerisi:**
1. Atoms (GlassContainer, IconWrapper) - Zaten mevcut
2. MobileHeader root component + 3-column grid
3. Variant A (Home) - Basit başlangıç
4. Scroll-aware state
5. Variant B (Detail) - Back button + title
6. Variant C (Search Mode)
7. Auth state integration
8. More menu (3+ actions)
9. Performance optimizasyonları
10. Accessibility improvements
11. Testing

**Not:** Bu doküman, Cursor AI'ın direkt kodlayabileceği kadar detaylıdır. Tüm component'ler, props, state management, ve CSS class'ları belirtilmiştir.

---

## Değişiklik Özeti

Bu dokümantasyon güncellemesinde aşağıdaki standartlar ve kurallar eklendi/temizlendi:

1. **Content Offset Standardı:** Header fixed olduğu için sayfa içeriğinin header altında kalmaması için zorunlu offset kuralı eklendi. Main/content wrapper için `padding-top: calc(56px + env(safe-area-inset-top, 0px))` standardı belirlendi.

2. **Button / Pressable Netliği:** Button component'inin `pressable` prop'unu desteklediği netleştirildi. Header içinde genel olarak `IconWrapper` kullanımı standart olarak belirtildi.

3. **Icon İsim Standardı:** Tüm icon referansları tek standarda bağlandı. `Icons.shoppingBag` gibi alternatif isimler yerine `Icons.cart` kullanımı standartlaştırıldı. Yeni "Icon İsim Standardı" bölümü eklendi.

4. **More Menu Kuralı:** Mobile'da `Sheet` (bottom sheet), Desktop'ta `DropdownMenu` kullanımı netleştirildi. Mobile header kapsamında `Sheet` standardı belirlendi.

5. **Variant Seçim Standardı:** Variant'ın her sayfada elle setlenmemesi prensibi eklendi. `getMobileHeaderVariant(pathname)` helper function önerisi ve route → variant mapping tablosu eklendi.

6. **Scroll Threshold Standardı:** Hero section threshold hesaplaması netleştirildi. `heroRef.current?.offsetHeight ?? 200` algoritması standart olarak belirlendi. Tüm örneklerde bu kural uygulandı.

7. **Kapsam Temizliği:** Account (Profile) Page bölümüne "Kapsam Notu" eklendi. Header dışı içeriklerin bu dokümanın kapsamı dışında olduğu, ancak header ile ilişkili kısımların burada belirtildiği netleştirildi.

