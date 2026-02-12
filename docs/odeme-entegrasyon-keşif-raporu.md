# Ödeme Entegrasyonu Keşif Raporu

Bu rapor, ödeme entegrasyonu için gerekli "seam" noktalarını ve kritik bilgileri içerir.

## 1. Checkout'ta Submit Öncesi Guard'lar

**Dosya:** `src/app/checkout/page.tsx`

**Guard'lar `handleSubmit` fonksiyonunun başında:**

1. **Empty Cart Kontrolü** (satır 106-110):
   ```typescript
   if (items.length === 0) {
     setError("Sepetiniz boş");
     router.push("/cart");
     return;
   }
   ```

2. **Address Seçili Mi Kontrolü** (satır 101-104):
   ```typescript
   if (!selectedAddressId) {
     setError("Lütfen bir adres seçiniz");
     return;
   }
   ```

3. **isLoading Kilidi** (satır 112):
   - `setIsLoading(true)` submit başında set ediliyor
   - Button'da `disabled={isLoading || !selectedAddressId || items.length === 0}` ile korunuyor (satır 352)
   - `finally` bloğunda `didRedirectToSuccess` kontrolü ile sadece redirect olmadıysa `setIsLoading(false)` yapılıyor (satır 138-140)

**Not:** Hydration guard var (satır 42-45, 144-153) - cart state yüklenmeden "cart empty" mesajı gösterilmiyor.

---

## 2. Başarılı Sipariş Akışı

**Dosya:** `src/app/checkout/page.tsx` (handleSubmit)

**Akış:**

1. **createOrderAction çağrısı** (satır 115-122):
   ```typescript
   const result = await createOrderAction({
     addressId: selectedAddressId,
     paymentMethod,
     cartItems: items.map(...)
   });
   ```

2. **Başarılı dönüş kontrolü** (satır 124-126):
   ```typescript
   if (result.ok && result.orderId) {
     setDidRedirectToSuccess(true);
     router.push(`/order-success/${result.orderId}`);
   }
   ```
   - **Route:** `/order-success/[id]` (satır 126)
   - **Method:** `router.push()` (replace değil)

3. **Cart Temizleme:**
   - **Lokasyon:** `src/app/order-success/[id]/page.tsx` (satır 30)
   - **Component:** `<OrderSuccessClearCart />` 
   - **Implementasyon:** `src/components/order/order-success-clear-cart.tsx`
   - **Mantık:** Component mount olduğunda `useCart().clear()` çağırıyor (satır 23)
   - **Guard:** `didClearRef` ile duplicate çağrı engelleniyor, zaten boşsa clear çağrılmıyor (satır 18-21)

**"Sepet boş flash yok" fix'i:**
- `OrderSuccessClearCart` component'i `items.length === 0` kontrolü yapıyor (satır 18)
- Eğer sepet zaten boşsa `clear()` çağrılmıyor, bu sayede flash yok
- Checkout'ta cart temizleme yok, sadece success sayfasında

**Kritik Noktalar:**
- ✅ Cart temizleme checkout'ta değil, success sayfasında
- ✅ `didRedirectToSuccess` flag'i ile loading state doğru yönetiliyor
- ✅ Success sayfasına redirect edilmeden önce `setDidRedirectToSuccess(true)` set ediliyor

---

## 3. Error UI Kontratı

**Dosya:** `src/app/checkout/page.tsx`

**Error State:**
- **State:** `const [error, setError] = useState<string | null>(null);` (satır 35)
- **Render:** Inline error div (satır 172-176):
  ```tsx
  {error && (
    <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
      {error}
    </div>
  )}
  ```

**Error Mesaj Formatı:**
- **Validation errors:** `result.error === "Validation error" && result.errors` kontrolü (satır 128-130)
  - İlk error'un `message` field'ı gösteriliyor: `firstError?.message || "Form hatası"`
- **Generic errors:** `result.error || "Sipariş oluşturulurken bir hata oluştu"` (satır 132)
- **Catch block:** `"Beklenmeyen bir hata oluştu"` (satır 136)

**Pattern:**
- ❌ Toast kullanılmıyor
- ✅ Inline error div kullanılıyor
- ✅ `text-destructive` + `bg-destructive/10` + `border-destructive/20` styling pattern'i

---

## 4. createOrderAction COD Branch Ayrışması

**Dosya:** `src/actions/checkout.ts`

**Kod İncelemesi:**
- ❌ **COD branch ayrışması YOK**
- `createOrderAction` içinde `paymentMethod === "cod"` kontrolü yok
- `paymentMethod` direkt olarak `createOrder` query fonksiyonuna geçiliyor (satır 40)
- `checkoutSchema` içinde `paymentMethod: z.enum(["credit_card", "cod"])` validation var (satır 16-18)

**Credit Card Path:**
- ✅ **credit_card path'i order açıyor**
- Kanıt: `createOrder` fonksiyonu `paymentMethod`'u direkt olarak `orders` tablosuna insert ediyor (satır 54)
- Schema'da `paymentMethod` enum: `["credit_card", "cod"]` (satır 16)
- Database schema'da: `paymentMethodEnum = pgEnum("payment_method", ["credit_card", "cod"])` (`src/db/schema.ts` satır 141)

**Sonuç:**
- Şu an `credit_card` seçeneği UI'da disabled (satır 295) ama backend'de order açıyor
- Payment method ayrışması yok, her iki method da aynı akışı takip ediyor
- Ödeme entegrasyonu için `createOrderAction` içinde `paymentMethod === "credit_card"` branch'i eklenmeli

---

## 5. Email Side-Effect Güvenliği

**Dosya:** `src/actions/checkout.ts`

**Email Çağrısı Lokasyonu:**
- **Order insert'ten SONRA** (satır 37-42 order insert, satır 44-120 email gönderimi)
- Email gönderimi `try-catch` içinde (satır 45-120)
- **Best-effort yaklaşım:** Email hatası sipariş oluşturmayı bozmaz (satır 117-120)

**Güvenlik:**
- ✅ Email gönderimi order insert'ten sonra
- ✅ Email hatası catch ediliyor ve sadece loglanıyor
- ✅ Email hatası durumunda `{ ok: true, orderId: order.id }` dönüyor (satır 122)
- ⚠️ **ÖNEMLİ:** Ödeme fail senaryosunda email asla tetiklenmemeli
  - Şu an `createOrderAction` içinde ödeme kontrolü yok
  - Ödeme entegrasyonu eklendiğinde, ödeme başarısız olursa `createOrder` çağrılmadan önce return edilmeli
  - Email gönderimi sadece order başarıyla oluşturulduktan sonra olmalı (mevcut durumda zaten öyle)

**Kritik Not:**
- Ödeme provider'dan başarısız response gelirse, `createOrder` çağrılmadan önce `return { ok: false, error: "..." }` yapılmalı
- Bu sayede email asla tetiklenmez

---

## 6. Address Intent Consumer "Tüketim" Timing'i

**Dosya:** `src/components/checkout/checkout-address-intent-consumer.tsx`

**Timing:**
- `CheckoutAddressIntentConsumer` component'i `useEffect` içinde çalışıyor (satır 23)
- `status === "authenticated"` kontrolü var (satır 25)
- `onApplied` callback'i `addAddressAction` başarılı olduktan sonra çağırılıyor (satır 66)
- `onApplied` içinde `loadAddresses()` çağırılıyor (checkout page'de satır 48, 368'de prop olarak geçiliyor)

**Race Condition Riski:**
- ⚠️ **POTANSİYEL RİSK VAR**
- `CheckoutAddressIntentConsumer` async çalışıyor (`addAddressAction` promise)
- Kullanıcı `CheckoutAddressIntentConsumer` adres eklemeden önce submit edebilir
- Ancak `handleSubmit` içinde `selectedAddressId` kontrolü var (satır 101-104), bu yüzden adres seçilmeden submit edilemez
- **Ancak:** Eğer intent consumer adres eklerken kullanıcı submit ederse, yeni eklenen adres henüz `addresses` state'inde olmayabilir

**Risk Notu:**
- `CheckoutAddressIntentConsumer` `onApplied` callback'i ile `loadAddresses()` çağırıyor
- `loadAddresses()` `setAddresses()` yapıyor ve varsayılan adresi seçiyor (satır 52-59)
- Submit sırasında `selectedAddressId` kontrolü var, bu yüzden adres seçilmeden submit edilemez
- **Ancak:** Intent consumer adres eklerken kullanıcı submit ederse, yeni adres henüz yüklenmemiş olabilir
- **Çözüm:** Submit sırasında `isLoadingAddresses` kontrolü eklenebilir veya intent consumer'ın tamamlanması beklenebilir

**Mevcut Guard:**
- `handleSubmit` içinde `selectedAddressId` kontrolü var, bu yüzden adres seçilmeden submit edilemez
- Button disabled: `disabled={isLoading || !selectedAddressId || items.length === 0}` (satır 352)

---

## 7. ENV & Secrets Standardı

**ENV Okuma Standardı:**
- ❌ **Merkezi `env.ts` validator YOK**
- ✅ **Doğrudan `process.env` kullanılıyor**

**Kullanım Örnekleri:**

1. **`src/actions/checkout.ts`** (satır 75):
   ```typescript
   const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://cinselhobi.com";
   ```

2. **`src/lib/email/transport.ts`** (satır 8-12):
   ```typescript
   const host = process.env.SMTP_HOST || "smile1.ixirdns.com";
   const port = parseInt(process.env.SMTP_PORT || "587", 10);
   const secure = process.env.SMTP_SECURE === "true";
   const user = process.env.SMTP_USER;
   const pass = process.env.SMTP_PASS;
   ```

3. **`src/db/connection.ts`**:
   ```typescript
   const connectionString = process.env.DATABASE_URL;
   ```

4. **`src/auth.ts`**:
   ```typescript
   const secret = process.env.AUTH_SECRET;
   ```

**Masking/Logging Util:**
- ❌ **Secret masking util YOK**
- Loglarda secret'lar kırpılmıyor
- Örnek: `scripts/woo-import.ts` içinde env'ler direkt kullanılıyor (satır 14-20)

**PayTR ENV İsimleri İçin Öneri:**
- Mevcut pattern'e göre: `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`
- Veya: `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_SECRET`, `PAYTR_MERCHANT_SALT`
- Pattern: `{SERVICE}_{KEY_TYPE}` formatı kullanılabilir

**Not:** Merkezi validator yok, her dosya kendi env okumasını yapıyor. PayTR için de aynı pattern kullanılabilir.

---

## 8. UI Bileşen Standardı

**Radio/Select Butonları:**
- ✅ **Native HTML `<input type="radio">` kullanılıyor**
- **Dosya:** `src/app/checkout/page.tsx` (satır 225-231, 268-297)
- **Pattern:**
  ```tsx
  <label className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer", ...)}>
    <input
      type="radio"
      name="payment"
      value="cod"
      checked={paymentMethod === "cod"}
      onChange={() => setPaymentMethod("cod")}
      className="h-4 w-4 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
    />
    ...
  </label>
  ```
- ❌ Shadcn RadioGroup component'i kullanılmıyor
- ✅ Custom styling ile native radio kullanılıyor

**Modal Pattern:**
- ✅ **Dialog component var:** `src/components/ui/dialog.tsx`
- **Base:** Radix UI Dialog primitive
- **Components:**
  - `Dialog` (root)
  - `DialogTrigger`
  - `DialogContent`
  - `DialogHeader`, `DialogTitle`, `DialogDescription`
  - `DialogFooter`
  - `DialogClose`
- **Kullanım Örneği:** Search overlay'de kullanılıyor (`src/components/search/search-overlay.tsx`)
- **3DS Modal İçin:** Aynı `Dialog` component'i kullanılabilir

**AlertDialog:**
- ✅ **AlertDialog component var:** `src/components/ui/alert-dialog.tsx`
- Confirmation dialogs için kullanılıyor (cart item removal, address deletion)

**Drawer:**
- ✅ **Drawer component var:** `src/components/ui/drawer.tsx`
- Mobile cart için kullanılıyor (bottom sheet pattern)

**3DS Modal İçin Öneri:**
- `Dialog` component'i kullanılabilir
- `DialogContent` içinde 3DS iframe/form gösterilebilir
- `hideCloseButton` prop'u ile kapatma butonu gizlenebilir (3DS sırasında kullanıcı modal'ı kapatmamalı)

---

## Özet: Ödeme Entegrasyonu İçin Dokunulacak Minimum Noktalar

### 1. `src/app/checkout/page.tsx`
- `credit_card` radio button'unu enable et (satır 295: `disabled` prop'unu kaldır)
- `paymentMethod === "credit_card"` durumunda ödeme provider çağrısı ekle

### 2. `src/actions/checkout.ts`
- `createOrderAction` içinde `paymentMethod === "credit_card"` branch'i ekle
- Ödeme provider çağrısı (PayTR) eklenecek
- Ödeme başarılı olursa `createOrder` çağrılacak
- Ödeme başarısız olursa `return { ok: false, error: "..." }` (email asla tetiklenmeyecek)

### 3. ENV Değişkenleri
- `.env.local` dosyasına PayTR env'leri eklenecek:
  - `PAYTR_MERCHANT_ID`
  - `PAYTR_MERCHANT_KEY` (veya `PAYTR_MERCHANT_SECRET`)
  - `PAYTR_MERCHANT_SALT`
- Pattern: `process.env.PAYTR_*` şeklinde okunacak

### 4. 3DS Modal
- `src/components/ui/dialog.tsx` kullanılacak
- 3DS iframe/form `DialogContent` içinde gösterilecek
- `hideCloseButton` prop'u ile kapatma butonu gizlenecek

### 5. Error Handling
- Ödeme hataları mevcut error UI pattern'i ile gösterilecek (inline error div)
- Error mesajları kullanıcı dostu olacak

---

## Riskli Yerler

1. **Address Intent Consumer Race Condition:**
   - Intent consumer adres eklerken submit edilirse risk var
   - Çözüm: Submit sırasında `isLoadingAddresses` kontrolü veya intent consumer'ın tamamlanması beklenebilir

2. **Email Side-Effect:**
   - Ödeme başarısız olursa email asla tetiklenmemeli
   - `createOrder` çağrılmadan önce ödeme kontrolü yapılmalı

3. **Cart Temizleme:**
   - Cart temizleme success sayfasında, checkout'ta değil
   - Ödeme entegrasyonu sırasında bu akışa dokunulmamalı

4. **Payment Method Ayrışması:**
   - Şu an `credit_card` ve `cod` aynı akışı takip ediyor
   - `credit_card` için ödeme provider çağrısı eklenecek

---

## ENV Okuma Standardı

- ❌ Merkezi validator yok
- ✅ Doğrudan `process.env` kullanılıyor
- ✅ Pattern: `process.env.{SERVICE}_{KEY_TYPE}`
- PayTR için: `process.env.PAYTR_MERCHANT_ID`, `process.env.PAYTR_MERCHANT_KEY`, `process.env.PAYTR_MERCHANT_SALT`

---

**Rapor Tarihi:** 2026-01-15  
**Hazırlayan:** AI Assistant (Cursor)
