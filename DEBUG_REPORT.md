# Debug Raporu: Guest Kullanıcı Checkout'ta Unauthorized Hatası

## Problem Özeti
Guest (login olmayan) kullanıcı checkout'ta "Yeni Adres > Adresi Kaydet" dediğinde `Unauthorized` hatası alıyor. Network'te `POST /checkout` (text/x-component, next-action header'lı) görünüyor ve response `{ ok:false, error:"Unauthorized" }`.

---

## 1) Checkout Adres Ekleme Akışı Haritası

### Bulgular:

**Checkout Sayfası:**
- **Dosya:** `src/app/checkout/page.tsx`
- **Component:** Client component ("use client")
- **AddressForm Kullanımı:** Satır 306'da `<AddressForm open={showAddressForm} onOpenChange={setShowAddressForm} />`
- **Modal Açılış:** "Yeni Adres" butonu tıklandığında `setShowAddressForm(true)` çağrılıyor (satır 137, 152)
- **Mode Prop:** ❌ **KRİTİK BULGU:** `AddressForm`'a `mode="checkout"` prop'u **GEÇİLMİYOR**
- **Address List State:** `addresses` state'i `useState<Address[]>([])` ile yönetiliyor (satır 28)
- **State Güncelleme:** `getAddressesAction()` sonucunda `setAddresses(result.addresses)` ile **replace** ediliyor (satır 41)
- **Address List Yükleme:** `useEffect` içinde sayfa yüklendiğinde `getAddressesAction()` çağrılıyor (satır 36-53)

**Kritik Kod:**
```306:306:src/app/checkout/page.tsx
      <AddressForm open={showAddressForm} onOpenChange={setShowAddressForm} />
```

**Sonuç:** Checkout sayfası AddressForm'u sadece `open` ve `onOpenChange` prop'larıyla çağırıyor. `mode` prop'u yok, bu yüzden AddressForm checkout context'ini bilmiyor.

---

## 2) AddressForm'un Gerçek Submit Mekanizması

### Bulgular:

**AddressForm Component:**
- **Dosya:** `src/components/account/address-form.tsx`
- **Submit Mekanizması:** `react-hook-form`'un `handleSubmit` wrapper'ı kullanılıyor (satır 48, 98, 205)
- **Form Action:** ❌ `<form action={serverAction}>` kullanılmıyor
- **useFormState/useActionState:** ❌ Kullanılmıyor
- **Submit Handler:** `onSubmit` async fonksiyonu (satır 63-86) direkt `addAddressAction(data)` çağırıyor (satır 68)

**Guest Gate Kontrolü:**
- ❌ **KRİTİK BULGU:** AddressForm'da **HİÇBİR guest kontrolü yok**
- ❌ `useSession` / `useAuth` hook'u kullanılmıyor
- ❌ `mode === "checkout"` kontrolü yok (çünkü mode prop'u yok)
- ❌ Guest iken `addAddressAction` çağrısını engelleyen bir mekanizma yok

**Kritik Kod:**
```63:86:src/components/account/address-form.tsx
  const onSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await addAddressAction(data);
      if (result.ok) {
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        if (result.error === "Validation error" && result.errors) {
          const firstError = result.errors[0];
          setError(firstError?.message || "Form hatası");
        } else {
          setError(result.error || "Adres eklenirken bir hata oluştu");
        }
      }
    } catch (err) {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };
```

**Form Render:**
```98:98:src/components/account/address-form.tsx
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-4 pb-4">
```

**Sonuç:** AddressForm guest kontrolü yapmadan direkt `addAddressAction` çağırıyor. Checkout context'inde kullanıldığında bile guest kullanıcılar için login'e yönlendirme yok.

---

## 3) `addAddressAction` Nerede ve Neyi Require Ediyor?

### Bulgular:

**addAddressAction Tanımı:**
- **Dosya:** `src/actions/address.ts`
- **Auth Kontrolü:** ✅ Var (satır 27-31)
- **Auth Metodu:** `await auth()` kullanılıyor (satır 27)
- **Unauthorized Koşulu:** `!session?.user?.id` durumunda `{ ok: false, error: "Unauthorized" }` dönüyor (satır 29-30)

**Kritik Kod:**
```26:48:src/actions/address.ts
export async function addAddressAction(data: z.infer<typeof addressSchema>) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const };
  }

  try {
    const validatedData = addressSchema.parse(data);
    const address = await addAddressQuery(session.user.id, validatedData);
    return { ok: true, address };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: "Validation error" as const,
        errors: error.issues,
      };
    }
    console.error("Error adding address:", error);
    return { ok: false, error: "Failed to add address" };
  }
}
```

**Server Action Davranışı:**
- Next.js Server Actions, form submit edildiğinde action'ın tanımlandığı route üzerinden çalışır
- `addAddressAction` `src/actions/address.ts` içinde tanımlı, ancak checkout sayfasından çağrıldığında Next.js bunu `/checkout` route'u üzerinden invoke eder
- Bu yüzden network'te `POST /checkout` görünüyor (Next.js Server Actions davranışı normal)

**Sonuç:** `addAddressAction` doğru şekilde auth kontrolü yapıyor ve guest kullanıcılar için `Unauthorized` dönüyor. Sorun, AddressForm'un guest kontrolü yapmadan bu action'ı çağırması.

---

## 4) Intent Sistemi Gerçekten Devreye Giriyor mu?

### Bulgular:

**Checkout Intent Sistemi:**
- ❌ **KRİTİK BULGU:** `src/lib/checkout-intent.ts` dosyası **BULUNAMADI**
- ❌ `src/components/checkout/checkout-address-intent-consumer.tsx` dosyası **BULUNAMADI**
- ❌ `saveCheckoutAddressIntent` fonksiyonu **YOK**
- ❌ Checkout sayfasında intent consumer component **YOK**

**Benzer Intent Sistemi (Favorites):**
- `src/lib/favorites-intent.ts` mevcut (favorites için intent sistemi var)
- `src/components/favorites/favorites-intent-consumer.tsx` mevcut
- Ancak checkout için intent sistemi **HİÇBİR YERDE YOK**

**Sonuç:** Plan'da bahsedilen checkout intent sistemi **implement edilmemiş**. Guest kullanıcılar için adres bilgisini geçici olarak saklayıp login sonrası geri yükleme mekanizması yok.

---

## 5) Auth Config ve Host/Cookie Uyumsuzluğu İhtimali

### Bulgular:

**Auth.js Config:**
- **Dosya:** `src/auth.ts` (satır 21-71)
- **AUTH_URL:** Config'de kullanılmıyor, sadece `AUTH_SECRET` kontrol ediliyor (satır 17-19)
- **AUTH_TRUST_HOST:** Config'de yok
- **Cookie Ayarları:** NextAuth v5 default cookie ayarları kullanılıyor, explicit override yok

**Auth Config Detayları:**
```1:42:src/auth.config.ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export default {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize fonksiyonu auth.ts'de override edilecek
      async authorize() {
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "user" | "admin" | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

**Cookie Domain/Path Override:** ❌ Yok, NextAuth v5 default'ları kullanılıyor

**Session Cookie Guest'te:**
- Guest kullanıcılarda session cookie yok (normal davranış)
- `/api/auth/session` response'u `null` dönüyor (beklenen)

**Sonuç:** Auth config'de özel cookie ayarları yok, ancak bu sorunun root cause'u değil. Guest kullanıcılarda session cookie olmaması normal.

---

## 6) Middleware / Proxy Etkisi Var mı?

### Bulgular:

**Middleware:**
- ❌ `middleware.ts` dosyası **YOK**
- ✅ `src/proxy.ts` dosyası var ama **BOŞ** (sadece `NextResponse.next()` dönüyor)

**Proxy.ts İçeriği:**
```1:12:src/proxy.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
```

**Auth Route Rewrite/Redirect:** ❌ Yok
**Checkout Route Rewrite/Redirect:** ❌ Yok
**allowedDevOrigins:** ❌ Yok

**Sonuç:** Middleware veya proxy checkout/auth davranışını etkilemiyor. Sorunun root cause'u değil.

---

## 7) "Bug'ı %100 Yeniden Üretmek" İçin Mini Senaryo

### Senaryo: Guest → Checkout → Yeni Adres → Kaydet

**Beklenen Davranış:**
1. Guest kullanıcı checkout'a gider
2. "Yeni Adres" butonuna tıklar
3. AddressForm açılır
4. Formu doldurup "Adresi Kaydet" butonuna tıklar
5. **Beklenen:** Login sayfasına yönlendirme + adres bilgisi intent olarak kaydedilir
6. Login sonrası intent consume edilir ve adres eklenir

**Gerçek Davranış:**
1. Guest kullanıcı checkout'a gider ✅
2. "Yeni Adres" butonuna tıklar ✅
3. AddressForm açılır ✅
4. Formu doldurup "Adresi Kaydet" butonuna tıklar ✅
5. **Gerçek:** `onSubmit` handler direkt `addAddressAction(data)` çağırır
6. `addAddressAction` içinde `auth()` çağrılır, session yok
7. `{ ok: false, error: "Unauthorized" }` döner
8. AddressForm error state'ine "Unauthorized" yazılır
9. ❌ Login'e yönlendirme yok, intent kaydı yok

**Exact Code Path:**
```
User clicks "Adresi Kaydet"
  → AddressForm.onSubmit() (src/components/account/address-form.tsx:63)
    → addAddressAction(data) (src/components/account/address-form.tsx:68)
      → auth() (src/actions/address.ts:27)
        → session = null (guest user)
        → return { ok: false, error: "Unauthorized" } (src/actions/address.ts:29-30)
      → result.error === "Unauthorized"
      → setError("Unauthorized") (src/components/account/address-form.tsx:78)
      → Error mesajı gösterilir, login'e yönlendirme YOK
```

**Farkı Oluşturan Kod:**
- AddressForm'da guest kontrolü yok (satır 63-86)
- Checkout context'i bilinmiyor (mode prop yok)
- Intent sistemi yok
- Login redirect mekanizması yok

---

## SON: Root Cause Analizi ve Fix Önerisi

### Root Cause Olasılıkları (En Yüksekten Düşüğe):

#### 1. **EN YÜKSEK: AddressForm'da Guest Kontrolü ve Checkout Mode Eksikliği**
**Kanıt:**
- AddressForm'da `mode` prop'u yok (checkout context'i bilinmiyor)
- AddressForm'da `useSession`/`useAuth` kontrolü yok
- Guest kullanıcılar için login redirect mekanizması yok
- Checkout'tan AddressForm çağrılırken `mode="checkout"` geçilmiyor

**Kod Kanıtları:**
- `src/app/checkout/page.tsx:306` - mode prop yok
- `src/components/account/address-form.tsx:36-41` - mode prop interface'de yok
- `src/components/account/address-form.tsx:63-86` - guest kontrolü yok

#### 2. **ORTA: Intent Sistemi Implement Edilmemiş**
**Kanıt:**
- `checkout-intent.ts` dosyası yok
- `checkout-address-intent-consumer.tsx` yok
- Guest flow için adres bilgisini geçici saklama mekanizması yok

#### 3. **DÜŞÜK: Auth Config Cookie Ayarları**
**Kanıt:**
- Cookie ayarları default, ancak guest'te session cookie olmaması normal
- Bu sorunun root cause'u değil

#### 4. **DÜŞÜK: Middleware/Proxy Etkisi**
**Kanıt:**
- Middleware yok
- Proxy boş, sadece passthrough yapıyor
- Sorunun root cause'u değil

---

### Net Fix Önerisi

**Root Cause:** AddressForm'da guest kontrolü ve checkout mode desteği eksik. Guest kullanıcılar checkout'ta adres eklemeye çalıştığında login'e yönlendirilmeli.

**Değişecek Dosyalar:**
1. `src/components/account/address-form.tsx` - Guest kontrolü ve mode prop desteği eklenecek
2. `src/app/checkout/page.tsx` - AddressForm'a `mode="checkout"` prop'u eklenecek

**Kod Patch Önerisi:**

**1. AddressForm'a mode prop ve guest kontrolü ekle:**

```typescript
// src/components/account/address-form.tsx

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

interface AddressFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "account" | "checkout"; // Yeni prop
}

export function AddressForm({ open, onOpenChange, mode = "account" }: AddressFormProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  // ... mevcut state'ler

  const onSubmit = async (data: AddressFormData) => {
    // Guest kontrolü - checkout mode'da
    if (mode === "checkout" && !isAuthenticated) {
      // Login sayfasına yönlendir, callbackUrl ile checkout'a dön
      router.push(`/login?callbackUrl=${encodeURIComponent("/checkout")}`);
      onOpenChange(false);
      return;
    }

    // Mevcut submit logic...
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await addAddressAction(data);
      // ... mevcut kod
    } catch (err) {
      // ... mevcut kod
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth loading durumunda form'u disable et
  if (mode === "checkout" && isAuthLoading) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-4">Yükleniyor...</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // ... mevcut render logic
}
```

**2. Checkout sayfasında mode prop'u ekle:**

```typescript
// src/app/checkout/page.tsx

// Satır 306'yı değiştir:
<AddressForm 
  open={showAddressForm} 
  onOpenChange={setShowAddressForm}
  mode="checkout"
/>
```

**Alternatif Fix (Intent Sistemi ile):**

Eğer intent sistemi de implement edilecekse:

1. `src/lib/checkout-intent.ts` oluştur (favorites-intent.ts'ye benzer)
2. `src/components/checkout/checkout-address-intent-consumer.tsx` oluştur
3. AddressForm'da guest kontrolünde intent kaydet
4. Checkout sayfasına consumer component ekle
5. Login sonrası consumer intent'i consume edip adresi ekle

**Test Checklist:**

- [ ] Guest kullanıcı checkout'ta "Yeni Adres" tıkladığında form açılıyor mu?
- [ ] Guest kullanıcı formu doldurup "Adresi Kaydet" tıkladığında login sayfasına yönlendiriliyor mu?
- [ ] Login sonrası checkout sayfasına geri dönüyor mu?
- [ ] Login olmuş kullanıcı checkout'ta adres ekleyebiliyor mu?
- [ ] Account sayfasında adres ekleme hala çalışıyor mu? (mode="account" default)
- [ ] Network'te `POST /checkout` unauthorized hatası artık görünmüyor mu?
- [ ] Error mesajı "Unauthorized" yerine login'e yönlendirme yapıyor mu?

---

**Öncelik:** Yüksek - Guest kullanıcılar için kritik UX sorunu
**Etki:** Checkout flow'u guest kullanıcılar için çalışmıyor
**Risk:** Düşük - Sadece guest kontrolü ekleniyor, mevcut authenticated flow etkilenmiyor

