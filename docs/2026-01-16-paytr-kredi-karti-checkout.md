# 2026-01-16 — Kredi Kartı Checkout (Mock) + PayTR (ENV-gated) Altyapısı

## 1) Hedef ve kapsam

- Local'da mock ile CC akışı bitirme
- PayTR'ye başvuru sonrası sadece ENV girerek aktif etme
- Prod'da PayTR configured değilken kredi kartını kullanıcıya göstermeme (Yakında)

## 2) Değişiklik özeti (PR timeline)

- PR-1: PaymentProvider + MockCreditCardProvider + checkout UI mock akışı (success/fail/3DS)
- PR-1b: 3DS modal davranış/safe-area iyileştirme
- PR-2: orders payment alanları + PayTRProvider skeleton + credit_card branch
- PR-3: PayTR iFrame token + callback finalize
- Hardening: configured değilse UI disable + provider fetch yok + callback 404

## 3) Contracts (kanıtlı)

### 3.1 createOrderAction

**Input:**
```typescript
{
  addressId: number; // int, positive
  paymentMethod: "credit_card" | "cod";
  cartItems: Array<{
    productId: number; // int, positive
    quantity: number; // int, positive, max 99
  }>; // min 1 item
}
```

**Evidence:** `src/actions/checkout.ts` (lines 24-35: checkoutSchema)

**Output (union type):**

- **COD path:**
  ```typescript
  { ok: true, orderId: string }
  ```

- **credit_card path (PayTR configured):**
  ```typescript
  { ok: true, paytr: { iframeToken: string, orderId: string } }
  ```

- **credit_card path (PayTR NOT configured):**
  ```typescript
  { ok: false, error: "Kredi kartı ödeme sistemi şu anda yapılandırılmamış. Lütfen kapıda ödeme seçeneğini kullanın." }
  ```

- **Error pattern:**
  ```typescript
  { ok: false, error: "Unauthorized" | "Validation error" | string, errors?: ZodError[] }
  ```

**Evidence:** `src/actions/checkout.ts` (lines 125-302: createOrderAction implementation)
- COD: lines 136-148
- credit_card configured: lines 152-282
- credit_card NOT configured: lines 156-161

**Email timing:**
- COD: Email gönderimi `createOrderAction` içinde, order oluşturulduktan hemen sonra (line 146: `sendOrderEmails`)
- credit_card: Email gönderimi YAPILMAZ. Sadece callback sonrası `paymentStatus === "paid"` olduğunda gönderilir (callback route lines 131-210)

**Evidence:** `src/actions/checkout.ts` (line 146: COD email, lines 272-273: CC email yok), `src/app/api/payments/paytr/callback/route.ts` (lines 131-210: callback email)

### 3.2 getPayTRConfigStatus

**Output:**
```typescript
{ configured: boolean }
```

**Evidence:** `src/actions/checkout.ts` (lines 19-22: getPayTRConfigStatus implementation)

## 4) Routes (kanıtlı)

### 4.1 /checkout

- **Path:** `/checkout`
- **File:** `src/app/checkout/page.tsx`
- **Type:** Client Component
- **Auth:** Sayfa seviyesinde yok, ancak `getAddressesAction` auth gerektirir
- **Payment method seçimi:**
  - COD: Her zaman enabled
  - credit_card: `paytrConfigured || isDevelopment` ise enabled, aksi halde disabled + "Yakında" mesajı

**Evidence:** `src/app/checkout/page.tsx` (lines 448-478: payment method UI, lines 451-464: credit_card disabled logic, lines 72-76: paytrConfigured state)

### 4.2 /api/payments/paytr/callback

- **Path:** `/api/payments/paytr/callback`
- **File:** `src/app/api/payments/paytr/callback/route.ts`
- **Method:** POST
- **Auth:** Yok (PayTR server çağıracağı için session şartı yok)
- **Request body:** FormData
  - `merchant_oid`: Order ID
  - `status`: "success" | "failed"
  - `total_amount`: Kuruş cinsinden
  - `hash`: Doğrulama hash'i
  - `failed_reason_code`, `failed_reason_msg`: (başarısız ise)
  - `payment_type`, `currency`, `test_mode`: Opsiyonel
- **Response:**
  - Configured değilse: `404 Not Found` (line 38)
  - Configured ise: `200 OK` + plain text "OK" (lines 214-219)
- **Hash doğrulama:** Var (lines 73-87)
- **Idempotency:** Var - `paymentStatus === "paid"` ise tekrar update etmiyor (lines 101-105)

**Evidence:** `src/app/api/payments/paytr/callback/route.ts` (full file: lines 1-230)

## 5) DB / Orders payment alanları (kanıtlı)

### 5.1 paymentStatus enum değerleri

```typescript
"pending" | "paid" | "failed" | "refunded" | "cancelled"
```

**Evidence:** `src/db/schema.ts` (line 142: paymentStatusEnum definition)

### 5.2 paymentTransactionId, paymentProvider, paymentMetadata

- `paymentTransactionId`: `text` (nullable)
- `paymentProvider`: `text` (nullable)
- `paymentMetadata`: `jsonb` (nullable)

**Evidence:** `src/db/schema.ts` (lines 155-158: orders table payment fields)

### 5.3 Create order sırasında hangi status yazılıyor?

- COD: `paymentStatus: "pending"` (line 142)
- credit_card: `paymentStatus: "pending"` (line 229), `paymentProvider: "paytr"` (line 230)
- Callback sonrası: `paymentStatus: "paid"` (success) veya `"failed"` (failed) (callback route line 108)

**Evidence:** `src/actions/checkout.ts` (line 142: COD pending, lines 229-230: CC pending + provider), `src/app/api/payments/paytr/callback/route.ts` (line 108: callback status update)

### 5.4 Migration

- **File:** `drizzle/0007_woozy_wendigo.sql`
- **DDL:**
  ```sql
  CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled');
  ALTER TABLE "orders" ADD COLUMN "payment_status" "payment_status" DEFAULT 'pending';
  ALTER TABLE "orders" ADD COLUMN "payment_transaction_id" text;
  ALTER TABLE "orders" ADD COLUMN "payment_provider" text;
  ALTER TABLE "orders" ADD COLUMN "payment_metadata" jsonb;
  ```

**Evidence:** `drizzle/0007_woozy_wendigo.sql` (full file)

## 6) Provider Layer (kanıtlı)

### 6.1 PaymentProvider interface

```typescript
interface PaymentProvider {
  startPayment(params: {
    amount: number; // Kuruş cinsinden
    orderDraftId?: string;
  }): Promise<PaymentResult>;
}

type PaymentResult =
  | { type: "success" }
  | { type: "fail"; error: string }
  | { type: "threeDSRequired"; challengeUrl?: string };
```

**Evidence:** `src/lib/payments/payment-provider.ts` (lines 7-22: interface definition)

### 6.2 MockCreditCardProvider senaryoları

- **Constructor:** `testScenario: "success" | "fail" | "threeDSRequired"`
- **Success:** `{ type: "success" }` (1 saniye delay)
- **Fail:** `{ type: "fail", error: "Kartınız yetersiz bakiye nedeniyle reddedildi" }`
- **3DS:** `{ type: "threeDSRequired", challengeUrl: undefined }`

**Evidence:** `src/lib/payments/mock-credit-card-provider.ts` (lines 11-48: full implementation)

### 6.3 PayTRProvider: env isimleri + isConfigured + fetch guard

**ENV isimleri:**
- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`
- `PAYTR_TEST_MODE` (opsiyonel, "1" ise test mode)

**Evidence:** `src/lib/payments/paytr-provider.ts` (lines 9-12: ENV names, lines 19-21: constructor)

**isConfigured:**
- Tüm 3 ENV var ve boş değilse `true`, aksi halde `false`

**Evidence:** `src/lib/payments/paytr-provider.ts` (lines 27-36: isConfigured implementation)

**Fetch guard:**
- `startCardPayment` metodunda ilk satır: `if (!this.isConfigured())` kontrolü var, fetch yapmadan döner (lines 59-64)

**Evidence:** `src/lib/payments/paytr-provider.ts` (lines 59-64: fetch guard)

**startCardPayment return:**
- Success: `{ success: true, iframeToken: string }`
- Fail: `{ success: false, error: string }`

**Evidence:** `src/lib/payments/paytr-provider.ts` (lines 44-173: startCardPayment implementation)

## 7) UX / Güvenlik kuralları

### 7.1 Prod'da credit_card sadece configured ise

- Checkout UI'da `paytrConfigured` state'i `getPayTRConfigStatus()` ile kontrol edilir
- `!paytrConfigured && !isDevelopment` ise credit_card radio disabled + "Yakında" mesajı

**Evidence:** `src/app/checkout/page.tsx` (lines 72-76: paytrConfigured state, lines 451-464: disabled logic)

### 7.2 Secrets sadece server'da

- PayTR credentials (`PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`) sadece server-side kodda okunur
- Client-side'da hiçbir secret expose edilmez

**Evidence:** `src/lib/payments/paytr-provider.ts` (server-side only, no client export), `src/app/checkout/page.tsx` (client component, sadece `getPayTRConfigStatus` çağırıyor, credentials yok)

### 7.3 Callback auth'suz ama hash verify + idempotency

- Callback route'unda session kontrolü yok (PayTR server çağıracağı için)
- Hash doğrulama: `merchantOid + merchantSalt + status + totalAmount` ile HMAC-SHA256 hesaplanır, gelen hash ile karşılaştırılır
- Idempotency: `paymentStatus === "paid"` ise tekrar update yapılmaz, sadece "OK" dönülür

**Evidence:** `src/app/api/payments/paytr/callback/route.ts` (lines 73-87: hash verification, lines 101-105: idempotency)

### 7.4 Log mask

- Hash'ler log'da maskelenir: `hash.substring(0, 10) + "..."` (callback route line 83)

**Evidence:** `src/app/api/payments/paytr/callback/route.ts` (lines 81-85: masked hash log)

## 8) Manuel test checklist (güncel)

1. **Guest intent regression:** Adres intent → login → checkout (adres listede görünür, duplicate yok)
2. **COD order:** Sipariş oluşturulur, email gönderilir, `/order-success/[id]` redirect
3. **CC mock success:** Development'ta testScenario="success" → order oluşturulur, email gönderilir
4. **CC mock fail:** Development'ta testScenario="fail" → error gösterilir, order oluşturulmaz
5. **CC mock 3DS:** Development'ta testScenario="threeDSRequired" → 3DS modal açılır, onay sonrası order oluşturulur
6. **PayTR configured değilken:** CC disabled, "Yakında" mesajı, createOrderAction error döner
7. **PayTR configured iken:**
   - iFrame modal açılır (`showPayTRModal`)
   - PayTR formu gösterilir (`https://www.paytr.com/odeme/guvenli/${iframeToken}`)
   - Callback sonrası `paymentStatus: "paid"` olur
   - Email gönderilir (callback içinde)
   - Callback configured değilken 404 döner (NOT "OK")

**Evidence:** `src/app/checkout/page.tsx` (full checkout flow), `src/actions/checkout.ts` (order creation), `src/app/api/payments/paytr/callback/route.ts` (callback handling)

## 9) Rollback

### 9.1 ENV silince CC kapanır

- `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` ENV'leri silinince:
  - `isConfigured()` → `false`
  - Checkout UI'da CC disabled
  - `createOrderAction` credit_card path'inde error döner
  - Callback route 404 döner

**Evidence:** `src/lib/payments/paytr-provider.ts` (isConfigured logic), `src/app/checkout/page.tsx` (UI disable), `src/actions/checkout.ts` (error path), `src/app/api/payments/paytr/callback/route.ts` (404 path)

### 9.2 Migration nullable olduğu için geri dönüş güvenli

- Tüm payment alanları nullable (`paymentTransactionId`, `paymentProvider`, `paymentMetadata`)
- `paymentStatus` default `"pending"` ve nullable değil ama enum değerleri geriye dönük uyumlu
- Migration rollback prosedürü: `drizzle-kit rollback` veya manuel SQL ile column'ları drop edebilirsiniz

**Evidence:** `src/db/schema.ts` (lines 155-158: nullable fields), `drizzle/0007_woozy_wendigo.sql` (migration DDL)
