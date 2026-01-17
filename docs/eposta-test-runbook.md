# Eposta Test Runbook

> **Oluşturulma Tarihi:** 2025-01-31  
> **Amaç:** Email entegrasyonu test hazırlık dokümanı  
> **Doğrulama Yöntemi:** Statik kod analizi (kanıtlı)

---

## 1. Amaç

Bu doküman, email entegrasyonunun test edilmesi için gerekli bilgileri içerir:
- Gerekli ENV key isimleri (değer yok, sadece isimler)
- Checkout/order akışını uygulamada nasıl tetikleriz? (kanıtlı)
- Başarı kriterleri (2 mail) ve güvenli test adımları

**Önemli Notlar:**
- Endpoint/field/route uydurma yok, sadece repo'da kanıtlı bilgiler
- Secret/value sızdırma yok, sadece ENV key isimleri
- Checkout sipariş oluşturunca 2 mail tetikleniyor; auth mail yok

---

## 2. Gerekli ENV Key Listesi

Aşağıdaki environment variable'lar email entegrasyonu için gereklidir. **Değerler bu dokümanda yok**, sadece isimler listelenmiştir.

### 2.1 Email Gönderim Kontrolü

| ENV Key | Okunduğu Yer | Satır | Açıklama |
|---------|--------------|-------|----------|
| `EMAIL_ENABLED` | `src/lib/email/send.ts` | 50, 88 | Email gönderimini açıp kapatma (`"true"` olmalı) |

**Kanıt:**
```50:50:src/lib/email/send.ts
  if (process.env.EMAIL_ENABLED !== "true") {
```

```88:88:src/lib/email/send.ts
  if (process.env.EMAIL_ENABLED !== "true") {
```

### 2.2 SMTP Konfigürasyonu

| ENV Key | Okunduğu Yer | Satır | Açıklama |
|---------|--------------|-------|----------|
| `SMTP_HOST` | `src/lib/email/transport.ts` | 8 | SMTP sunucu adresi (default: `"smile1.ixirdns.com"`) |
| `SMTP_PORT` | `src/lib/email/transport.ts` | 9 | SMTP port (default: `"587"`) |
| `SMTP_SECURE` | `src/lib/email/transport.ts` | 10 | TLS/SSL kullanımı (`"true"` veya `"false"`) |
| `SMTP_USER` | `src/lib/email/transport.ts` | 11 | SMTP kullanıcı adı (zorunlu) |
| `SMTP_PASS` | `src/lib/email/transport.ts` | 12 | SMTP şifre (zorunlu) |
| `SMTP_FROM` | `src/lib/email/send.ts` | 56, 94 | Gönderen email adresi (default: `"Destek <destek@cinselhobi.com>"`) |

**Kanıt:**
```8:12:src/lib/email/transport.ts
  const host = process.env.SMTP_HOST || "smile1.ixirdns.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
```

```56:56:src/lib/email/send.ts
    const from = process.env.SMTP_FROM || "Destek <destek@cinselhobi.com>";
```

```94:94:src/lib/email/send.ts
    const from = process.env.SMTP_FROM || "Destek <destek@cinselhobi.com>";
```

### 2.3 Admin Bildirim

| ENV Key | Okunduğu Yer | Satır | Açıklama |
|---------|--------------|-------|----------|
| `ADMIN_NOTIFY_TO` | `src/lib/email/send.ts` | 96 | Admin bildirim email adresi (default: `"destek@cinselhobi.com"`) |

**Kanıt:**
```96:96:src/lib/email/send.ts
      process.env.ADMIN_NOTIFY_TO || "destek@cinselhobi.com";
```

### 2.4 Base URL (Email Link'leri İçin)

| ENV Key | Okunduğu Yer | Satır | Açıklama |
|---------|--------------|-------|----------|
| `AUTH_URL` | `src/actions/checkout.ts` | 78 | Base URL (email link'leri için, fallback: `NEXT_PUBLIC_BASE_URL` veya `"https://cinselhobi.com"`) |
| `AUTH_URL` | `src/app/api/payments/paytr/callback/route.ts` | 163 | Base URL (callback'te email link'leri için) |
| `NEXT_PUBLIC_BASE_URL` | `src/actions/checkout.ts` | 78 | Public base URL (fallback) |
| `NEXT_PUBLIC_BASE_URL` | `src/app/api/payments/paytr/callback/route.ts` | 164 | Public base URL (fallback) |

**Kanıt:**
```78:78:src/actions/checkout.ts
    const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://cinselhobi.com";
```

```163:165:src/app/api/payments/paytr/callback/route.ts
          const baseUrl =
            process.env.AUTH_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
```

---

## 3. Checkout/Order Tetik Keşfi

### 3.1 Sipariş Oluşturma Route/Sayfa

**Route:** `/checkout`  
**Dosya:** `src/app/checkout/page.tsx`  
**Tip:** Client Component

**Kanıt:** `src/app/checkout/page.tsx` (sayfa component'i)

### 3.2 Sipariş Oluşturma Action/Handler

**Action:** `createOrderAction`  
**Dosya:** `src/actions/checkout.ts`  
**Satır:** 125

**Kanıt:**
```125:125:src/actions/checkout.ts
export async function createOrderAction(data: z.infer<typeof checkoutSchema>) {
```

### 3.3 Email Tetikleme Akışı

#### 3.3.1 COD (Kapıda Ödeme) Akışı

**Ödeme Gereksinimi:** Gerçek ödeme **GEREKMEZ**. Direkt order oluşturulur ve email gönderilir.

**Akış:**
1. Kullanıcı `/checkout` sayfasında "Kapıda Ödeme" seçer
2. Form submit edilir → `createOrderAction` çağrılır
3. `paymentMethod === "cod"` ise:
   - Order direkt oluşturulur (`createOrder()`)
   - `sendOrderEmails()` çağrılır (satır 146)
   - 2 email gönderilir:
     - Müşteriye sipariş onay email'i (`sendOrderConfirmationEmail`)
     - Admin'e bildirim email'i (`sendAdminNotificationEmail`)

**Kanıt:**
```136:148:src/actions/checkout.ts
    // COD akışı: Direkt order oluştur
    if (validatedData.paymentMethod === "cod") {
      const order = await createOrder({
        userId: session.user.id,
        addressId: validatedData.addressId,
        paymentMethod: validatedData.paymentMethod,
        items: validatedData.cartItems,
        paymentStatus: "pending", // COD için ödeme bekleniyor
      });

      // Email gönderimi (best-effort, hata durumunda sipariş oluşturmayı bozmaz)
      await sendOrderEmails(order, session.user.id, validatedData.addressId);

      return { ok: true, orderId: order.id };
    }
```

#### 3.3.2 Credit Card (Kredi Kartı) Akışı

**Ödeme Gereksinimi:** Gerçek ödeme **GEREKLİ**. PayTR callback'i sonrası email gönderilir.

**Akış:**
1. Kullanıcı `/checkout` sayfasında "Kredi Kartı" seçer
2. Form submit edilir → `createOrderAction` çağrılır
3. `paymentMethod === "credit_card"` ise:
   - Order oluşturulur (`paymentStatus: "pending"`)
   - PayTR token alınır
   - **Email gönderilmez** (satır 272-273)
4. Kullanıcı PayTR iframe'de ödeme yapar
5. PayTR callback gelir → `/api/payments/paytr/callback` (POST)
6. Callback'te `status === "success"` ve `paymentStatus === "paid"` ise:
   - 2 email gönderilir:
     - Müşteriye sipariş onay email'i (`sendOrderConfirmationEmail`)
     - Admin'e bildirim email'i (`sendAdminNotificationEmail`)

**Kanıt (Email Gönderilmez):**
```272:273:src/actions/checkout.ts
      // Email gönderimi YAPILMAYACAK - sadece callback sonrası paymentStatus "paid" olduğunda gönderilecek
      // Bu sayede ödeme tamamlanmadan email gitmez
```

**Kanıt (Callback'te Email Gönderilir):**
```131:210:src/app/api/payments/paytr/callback/route.ts
    // Eğer ödeme başarılıysa email gönder
    if (status === "success" && newPaymentStatus === "paid") {
      try {
        // User bilgilerini çek
        const [user] = await db
          .select({
            email: users.email,
            name: users.name,
          })
          .from(users)
          .where(eq(users.id, order.userId))
          .limit(1);

        // Adres bilgisini çek
        const [address] = await db
          .select()
          .from(userAddresses)
          .where(eq(userAddresses.id, order.addressId))
          .limit(1);

        // Sipariş ürünlerini çek
        const orderItems = await getOrderItemsByOrderId(order.id);

        if (user?.email && address && orderItems.length > 0) {
          const orderDate = new Date(order.createdAt).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          const baseUrl =
            process.env.AUTH_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            "https://cinselhobi.com";
          const orderLink = `${baseUrl}/order-success/${order.id}`;

          // Müşteriye sipariş onay email'i gönder
          await sendOrderConfirmationEmail({
            orderId: order.id,
            customerEmail: user.email,
            customerName: user.name || "Müşteri",
            orderDate,
            items: orderItems.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              price: item.price,
            })),
            totalAmount: order.totalAmount,
            address: {
              title: address.title,
              fullAddress: address.fullAddress,
              city: address.city,
              district: address.district,
              phone: address.phone,
            },
            paymentMethod: order.paymentMethod,
            orderLink,
          });

          // Admin'e bildirim email'i gönder
          await sendAdminNotificationEmail({
            orderId: order.id,
            customerName: user.name || "Müşteri",
            customerEmail: user.email,
            orderDate,
            items: orderItems.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              price: item.price,
            })),
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            orderLink: `${baseUrl}/admin/orders/${order.id}`,
          });
        }
      } catch (emailError) {
        // Email gönderim hatası callback'i bozmaz, sadece logla
        console.error("[PayTR Callback] Email gönderim hatası:", emailError);
      }
    }
```

---

## 4. Test Öncesi Checklist

### 4.1 ENV Kontrolü

- [ ] Tüm gerekli ENV key'leri `.env` dosyasında tanımlı mı?
  - `EMAIL_ENABLED`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`
  - `ADMIN_NOTIFY_TO`
  - `AUTH_URL` veya `NEXT_PUBLIC_BASE_URL`

### 4.2 Dry-Run Test (EMAIL_ENABLED=false)

**ÖNEMLİ:** İlk testi `EMAIL_ENABLED=false` ile yapın. Bu sayede:
- Email gönderilmez (güvenli)
- Sipariş oluşturma akışı test edilir
- Email gönderim kodları çalışır ama sessizce çıkılır

**Adımlar:**
1. `.env` dosyasında `EMAIL_ENABLED=false` ayarlayın
2. Test siparişi oluşturun (COD ile)
3. Sipariş başarıyla oluşturuldu mu kontrol edin
4. Email gönderilmediğini doğrulayın (beklenen davranış)

### 4.3 Email Gönderim Testi (EMAIL_ENABLED=true)

**Adımlar:**
1. `.env` dosyasında `EMAIL_ENABLED=true` ayarlayın
2. SMTP bilgilerinin doğru olduğundan emin olun
3. Test siparişi oluşturun (COD ile)
4. 2 email'in gönderildiğini kontrol edin:
   - Müşteriye sipariş onay email'i
   - Admin'e bildirim email'i

---

## 5. Test Adımları

### 5.1 COD (Kapıda Ödeme) Testi

**Gereksinimler:**
- Giriş yapılmış kullanıcı
- Sepette ürün var
- Adres tanımlı

**Adımlar:**
1. `/checkout` sayfasına gidin
2. "Kapıda Ödeme" ödeme yöntemini seçin
3. Adres seçin (veya yeni adres ekleyin)
4. "Siparişi Tamamla" butonuna tıklayın
5. Sipariş başarıyla oluşturuldu mu kontrol edin
6. **Beklenen:** 2 email gönderilir:
   - Müşteriye sipariş onay email'i (`sendOrderConfirmationEmail`)
   - Admin'e bildirim email'i (`sendAdminNotificationEmail`)

**Not:** Gerçek ödeme gerekmez, direkt order oluşturulur.

### 5.2 Credit Card (Kredi Kartı) Testi

**Gereksinimler:**
- Giriş yapılmış kullanıcı
- Sepette ürün var
- Adres tanımlı
- PayTR yapılandırılmış (veya development modunda mock provider)

**Adımlar:**
1. `/checkout` sayfasına gidin
2. "Kredi Kartı" ödeme yöntemini seçin
3. Adres seçin (veya yeni adres ekleyin)
4. "Siparişi Tamamla" butonuna tıklayın
5. PayTR iframe'de ödeme yapın (veya development'ta mock provider kullanın)
6. Ödeme başarılı olduğunda PayTR callback gelir
7. **Beklenen:** Callback sonrası 2 email gönderilir:
   - Müşteriye sipariş onay email'i (`sendOrderConfirmationEmail`)
   - Admin'e bildirim email'i (`sendAdminNotificationEmail`)

**Not:** Gerçek ödeme gerekir. Development'ta mock provider kullanılabilir.

---

## 6. Başarılı Sayma Kriteri

Test başarılı sayılır eğer:

1. ✅ Sipariş başarıyla oluşturuldu
2. ✅ **2 email gönderildi:**
   - Müşteriye sipariş onay email'i (`sendOrderConfirmationEmail`)
   - Admin'e bildirim email'i (`sendAdminNotificationEmail`)
3. ✅ Email'ler doğru adreslere gönderildi:
   - Müşteri email'i: Kullanıcının `users.email` değeri
   - Admin email'i: `ADMIN_NOTIFY_TO` env değişkeni (veya default: `"destek@cinselhobi.com"`)
4. ✅ Email içerikleri doğru:
   - Sipariş bilgileri (order ID, ürünler, tutar, adres)
   - Link'ler doğru base URL ile oluşturuldu

**Önemli:** Email gönderim hatası sipariş oluşturmayı bozmaz (best-effort pattern). Hata durumunda sadece loglanır, exception fırlatılmaz.

---

## 7. Güvenlik Notları

### 7.1 Secret/Value Sızdırma

- ✅ Bu dokümanda **sadece ENV key isimleri** var, değerler yok
- ✅ Secret değerler (SMTP_PASS, SMTP_USER) dokümanda yok
- ✅ Gerçek email adresleri dokümanda yok (sadece default değerler)

### 7.2 Log/Monitoring

- Email gönderim hataları `console.error()` ile loglanır
- Metrics/monitoring yok (sadece console logları)
- Production'da log monitoring eklenebilir

### 7.3 Error Handling

- Email gönderim hatası sipariş oluşturmayı bozmaz (best-effort pattern)
- Hata durumunda sadece loglanır, exception fırlatılmaz
- Sipariş başarıyla oluşturulur, email gönderilemese bile

---

## 8. Bilinmeyenler (Unknowns)

Aşağıdaki konularda repo'da kanıt bulunamadı, "Unknown" olarak işaretlenmiştir:

- **Test ortamında gerçek ödeme gereksinimi:** COD için gerçek ödeme gerekmez (kanıtlı). Credit Card için gerçek ödeme gerekir (kanıtlı). Development'ta mock provider kullanılabilir (kanıtlı: `src/app/checkout/page.tsx` satır 175-176).

---

## 9. Kanıt Referansları

Tüm iddialar repo'da kanıtlıdır. Referanslar:

- **ENV Key Okuma:** `src/lib/email/transport.ts`, `src/lib/email/send.ts`, `src/actions/checkout.ts`, `src/app/api/payments/paytr/callback/route.ts`
- **Checkout Route:** `src/app/checkout/page.tsx`
- **Order Action:** `src/actions/checkout.ts::createOrderAction()` (satır 125)
- **Email Gönderim:** `src/actions/checkout.ts::sendOrderEmails()` (satır 40-123)
- **Email Fonksiyonları:** `src/lib/email/send.ts::sendOrderConfirmationEmail()` (satır 46-78), `src/lib/email/send.ts::sendAdminNotificationEmail()` (satır 84-118)
- **PayTR Callback:** `src/app/api/payments/paytr/callback/route.ts` (satır 131-210)

---

## 10. İlgili Dokümanlar

- `docs/eposta-kurulum-kesif.md` - Email kurulum keşif raporu
- `docs/eposta-onay-raporu.md` - Email entegrasyonu onay raporu
- `docs/2026-01-16-paytr-kredi-karti-checkout.md` - PayTR kredi kartı checkout dokümanı
