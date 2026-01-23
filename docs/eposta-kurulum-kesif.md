# Eposta Kurulum Keşif Raporu

> **Oluşturulma Tarihi:** 2025-01-31  
> **Keşif Kapsamı:** SMTP/Transactional Email Provider/Auth Maili/Sipariş Maili  
> **Yöntem:** Repo-wide tarama + Master Pack referansı

---

## 1. Goal

Repo içindeki TÜM dosyaları tarayarak "eposta entegrasyonu" konusunda:
1. Şu an gerçekten ne var? (mevcut durum)
2. Ne eksik? (gap)
3. Yol haritası nedir? (net adımlar)
4. "Kaldığımız yer" neresi? (devam noktası)

çıktısını üretmek.

> **Not:** Bu görev "keşif + dokümantasyon" görevidir. Kod davranışı değiştirme. Yeni endpoint/component uydurma YASAK.

---

## 2. Context

**Referans Dokümanlar (Master Pack):**
- **DOC-02 (architecture-lock)** — yasaklar/kararlar
- **DOC-08 (api-contracts-frontend)** — endpoint/field uydurma yasağı
- **DOC-13 (security-and-deps)** — secret/env/log maskeleme
- **DOC-06 (frontend-standards-2026)** — DoD / kalite
- **DOC-03 (routes-and-navigation-map)** — route gerçekleri
- **DOC-09 (data-fetching-cache-rules)** — server action / cache mantığı

**Master Pack'te Email İlgili Bulgular:**
- `docs/00.chatgpt-master-pack-31-12-2025.md` içinde "Email service entegrasyonu var mı? (Order confirmations, password reset)" sorusu mevcut (satır 377)
- Detaylı email entegrasyon dokümantasyonu yok
- Email verification mekanizması "Unknown" olarak işaretlenmiş (satır 3999)

**Kurallar:**
- Route/API/field/component uydurma kesin yasak
- Eğer bir şey repo'da yoksa: `Unknown` yaz
- Varsayım gerekiyorsa: `Assumption + Reasoning` ile açık işaretle

---

## 3. Current State (Evidence-based)

### 3.1 Bulunan Dosyalar (Tam Path)

**Email Gönderim Altyapısı:**
- `src/lib/email/transport.ts` — SMTP transport oluşturma (nodemailer)
- `src/lib/email/send.ts` — Email gönderim fonksiyonları (server action)
- `src/lib/email/templates/order-confirmation.ts` — Sipariş onay email template'i (HTML + text)
- `src/lib/email/templates/admin-notification.ts` — Admin bildirim email template'i (HTML + text)

**Email Kullanım Yerleri:**
- `src/actions/checkout.ts` — Sipariş oluşturma sonrası email gönderimi (satır 10-11, 79, 102)

**Auth İlgili (Email Verification Yok):**
- `src/auth.ts` — NextAuth.js config (Credentials provider, email verification yok)
- `src/app/api/auth/signup/route.ts` — Kayıt endpoint'i (email verification yok)
- `src/db/schema.ts` — `users` tablosunda `emailVerified` kolonu var ama kullanılmıyor (satır 59)

### 3.2 Bulunan Bağımlılıklar (package.json)

**Email Gönderim:**
- `nodemailer: ^7.0.12` — SMTP transport için
- `@types/nodemailer: ^7.0.4` — TypeScript tip tanımları

**Auth (Email Provider Yok):**
- `next-auth: ^5.0.0-beta.25` — Auth.js v5 (Credentials provider kullanılıyor, Email provider yok)
- `@auth/drizzle-adapter: ^1.11.1` — Drizzle adapter

**Template Sistemi:**
- Template sistemi yok (React Email, MJML, Handlebars yok)
- Sadece string template'ler (HTML string concatenation)

### 3.3 Bulunan ENV Değişken İsimleri (Sadece İsim)

**SMTP Konfigürasyonu:**
- `EMAIL_ENABLED` — Email gönderimini açıp kapatma (default: kapalı, `"true"` olmalı)
- `SMTP_HOST` — SMTP sunucu adresi (default: `"smile1.ixirdns.com"`)
- `SMTP_PORT` — SMTP port (default: `"587"`)
- `SMTP_SECURE` — TLS/SSL kullanımı (default: `"false"`, `"true"` olmalı 465 için)
- `SMTP_USER` — SMTP kullanıcı adı (zorunlu)
- `SMTP_PASS` — SMTP şifre (zorunlu)
- `SMTP_FROM` — Gönderen email adresi (default: `"Destek <destek@cinselhobi.com>"`)

**Admin Bildirim:**
- `ADMIN_NOTIFY_TO` — Admin bildirim email adresi (default: `"destek@cinselhobi.com"`)

**Base URL (Email Link'leri İçin):**
- `AUTH_URL` — Base URL (email link'leri için, fallback: `NEXT_PUBLIC_BASE_URL` veya `"https://cinselhobi.com"`)
- `NEXT_PUBLIC_BASE_URL` — Public base URL (fallback)

> **Not:** `.env*` dosyaları repo'da yok (gitignore'da olmalı). Sadece kodda okunan env var isimleri listelenmiştir.

### 3.4 Bulunan Akışlar (Trigger → Send)

#### 3.4.1 Sipariş Onay Email'i (Order Confirmation)

**Trigger:**
- `src/actions/checkout.ts::createOrderAction()` — Sipariş başarıyla oluşturulduktan sonra

**Akış:**
1. Sipariş oluşturulur (`createOrder()`)
2. User bilgileri DB'den çekilir (`users.email`, `users.name`)
3. Adres bilgileri çekilir (`userAddresses`)
4. Sipariş ürünleri çekilir (`getOrderItemsByOrderId()`)
5. `sendOrderConfirmationEmail()` çağrılır (best-effort, hata durumunda sipariş oluşturmayı bozmaz)
6. `EMAIL_ENABLED !== "true"` ise sessizce çıkılır
7. `createTransport()` ile SMTP transport oluşturulur
8. Template'ler render edilir (HTML + text)
9. `transporter.sendMail()` ile email gönderilir
10. Hata durumunda sadece loglanır, exception fırlatılmaz

**Kod Yeri:**
- `src/actions/checkout.ts` (satır 44-120)
- `src/lib/email/send.ts::sendOrderConfirmationEmail()` (satır 46-78)
- `src/lib/email/templates/order-confirmation.ts`

**Provider/Transport:**
- Nodemailer SMTP transport
- SMTP_HOST: `smile1.ixirdns.com` (default)
- SMTP_PORT: `587` (default)
- TLS: `rejectUnauthorized: true`, `servername: host`

**Template:**
- HTML string template (inline styles)
- Text fallback template
- Türkçe içerik

**Error Handling:**
- Try-catch ile yakalanır
- `console.error()` ile loglanır
- Exception fırlatılmaz (best-effort pattern)
- Sipariş oluşturma akışını bozmaz

**Log/Metrics:**
- Sadece `console.error()` logları var
- Metrics/monitoring yok

#### 3.4.2 Admin Bildirim Email'i (Admin Notification)

**Trigger:**
- `src/actions/checkout.ts::createOrderAction()` — Sipariş başarıyla oluşturulduktan sonra (order confirmation'dan hemen sonra)

**Akış:**
1. `sendAdminNotificationEmail()` çağrılır (best-effort)
2. `EMAIL_ENABLED !== "true"` ise sessizce çıkılır
3. `createTransport()` ile SMTP transport oluşturulur
4. Template'ler render edilir (HTML + text)
5. `transporter.sendMail()` ile admin email'ine gönderilir (`ADMIN_NOTIFY_TO` veya `"destek@cinselhobi.com"`)
6. Hata durumunda sadece loglanır

**Kod Yeri:**
- `src/actions/checkout.ts` (satır 101-115)
- `src/lib/email/send.ts::sendAdminNotificationEmail()` (satır 84-118)
- `src/lib/email/templates/admin-notification.ts`

**Provider/Transport:**
- Aynı SMTP transport (order confirmation ile aynı)

**Template:**
- HTML string template (inline styles)
- Text fallback template
- Türkçe içerik

**Error Handling:**
- Aynı pattern (best-effort, log-only)

**Log/Metrics:**
- Sadece `console.error()` logları var

#### 3.4.3 Auth Email'leri (Email Verification / Password Reset)

**Durum:** **YOK**

**Bulgular:**
- `src/auth.ts` — Sadece Credentials provider var, Email provider yok
- `src/app/api/auth/signup/route.ts` — Email verification gönderimi yok
- `src/db/schema.ts` — `verificationTokens` tablosu var (Auth.js adapter için) ama kullanılmıyor
- `users.emailVerified` kolonu var ama hiçbir yerde set edilmiyor
- Password reset endpoint'i yok
- Magic link authentication yok

**Master Pack'te:**
- "Email verification var mı? Signup'ta email verification mekanizması Unknown" (satır 3999)

#### 3.4.4 İletişim Formu / Diğer Bildirimler

**Durum:** **YOK**

**Bulgular:**
- İletişim formu endpoint'i yok
- Newsletter signup email'i yok
- Abonelik bildirim email'leri yok

---

## 4. Roadmap

### 4.1 MVP (Minimum Viable Email)

**Hedef:** Mevcut sipariş email'lerinin production-ready hale getirilmesi

**Adımlar:**

1. **ENV Konfigürasyonu Dokümantasyonu**
   - Hangi env var'ların gerekli olduğu dokümante edilmeli
   - `.env.example` dosyası oluşturulmalı (secret değerler olmadan)
   - **Dosyalar:** `docs/` (yeni doküman), `.env.example` (yeni dosya)

2. **Email Gönderim Test Stratejisi**
   - Local development için test email gönderimi (Mailtrap, Ethereal Email, vb.)
   - Test mode için mock transport seçeneği
   - **Dosyalar:** `src/lib/email/transport.ts` (test mode ekleme), `docs/` (test guide)

3. **Error Handling İyileştirmesi**
   - Email gönderim hatalarının daha iyi loglanması (structured logging)
   - Hata durumunda admin'e bildirim (opsiyonel, email dışı kanal)
   - **Dosyalar:** `src/lib/email/send.ts` (error handling iyileştirme)

4. **Template İyileştirmesi (Opsiyonel)**
   - Responsive email template'ler (media queries)
   - Brand consistency kontrolü
   - **Dosyalar:** `src/lib/email/templates/*.ts`

**Risk:** Düşük (mevcut kod zaten çalışıyor, sadece iyileştirme)

### 4.2 Phase 2: Auth Email'leri

**Hedef:** Email verification ve password reset

**Adımlar:**

1. **Email Verification (Signup)**
   - Signup sonrası verification email gönderimi
   - Verification token oluşturma ve DB'ye kaydetme
   - Verification endpoint'i (`/api/auth/verify-email`)
   - `users.emailVerified` kolonunu set etme
   - **Dosyalar:** `src/app/api/auth/signup/route.ts`, `src/app/api/auth/verify-email/route.ts` (yeni), `src/lib/email/templates/email-verification.ts` (yeni), `src/actions/auth.ts`

2. **Password Reset**
   - Password reset request endpoint'i (`/api/auth/forgot-password`)
   - Reset token oluşturma ve email gönderimi
   - Reset endpoint'i (`/api/auth/reset-password`)
   - **Dosyalar:** `src/app/api/auth/forgot-password/route.ts` (yeni), `src/app/api/auth/reset-password/route.ts` (yeni), `src/lib/email/templates/password-reset.ts` (yeni), `src/actions/auth.ts`

3. **Auth.js Email Provider (Opsiyonel)**
   - NextAuth.js Email provider entegrasyonu (magic link)
   - Mevcut Credentials provider ile birlikte çalışabilmeli
   - **Dosyalar:** `src/auth.ts`, `src/auth.config.ts`

**Risk:** Orta (yeni endpoint'ler, token yönetimi, güvenlik)

### 4.3 Phase 3: İleri Seviye Özellikler

**Hedef:** Production-grade email altyapısı

**Adımlar:**

1. **Email Queue Sistemi**
   - BullMQ veya benzeri queue sistemi
   - Retry mekanizması (exponential backoff)
   - Failed email'lerin manuel retry'i
   - **Dosyalar:** `src/lib/email/queue.ts` (yeni), `src/workers/email-worker.ts` (yeni)

2. **Template Sistemi İyileştirmesi**
   - React Email veya MJML entegrasyonu
   - Template versioning
   - A/B testing desteği (opsiyonel)
   - **Dosyalar:** `src/lib/email/templates/` (refactor), `package.json` (yeni bağımlılıklar)

3. **Monitoring & Analytics**
   - Email gönderim metrikleri (sent, delivered, opened, clicked)
   - Provider webhook entegrasyonu (SendGrid, Postmark, vb.)
   - **Dosyalar:** `src/app/api/webhooks/email/route.ts` (yeni), monitoring dashboard (yeni)

4. **Multi-Provider Support**
   - Provider abstraction layer (SMTP, SendGrid, Postmark, Resend, vb.)
   - Failover mekanizması
   - **Dosyalar:** `src/lib/email/providers/` (yeni klasör), `src/lib/email/transport.ts` (refactor)

**Risk:** Yüksek (karmaşık altyapı, ek bağımlılıklar, operasyonel yük)

---

## 5. Where We Are Now

**Şu An Mail Gönderimi:**
- ✅ **VAR** — Sipariş onay email'i (müşteri)
- ✅ **VAR** — Admin bildirim email'i (yeni sipariş)
- ❌ **YOK** — Email verification (signup)
- ❌ **YOK** — Password reset
- ❌ **YOK** — İletişim formu email'i
- ❌ **YOK** — Newsletter/abonelik email'leri

**Mevcut Durum:**
- Email gönderim altyapısı **temel seviyede çalışıyor**
- Nodemailer + SMTP transport kullanılıyor
- Template'ler basit HTML string'ler (inline styles)
- Error handling best-effort pattern (hata durumunda sipariş oluşturmayı bozmaz)
- Retry/queue mekanizması **yok**
- Local/test stratejisi **yok**
- Monitoring/metrics **yok**

**Devam Edilecek İlk Somut İş:**
1. **ENV konfigürasyonu dokümantasyonu** — Hangi env var'ların gerekli olduğu, default değerler, production setup
2. **Test stratejisi** — Local development için test email gönderimi (Mailtrap/Ethereal Email)
3. **Email verification** — Signup sonrası verification email gönderimi (Phase 2, ilk öncelik)

---

## 6. Files to Touch (Gelecek İş İçin)

### 6.1 MVP İçin
- `docs/email-setup.md` (yeni) — ENV konfigürasyonu, test setup
- `.env.example` (yeni) — Örnek env dosyası (secret'lar olmadan)
- `src/lib/email/transport.ts` — Test mode ekleme
- `src/lib/email/send.ts` — Error handling iyileştirme

### 6.2 Phase 2 (Auth Email'leri) İçin
- `src/app/api/auth/verify-email/route.ts` (yeni)
- `src/app/api/auth/forgot-password/route.ts` (yeni)
- `src/app/api/auth/reset-password/route.ts` (yeni)
- `src/lib/email/templates/email-verification.ts` (yeni)
- `src/lib/email/templates/password-reset.ts` (yeni)
- `src/actions/auth.ts` — Email verification ve password reset action'ları
- `src/app/api/auth/signup/route.ts` — Verification email gönderimi ekleme

### 6.3 Phase 3 (İleri Seviye) İçin
- `src/lib/email/queue.ts` (yeni)
- `src/workers/email-worker.ts` (yeni)
- `src/lib/email/providers/` (yeni klasör)
- `src/app/api/webhooks/email/route.ts` (yeni)
- `package.json` — Yeni bağımlılıklar (bullmq, react-email, vb.)

---

## 7. Implementation Notes

### 7.1 Mevcut Kod Kalitesi
- ✅ Best-effort pattern doğru kullanılmış (sipariş oluşturmayı bozmaz)
- ✅ Error handling mevcut (log-only)
- ⚠️ Template'ler basit (inline styles, responsive değil)
- ⚠️ Retry mekanizması yok (SMTP hatası durumunda email kaybolur)
- ⚠️ Monitoring yok (email gönderim başarısı/başarısızlığı takip edilmiyor)

### 7.2 Güvenlik Notları
- SMTP credentials env var'larda saklanıyor (doğru)
- `.env*` dosyaları gitignore'da olmalı (kontrol edilmeli)
- Email içinde PII var (müşteri adı, email, adres) — GDPR uyumluluğu için dikkat
- Verification token'lar güvenli şekilde oluşturulmalı (nanoid/crypto)

### 7.3 Performance Notları
- Email gönderimi senkron (sipariş oluşturma akışını blokluyor)
- Queue sistemi olmadığı için yüksek trafikte sorun olabilir
- Template rendering basit (performans sorunu yok)

### 7.4 Dokümantasyon Eksiklikleri
- ENV değişkenleri dokümante edilmemiş
- Test setup guide yok
- Production deployment guide'da email konfigürasyonu yok

---

## 8. DoD (Definition of Done)

**MVP İçin:**
- [ ] ENV konfigürasyonu dokümante edildi
- [ ] `.env.example` dosyası oluşturuldu
- [ ] Local test stratejisi dokümante edildi (Mailtrap/Ethereal Email)
- [ ] Error handling iyileştirildi (structured logging)
- [ ] Production'da email gönderimi test edildi

**Phase 2 İçin:**
- [ ] Email verification çalışıyor (signup sonrası)
- [ ] Password reset çalışıyor
- [ ] Verification token'lar güvenli şekilde oluşturuluyor
- [ ] Token expiration mekanizması var
- [ ] Email template'leri responsive

**Phase 3 İçin:**
- [ ] Queue sistemi kuruldu
- [ ] Retry mekanizması çalışıyor
- [ ] Monitoring/metrics entegre edildi
- [ ] Multi-provider support var (opsiyonel)

---

## 9. Risk & Rollback

### 9.1 Riskler

**MVP:**
- **Düşük risk** — Mevcut kod zaten çalışıyor, sadece dokümantasyon ve test stratejisi

**Phase 2 (Auth Email'leri):**
- **Orta risk** — Yeni endpoint'ler, token yönetimi, güvenlik açıkları riski
- **Mitigation:** Token expiration, rate limiting, güvenli token generation

**Phase 3 (Queue/Monitoring):**
- **Yüksek risk** — Karmaşık altyapı, ek bağımlılıklar, operasyonel yük
- **Mitigation:** Aşamalı rollout, monitoring, rollback planı

### 9.2 Rollback Stratejisi

**Email Gönderimi:**
- `EMAIL_ENABLED=false` ile tüm email gönderimi devre dışı bırakılabilir
- Mevcut kod zaten bu pattern'i destekliyor

**Auth Email'leri:**
- Email verification opsiyonel yapılabilir (email verified olmadan da login)
- Password reset olmadan da sistem çalışır (admin manuel reset)

**Queue Sistemi:**
- Queue devre dışı bırakılıp direkt SMTP'ye dönülebilir
- Provider abstraction layer sayesinde kolay geçiş

---

## 10. Assumptions / Unknowns

### 10.1 Assumptions

1. **SMTP Provider:** `smile1.ixirdns.com` production SMTP sunucusu olarak kullanılıyor
   - **Reasoning:** `transport.ts` içinde default değer olarak ayarlanmış
   - **Risk:** Düşük (env var ile override edilebilir)

2. **Email Gönderim Zorunluluğu:** Email gönderim hatası sipariş oluşturmayı bozmamalı
   - **Reasoning:** Mevcut kod best-effort pattern kullanıyor
   - **Risk:** Düşük (doğru yaklaşım)

3. **Template Sistemi:** Basit HTML string template'ler yeterli (şimdilik)
   - **Reasoning:** Mevcut template'ler çalışıyor, karmaşık template sistemi gerekmiyor
   - **Risk:** Orta (responsive email desteği eksik)

### 10.2 Unknowns

1. **Production SMTP Konfigürasyonu:** Production'da hangi SMTP provider kullanılıyor?
   - **Durum:** Unknown
   - **Aksiyon:** Production env var'larını kontrol et

2. **Email Deliverability:** Email'ler spam'e düşüyor mu?
   - **Durum:** Unknown
   - **Aksiyon:** SPF/DKIM/DMARC kayıtlarını kontrol et, email test et

3. **Email Gönderim Hacmi:** Günde kaç email gönderiliyor?
   - **Durum:** Unknown
   - **Aksiyon:** Monitoring ekle

4. **Retry İhtiyacı:** SMTP hatası durumunda email kaybı oluyor mu?
   - **Durum:** Unknown
   - **Aksiyon:** Log'ları kontrol et, queue sistemi ekle (Phase 3)

5. **Email Verification Zorunluluğu:** Kullanıcılar email doğrulamadan login olabiliyor mu?
   - **Durum:** Unknown (şu an verification yok)
   - **Aksiyon:** Product requirement'a göre karar ver

---

## 11. Evidence Checklist

### 11.1 Aradığım Anahtar Kelimeler

**Email/SMTP Provider:**
- ✅ `email`, `eposta`, `smtp`, `nodemailer` — Bulundu
- ❌ `resend`, `sendgrid`, `postmark`, `mailgun`, `brevo`, `ses`, `sparkpost` — Bulunamadı

**Template Sistemi:**
- ❌ `@react-email`, `react-email`, `mjml`, `handlebars` — Bulunamadı

**Auth Email:**
- ✅ `NextAuth`, `Auth.js`, `verification` — Bulundu (ama EmailProvider yok)
- ❌ `EmailProvider`, `magic link` — Bulunamadı

**Sipariş Email:**
- ✅ `order confirmation`, `sipariş`, `checkout`, `invoice`, `fatura`, `notification` — Bulundu

**Queue/Retry:**
- ❌ `queue`, `retry`, `bull`, `redis`, `bullmq` — Bulunamadı

### 11.2 İncelediğim Kritik Dosyalar

**Email Altyapısı:**
- ✅ `src/lib/email/transport.ts` — SMTP transport
- ✅ `src/lib/email/send.ts` — Email gönderim fonksiyonları
- ✅ `src/lib/email/templates/order-confirmation.ts` — Template
- ✅ `src/lib/email/templates/admin-notification.ts` — Template

**Email Kullanım:**
- ✅ `src/actions/checkout.ts` — Sipariş email gönderimi

**Auth:**
- ✅ `src/auth.ts` — NextAuth config (EmailProvider yok)
- ✅ `src/app/api/auth/signup/route.ts` — Signup (verification yok)
- ✅ `src/db/schema.ts` — `emailVerified` kolonu var ama kullanılmıyor

**Bağımlılıklar:**
- ✅ `package.json` — `nodemailer`, `@types/nodemailer` var

**Master Pack:**
- ✅ `docs/00.chatgpt-master-pack-31-12-2025.md` — Email service entegrasyonu sorusu var, detay yok

---

## 12. Kaldığımız Yer (Devam Noktası)

**Mevcut Durum Özeti:**
Email gönderim altyapısı temel seviyede çalışıyor. Sipariş onay ve admin bildirim email'leri gönderiliyor. Ancak email verification, password reset, queue sistemi, monitoring gibi özellikler eksik. Template'ler basit HTML string'ler ve responsive değil. Error handling best-effort pattern kullanıyor (doğru yaklaşım) ama retry mekanizması yok.

**Devam Edilecek İlk İş:**
1. **ENV konfigürasyonu dokümantasyonu** — Hangi env var'ların gerekli olduğu, default değerler, production setup guide'ı oluşturulmalı. Bu, production deployment için kritik.
2. **Test stratejisi** — Local development için Mailtrap veya Ethereal Email entegrasyonu eklenmeli. Bu, geliştirme sırasında email test etmeyi kolaylaştırır.
3. **Email verification** — Signup sonrası verification email gönderimi eklenmeli (Phase 2). Bu, güvenlik ve kullanıcı deneyimi için önemli.

**Öncelik Sırası:**
1. MVP (dokümantasyon + test stratejisi) — Hemen yapılabilir, risk düşük
2. Phase 2 (email verification) — Orta vadede, güvenlik için önemli
3. Phase 3 (queue/monitoring) — Uzun vadede, scale için gerekli

**Not:** Mevcut email gönderim sistemi production'da kullanılabilir durumda, ancak monitoring ve retry mekanizması olmadan email kaybı riski var. Production'a geçmeden önce en azından MVP adımları tamamlanmalı.

---

**Rapor Sonu**
