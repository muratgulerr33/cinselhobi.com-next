# Checkout Discovery Raporu

## 1. Çağrı Zinciri Diyagramı

```mermaid
flowchart TD
    CheckoutPage[checkout/page.tsx] -->|handleSubmit| CreateOrderAction[createOrderAction]
    CreateOrderAction -->|validate| CheckoutSchema[checkoutSchema]
    CheckoutSchema -->|paymentMethod enum| PaymentEnum["credit_card" | "cod"]
    CreateOrderAction -->|createOrder| CreateOrderQuery[db/queries/order.ts]
    CreateOrderQuery -->|insert| OrdersTable[orders table]
    CreateOrderQuery -->|insert| OrderItemsTable[order_items table]
    CreateOrderAction -->|sendEmail| EmailService[Email Service]
    
    AddressForm[AddressForm component] -->|guest mode| SaveIntent[saveCheckoutAddressIntent]
    SaveIntent -->|localStorage| IntentStorage[localStorage]
    CheckoutAddressIntentConsumer -->|read| IntentStorage
    CheckoutAddressIntentConsumer -->|addAddressAction| AddAddressAction[addAddressAction]
    AddAddressAction -->|insert| UserAddressesTable[user_addresses table]
    
    style CheckoutPage fill:#e1f5ff
    style CreateOrderAction fill:#fff4e1
    style CreateOrderQuery fill:#e8f5e9
    style OrdersTable fill:#f3e5f5
    style OrderItemsTable fill:#f3e5f5
```

### Detaylı Akış

1. **Checkout Page (`src/app/checkout/page.tsx`)**
   - `paymentMethod` state: `"credit_card" | "cod"` (default: `"cod"`)
   - `handleSubmit` fonksiyonu `createOrderAction` çağırır
   - Loading state: `isLoading`
   - Error state: `error` (string | null)

2. **Checkout Action (`src/actions/checkout.ts`)**
   - `checkoutSchema` validation:
     - `addressId`: number (positive)
     - `paymentMethod`: enum `["credit_card", "cod"]`
     - `cartItems`: array of `{productId, quantity}`
   - `createOrderAction` → `createOrder` query fonksiyonunu çağırır
   - Email gönderimi (best-effort, hata durumunda sipariş oluşturmayı bozmaz)

3. **Order Query (`src/db/queries/order.ts`)**
   - `createOrder` fonksiyonu:
     - Ürün fiyatlarını veritabanından çeker
     - Toplam tutarı hesaplar
     - Transaction içinde `orders` ve `order_items` tablolarına insert yapar

4. **Database Schema (`src/db/schema.ts`)**
   - `orders` tablosu:
     - `paymentMethod`: `paymentMethodEnum` → `["credit_card", "cod"]`
     - `status`: `orderStatusEnum` → `["pending", "processing", "shipped", "delivered", "cancelled"]`

## 2. Order/Payment Alan Listesi

### Orders Tablosu (`src/db/schema.ts`)

```typescript
orders {
  id: uuid (primary key, defaultRandom)
  userId: text (foreign key → users.id, cascade delete)
  addressId: integer (foreign key → user_addresses.id, restrict delete)
  status: orderStatusEnum (default: "pending")
    - "pending"
    - "processing"
    - "shipped"
    - "delivered"
    - "cancelled"
  totalAmount: integer (kuruş cinsinden, not null)
  paymentMethod: paymentMethodEnum (not null)
    - "credit_card"
    - "cod"
  createdAt: timestamp (defaultNow, not null)
}
```

### Order Items Tablosu

```typescript
orderItems {
  id: uuid (primary key, defaultRandom)
  orderId: uuid (foreign key → orders.id, cascade delete)
  productId: integer (foreign key → products.id, restrict delete)
  quantity: integer (not null)
  price: integer (kuruş cinsinden, o anki satış fiyatı, not null)
}
```

### Mevcut Payment Alanları

- ✅ `paymentMethod`: Enum (`"credit_card" | "cod"`)
- ✅ `totalAmount`: Integer (kuruş cinsinden)
- ✅ `status`: Enum (sipariş durumu)

### Eksik Payment Alanları (PR-2 için)

Şu anda **hiçbir payment-specific alan yok**:
- ❌ `paymentStatus`: Ödeme durumu (pending, paid, failed, refunded)
- ❌ `paymentTransactionId`: Ödeme gateway transaction ID
- ❌ `paymentProvider`: Ödeme sağlayıcı (iyzico, paytr, vb.)
- ❌ `paymentAmount`: Ödeme tutarı (totalAmount'dan farklı olabilir - kargo, indirim vb.)
- ❌ `paymentDate`: Ödeme tarihi
- ❌ `paymentMetadata`: JSONB (ek ödeme bilgileri)

## 3. Eklenecek Minimal Fields Önerisi

### PR-2 için Minimal Eklemeler

```typescript
// src/db/schema.ts

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",    // Ödeme bekleniyor (COD için)
  "paid",       // Ödeme yapıldı
  "failed",     // Ödeme başarısız
  "refunded",   // İade edildi
  "cancelled"   // İptal edildi
]);

export const orders = pgTable("orders", {
  // ... mevcut alanlar ...
  
  // YENİ ALANLAR:
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  paymentTransactionId: text("payment_transaction_id"), // nullable (COD için null olabilir)
  paymentProvider: text("payment_provider"), // nullable (COD için null olabilir)
  paymentDate: timestamp("payment_date"), // nullable (henüz ödeme yapılmadıysa null)
  paymentMetadata: jsonb("payment_metadata"), // nullable (ek bilgiler için)
});
```

### Migration Stratejisi

1. **Enum oluştur**: `payment_status` enum'ı ekle
2. **Yeni kolonlar ekle**: Tüm yeni alanlar nullable olarak eklenmeli (mevcut siparişler için)
3. **Default değerler**: 
   - `paymentStatus`: `"pending"` (COD için uygun)
   - Diğer alanlar: `null`
4. **Backfill**: Mevcut siparişler için:
   - `paymentStatus`: `paymentMethod === "cod" ? "pending" : "pending"` (varsayılan)
   - Diğer alanlar: `null`

## 4. Riskli Noktalar

### 🔴 Kritik Riskler

1. **Payment Method Enum Mismatch**
   - ✅ **Durum**: Enum değerleri tutarlı (`"credit_card"` ve `"cod"`)
   - ✅ **Kontrol**: Tüm dosyalarda aynı enum değerleri kullanılıyor
   - ⚠️ **Not**: UI'da `credit_card` seçeneği disabled (satır 295)

2. **Guest Intent Akışı**
   - ✅ **Durum**: Guest kullanıcı checkout'ta adres eklemek istediğinde:
     1. `AddressForm` → `saveCheckoutAddressIntent` (localStorage)
     2. Login sayfasına yönlendirme
     3. Auth sonrası `CheckoutAddressIntentConsumer` intent'i tüketir
   - ⚠️ **Risk**: `CheckoutAddressIntentConsumer` sadece `"/checkout"` path'ini kontrol ediyor (satır 36)
   - ⚠️ **Risk**: Duplicate engelleme `sessionStorage` kullanıyor (satır 44) - tab kapatılırsa kaybolur

3. **Transaction Güvenliği**
   - ✅ **Durum**: `createOrder` transaction içinde çalışıyor
   - ⚠️ **Risk**: Email gönderimi transaction dışında (best-effort) - bu doğru yaklaşım

4. **Fiyat Hesaplama**
   - ✅ **Durum**: Sipariş oluşturulurken ürün fiyatları veritabanından çekiliyor
   - ⚠️ **Risk**: Fiyat değişirse eski fiyat kaydedilir (bu istenen davranış olabilir)

### 🟡 Orta Seviye Riskler

1. **Error Handling**
   - ✅ **Durum**: Zod validation errors düzgün handle ediliyor
   - ⚠️ **Risk**: Generic error mesajları kullanıcıya yeterince bilgi vermeyebilir

2. **Loading States**
   - ✅ **Durum**: `isLoading` state mevcut
   - ⚠️ **Risk**: Redirect sonrası `isLoading` false yapılıyor ama redirect başarısız olursa state tutarsız kalabilir

3. **Address Selection**
   - ✅ **Durum**: Varsayılan adres otomatik seçiliyor
   - ⚠️ **Risk**: Adres seçilmeden submit edilebilir (validation var ama UX kötü)

### 🟢 Düşük Riskler

1. **Payment Method UI**
   - ⚠️ **Not**: `credit_card` seçeneği disabled ve "Yakında aktif olacak" mesajı var
   - ✅ **Durum**: Bu beklenen davranış (henüz kredi kartı ödemesi aktif değil)

2. **Email Gönderimi**
   - ✅ **Durum**: Best-effort yaklaşım (hata durumunda sipariş oluşturmayı bozmaz)
   - ✅ **Durum**: Try-catch ile korunmuş

## 5. String Mismatch Kontrolü

### Enum Değerleri Kontrolü

✅ **Tüm dosyalarda tutarlı:**
- `"credit_card"`: 15 dosyada kullanılıyor
- `"cod"`: 15 dosyada kullanılıyor
- Schema'da: `paymentMethodEnum = pgEnum("payment_method", ["credit_card", "cod"])`
- Action'da: `z.enum(["credit_card", "cod"])`
- UI'da: `paymentMethod: "credit_card" | "cod"`

**Sonuç**: String mismatch yok, tüm enum değerleri tutarlı.

## 6. Guest Intent Detayları

### Key/Lock Davranışı

1. **Intent Kaydetme** (`src/lib/checkout-address-intent.ts`)
   - Key: `"checkout_address_intent"`
   - TTL: 15 dakika
   - Format: `CheckoutAddressIntent` interface

2. **Intent Tüketme** (`src/components/checkout/checkout-address-intent-consumer.tsx`)
   - Lock key: `checkout_address_intent_lock:${intent.createdAt}`
   - Lock storage: `sessionStorage` (tab kapatılırsa kaybolur)
   - Duplicate engelleme: Lock kontrolü ile

3. **Checkout'ta Tüketim Noktası**
   - `CheckoutAddressIntentConsumer` component'i `checkout/page.tsx` içinde render ediliyor (satır 368)
   - `onApplied` callback: `loadAddresses` fonksiyonu (adres listesini günceller)

### Risk Analizi

- ⚠️ **sessionStorage kullanımı**: Tab kapatılırsa lock kaybolur, duplicate riski var
- ✅ **TTL kontrolü**: 15 dakika sonra intent otomatik expire olur
- ✅ **Path kontrolü**: Sadece `"/checkout"` path'inden gelen intent'ler işlenir

## 7. Öneriler

### PR-2 için Öneriler

1. **Payment Status Enum Ekle**
   - `payment_status` enum'ı oluştur
   - `orders` tablosuna `paymentStatus` kolonu ekle

2. **Transaction ID ve Provider**
   - `paymentTransactionId` ve `paymentProvider` kolonları ekle
   - Kredi kartı ödemeleri için gerekli

3. **Payment Metadata**
   - `paymentMetadata` JSONB kolonu ekle
   - Esneklik için ek bilgiler saklanabilir

4. **Migration Stratejisi**
   - Tüm yeni kolonlar nullable olmalı
   - Mevcut siparişler için default değerler set edilmeli

### Kod İyileştirmeleri

1. **CheckoutAddressIntentConsumer**
   - `sessionStorage` yerine `localStorage` kullanılabilir (lock için)
   - Veya daha güvenli bir duplicate engelleme mekanizması

2. **Error Messages**
   - Daha spesifik error mesajları
   - Validation error'ları daha detaylı gösterilebilir

3. **Payment Method UI**
   - `credit_card` aktif olduğunda disabled durumunu kaldır
   - Payment provider entegrasyonu için hazırlık yap
