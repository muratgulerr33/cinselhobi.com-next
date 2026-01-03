# Email Templates Documentation

Bu dokümantasyon, CinselHobi.com-next projesindeki e-posta şablon paketini açıklar.

## Genel Bakış

E-posta şablon sistemi, transactional email'ler için HTML ve text formatında şablonlar sağlar. Tüm şablonlar:
- Table-based layout ile email client uyumluluğu
- Inline CSS kullanımı
- Mobil uyumlu tasarım
- Türkçe dil desteği
- Gizlilik odaklı (ürün isimleri/detayları içermez)

## Şablon Yapısı

Her şablon üç fonksiyon export eder:
- `subject(data): string` - E-posta konusu
- `html(data): string` - HTML formatında e-posta içeriği
- `text(data): string` - Plain text formatında e-posta içeriği

## Şablon Listesi

### Auth (Üyelik) Şablonları

#### 1. auth-welcome
Yeni kullanıcı kaydı için hoş geldin e-postası.

**Data:**
```typescript
BaseEmailData
```

#### 2. auth-verify-email
E-posta doğrulama e-postası.

**Data:**
```typescript
BaseEmailData
```

**Özel Alanlar:**
- `links.verifyEmailUrl` - Doğrulama bağlantısı (zorunlu)

#### 3. auth-reset-password
Şifre sıfırlama e-postası.

**Data:**
```typescript
BaseEmailData
```

**Özel Alanlar:**
- `links.resetPasswordUrl` - Şifre sıfırlama bağlantısı (zorunlu)

#### 4. auth-password-changed
Şifre değiştirme onay e-postası.

**Data:**
```typescript
BaseEmailData
```

#### 5. auth-login-alert
Yeni giriş bildirimi e-postası (opsiyonel güvenlik bildirimi).

**Data:**
```typescript
LoginAlertData extends BaseEmailData {
  loginTime?: string;
  ipAddress?: string;
  deviceInfo?: string;
}
```

### Order (Sipariş) Şablonları

**Not:** Tüm sipariş şablonlarında ürün isimleri/detayları yer almaz. Sadece genel bilgiler (itemsCount, total, orderNumber) gösterilir.

#### 6. order-confirmation-customer
Müşteriye sipariş onay e-postası.

**Data:**
```typescript
OrderConfirmationData extends BaseEmailData {
  order: Order;
}
```

#### 7. order-notification-admin
Admin'e yeni sipariş bildirimi.

**Data:**
```typescript
OrderNotificationAdminData extends BaseEmailData {
  order: Order;
}
```

#### 8. order-status-processing
Sipariş hazırlanıyor durumu e-postası.

**Data:**
```typescript
OrderStatusProcessingData extends BaseEmailData {
  order: Order;
}
```

#### 9. order-status-shipped
Sipariş kargoya verildi e-postası.

**Data:**
```typescript
OrderStatusShippedData extends BaseEmailData {
  order: Order;
}
```

**Özel Alanlar:**
- `links.trackingUrl` - Kargo takip bağlantısı (opsiyonel)

#### 10. order-status-delivered
Sipariş teslim edildi e-postası.

**Data:**
```typescript
OrderStatusDeliveredData extends BaseEmailData {
  order: Order;
}
```

#### 11. order-cancelled
Sipariş iptal e-postası.

**Data:**
```typescript
OrderCancelledData extends BaseEmailData {
  order: Order;
  reason?: string;
}
```

#### 12. order-payment-failed
Ödeme başarısız e-postası.

**Data:**
```typescript
OrderPaymentFailedData extends BaseEmailData {
  order: Order;
}
```

#### 13. order-refund-initiated
İade başlatıldı e-postası.

**Data:**
```typescript
OrderRefundInitiatedData extends BaseEmailData {
  order: Order;
  refundAmount?: number; // cents, defaults to order.total
}
```

### Support (Destek) Şablonları

#### 14. support-contact-received-customer
Müşteriye destek mesajı alındı onayı.

**Data:**
```typescript
SupportContactReceivedData extends BaseEmailData {
  ticketId?: string;
  subject?: string;
}
```

#### 15. support-contact-notify-admin
Admin'e yeni destek mesajı bildirimi.

**Data:**
```typescript
SupportContactNotifyAdminData extends BaseEmailData {
  ticketId?: string;
  subject?: string;
  message?: string;
}
```

## Type Definitions

### BaseEmailData
```typescript
interface BaseEmailData {
  customer: Customer;
  brand: Brand;
  links: Links;
}
```

### Customer
```typescript
interface Customer {
  firstName?: string;
  lastName?: string;
  email: string;
}
```

### Order
```typescript
interface Order {
  id: string;
  createdAt?: string;
  total: number; // in cents
  currency?: "TRY";
  itemsCount: number;
  status?: string;
  shortAddress?: {
    city?: string;
    district?: string;
  };
}
```

### Links
```typescript
interface Links {
  accountUrl?: string;
  orderUrl?: string;
  supportUrl?: string;
  verifyEmailUrl?: string;
  resetPasswordUrl?: string;
  trackingUrl?: string;
}
```

### Brand
```typescript
interface Brand {
  fromNameDefault: string;
  supportEmail: string;
  logoUrl?: string;
}
```

## Preview Script

Şablonları önizlemek için `scripts/email-preview.ts` script'i kullanılabilir.

### Kullanım

```bash
node scripts/email-preview.ts <template-name>
```

### Örnekler

```bash
# Sipariş onay şablonunu önizle
node scripts/email-preview.ts order-confirmation-customer

# Hoş geldin şablonunu önizle
node scripts/email-preview.ts auth-welcome

# Tüm mevcut şablonları listele
node scripts/email-preview.ts
```

### Çıktı

Script, şablonun subject, HTML ve text versiyonlarını stdout'a yazdırır. Bu çıktıyı bir dosyaya yönlendirerek HTML'i tarayıcıda açabilirsiniz:

```bash
node scripts/email-preview.ts order-confirmation-customer > preview.html
```

## Gizlilik Notları

- **Ürün İsimleri:** Email'lerde ürün isimleri veya detayları yer almaz. Sadece genel bilgiler (ürün sayısı, toplam tutar) gösterilir.
- **Adres Bilgisi:** Tam adres yerine sadece şehir/ilçe bilgisi gösterilir.
- **Link Yönetimi:** Tüm linkler caller tarafından sağlanır. Template içinde hardcode edilmez.

## Entegrasyon

Bu şablon paketi sadece template layer'dır. Gerçek email gönderimi için `src/lib/email/send.ts` içindeki fonksiyonlar kullanılmalı veya yeni entegrasyon yapılmalıdır.

### Örnek Kullanım

```typescript
import { subject, html, text } from "@/lib/email/templates/order-confirmation-customer";
import { createTransport } from "@/lib/email/transport";

const data = {
  customer: { email: "user@example.com", firstName: "Ahmet" },
  brand: { fromNameDefault: "CinselHobi", supportEmail: "destek@cinselhobi.com" },
  links: { orderUrl: "https://cinselhobi.com/account/orders/123" },
  order: {
    id: "123",
    total: 29900,
    currency: "TRY",
    itemsCount: 3,
    createdAt: new Date().toISOString(),
  },
};

const transporter = createTransport();
await transporter.sendMail({
  from: "CinselHobi <destek@cinselhobi.com>",
  to: data.customer.email,
  subject: subject(data),
  html: html(data),
  text: text(data),
});
```

## Dosya Yapısı

```
src/lib/email/templates/
├── _base.ts              # Base template utilities
├── _types.ts             # TypeScript type definitions
├── index.ts              # Export index
├── auth-welcome.ts
├── auth-verify-email.ts
├── auth-reset-password.ts
├── auth-password-changed.ts
├── auth-login-alert.ts
├── order-confirmation-customer.ts
├── order-notification-admin.ts
├── order-status-processing.ts
├── order-status-shipped.ts
├── order-status-delivered.ts
├── order-cancelled.ts
├── order-payment-failed.ts
├── order-refund-initiated.ts
├── support-contact-received-customer.ts
└── support-contact-notify-admin.ts
```

## Notlar

- Tüm şablonlar Türkçe dilindedir.
- Subject formatı: `[CinselHobi] <Başlık>`
- Footer'da otomatik olarak "Bu e-posta otomatik gönderilmiştir" mesajı ve gizlilik politikası linki eklenir.
- Logo URL'i opsiyoneldir. Sağlanmazsa text logo kullanılır.
- Link'ler "Unknown" olarak bırakılabilir, bu durumda ilgili buton gösterilmez.

