# Email Entegrasyonu Kilit Checklist (Prod/Staging)

> **Oluşturulma Tarihi:** 2026-01-16  
> **Amaç:** Sipariş email entegrasyonunu prod/staging ortamlarında güvenli şekilde çalıştırmak için operasyonel checklist  
> **Kapsam:** Order confirmation + Admin notification email'leri

---

## 1. Amaç ve Kapsam

Bu checklist, sipariş email entegrasyonunun production ve staging ortamlarında güvenli şekilde çalıştırılması için gerekli adımları içerir.

**Kapsam:**
- Müşteri sipariş onay email'i (Order Confirmation)
- Admin bildirim email'i (Admin Notification)

**Kapsam Dışı:**
- Auth email'leri (email verification, password reset)
- Marketing email'leri
- Newsletter email'leri

---

## 2. ENV Anahtar Listesi

Aşağıdaki environment variable'lar email entegrasyonu için gereklidir. **Değerler bu dokümanda yok**, sadece isimler listelenmiştir.

### 2.1 Email Gönderim Kontrolü

| ENV Key | Açıklama |
|---------|----------|
| `EMAIL_ENABLED` | Email gönderimini açıp kapatma (`"true"` olmalı) |

### 2.2 SMTP Konfigürasyonu

| ENV Key | Açıklama |
|---------|----------|
| `SMTP_HOST` | SMTP sunucu adresi (default: `"smile1.ixirdns.com"`) |
| `SMTP_PORT` | SMTP port (default: `"587"`) |
| `SMTP_SECURE` | TLS/SSL kullanımı (`"true"` veya `"false"`) |
| `SMTP_USER` | SMTP kullanıcı adı (zorunlu) |
| `SMTP_PASS` | SMTP şifre (zorunlu) |
| `SMTP_FROM` | Gönderen email adresi (default: `"Destek <destek@cinselhobi.com>"`) |

### 2.3 Admin Bildirim

| ENV Key | Açıklama |
|---------|----------|
| `ADMIN_NOTIFY_TO` | Admin bildirim email adresi (default: `"destek@cinselhobi.com"`) |

---

## 3. Ortam Bazlı Ayarlar

### 3.1 Local Development

**ENV Dosyası:** `.env.local` (gitignore'da olmalı)

**Gerekli ENV Key'ler:**
- `EMAIL_ENABLED=true` (test için)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (opsiyonel, default kullanılabilir)
- `ADMIN_NOTIFY_TO` (opsiyonel, default kullanılabilir)

**Not:** Local'de test için gerçek SMTP kullanılabilir veya test SMTP servisi kullanılabilir.

### 3.2 Staging

**ENV Dosyası:** Staging ortamı environment variable'ları

**Gerekli ENV Key'ler:**
- `EMAIL_ENABLED=true`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `ADMIN_NOTIFY_TO`

**Not:** Staging'de production SMTP kullanılabilir veya ayrı bir test SMTP servisi kullanılabilir.

### 3.3 Production

**ENV Dosyası:** Production ortamı environment variable'ları

**Gerekli ENV Key'ler:**
- `EMAIL_ENABLED=true`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `ADMIN_NOTIFY_TO`

**Not:** Production'da gerçek SMTP servisi kullanılmalı ve SMTP credentials güvenli şekilde saklanmalıdır.

---

## 4. Deploy Sonrası Smoke Test Adımları

Deploy sonrası email entegrasyonunun çalıştığını doğrulamak için aşağıdaki adımları takip edin:

### 4.1 Pre-Conditions

- [ ] ENV variable'ları doğru şekilde ayarlanmış
- [ ] `EMAIL_ENABLED=true` olduğu doğrulandı
- [ ] SMTP credentials doğru ve geçerli
- [ ] Test için kullanılacak gerçek email adresi hazır

### 4.2 Test Senaryosu

1. [ ] Login olun (test kullanıcısı ile)
2. [ ] Sepete 1 ürün ekleyin
3. [ ] `/checkout` sayfasına gidin
4. [ ] Adres seçin/ekleyin
5. [ ] COD (Kapıda Ödeme) seçin
6. [ ] Siparişi tamamlayın
7. [ ] Order ID'yi not edin

### 4.3 Doğrulama Adımları

**UI Kontrolü:**
- [ ] Order success sayfası gösterildi
- [ ] Order ID ekranda görüntülendi
- [ ] Herhangi bir hata mesajı yok

**DB Kontrolü:**
- [ ] Order `orders` tablosunda var
- [ ] Order status: `pending`
- [ ] Payment method: `cod`
- [ ] Customer email doğru

**Email Kontrolü:**
- [ ] Customer email inbox'a ulaştı
  - Subject: `Sipariş Onayı - #<ORDER_ID>`
  - Gönderen: `CinselHobi Sipariş <siparis@cinselhobi.com>` (veya `SMTP_FROM` değeri)
- [ ] Admin email inbox'a ulaştı
  - Subject: `Yeni Sipariş - #<ORDER_ID>`
  - Gönderen: `CinselHobi Sipariş <siparis@cinselhobi.com>` (veya `SMTP_FROM` değeri)

**Sonuç:**
- [ ] Her iki email de inbox'a ulaştı → ✅ **PASS**
- [ ] Email'lerden biri veya ikisi de gelmedi → ❌ **FAIL** (log'ları kontrol et)

---

## 5. Hata Senaryoları ve Çözümleri

### 5.1 SMTP Bağlantı Hatası

**Senaryo:** SMTP sunucusuna bağlanılamıyor (network hatası, SMTP down, yanlış credentials)

**Beklenen Davranış:**
- Email gönderim hatası sipariş oluşturmayı **bozmamalı**
- Best-effort pattern: Hata loglanır ama exception fırlatılmaz
- Sipariş başarıyla oluşturulur
- UI'da hata mesajı gösterilmez

**Kontrol:**
- [ ] Sipariş başarıyla oluşturuldu (DB'de var)
- [ ] Order success sayfası gösterildi
- [ ] Server log'larında email hatası var ama sipariş oluşturma başarılı

**Çözüm:**
1. SMTP credentials'ları kontrol et
2. SMTP_HOST ve SMTP_PORT doğru mu kontrol et
3. Network bağlantısını kontrol et
4. SMTP servis sağlayıcısının durumunu kontrol et

### 5.2 EMAIL_ENABLED=false Durumu

**Senaryo:** `EMAIL_ENABLED=false` veya `EMAIL_ENABLED` set edilmemiş

**Beklenen Davranış:**
- Email fonksiyonları erken return yapar
- `createTransport()` çağrılmaz
- SMTP bağlantısı kurulmaz
- Email gönderilmez
- Sipariş başarıyla oluşturulur

**Kontrol:**
- [ ] Sipariş başarıyla oluşturuldu
- [ ] Email gönderilmedi (beklenen)
- [ ] Server log'larında email ile ilgili log yok

**Çözüm:**
- `EMAIL_ENABLED=true` yap ve tekrar test et

### 5.3 Email Template Hatası

**Senaryo:** Email template render edilirken hata oluşuyor

**Beklenen Davranış:**
- Hata loglanır
- Email gönderilmez
- Sipariş başarıyla oluşturulur (best-effort)

**Kontrol:**
- [ ] Server log'larında template hatası var
- [ ] Sipariş başarıyla oluşturuldu

**Çözüm:**
- Template kodunu kontrol et
- Template parametrelerini kontrol et

---

## 6. Güvenlik: ENV/Secret/PII Kuralları

### 6.1 Environment Variable Güvenliği

**Kurallar:**
- [ ] `.env*` dosyaları gitignore'da
- [ ] `.env*` dosyaları repo'ya commit edilmemiş
- [ ] Production ENV variable'ları güvenli secret management sisteminde saklanıyor
- [ ] SMTP credentials (SMTP_USER, SMTP_PASS) asla kod içinde hardcode edilmemiş
- [ ] ENV variable değerleri dokümantasyonda yok (sadece isimler)

### 6.2 PII (Personally Identifiable Information) Hijyeni

**Kurallar:**
- [ ] Test raporlarında gerçek email adresleri maskelenmiş (örn: `l***@gmail.com`)
- [ ] Test raporlarında gerçek müşteri adları maskelenmiş (örn: `E*** A***`)
- [ ] Ekran görüntüleri gibi kanıtlar `data/snapshots/` altında ve gitignore'da
- [ ] Production log'larında PII bilgileri loglanmıyor (veya maskelenmiş)

### 6.3 Secret Sızıntı Kontrolü

**Kontrol Listesi:**
- [ ] Kod içinde hardcode SMTP credentials yok
- [ ] Kod içinde hardcode email adresleri yok (sadece default değerler var)
- [ ] Git history'de secret değerler yok
- [ ] Dokümantasyonda secret değerler yok

**Kontrol Komutları:**
```bash
# SMTP credentials kontrolü
git grep -i "SMTP_USER\|SMTP_PASS" -- "*.ts" "*.tsx" "*.js" "*.jsx"

# Hardcode email kontrolü
git grep -E "@gmail\.com|@cinselhobi\.com" -- "*.ts" "*.tsx" "*.js" "*.jsx" | grep -v "default\|example\|test"
```

---

## 7. Rollback: Hızlı Kapatma

Email entegrasyonunda kritik bir sorun olduğunda hızlı şekilde devre dışı bırakmak için:

### 7.1 EMAIL_ENABLED=false ile Kapatma

**Adımlar:**
1. [ ] Production ENV variable'larına git
2. [ ] `EMAIL_ENABLED=false` yap
3. [ ] Deploy/restart yap (veya ENV değişikliği otomatik reload ediliyorsa bekle)
4. [ ] Test siparişi ver ve email gönderilmediğini doğrula

**Sonuç:**
- Email gönderimi devre dışı kalır
- Sipariş oluşturma normal çalışmaya devam eder
- Best-effort pattern sayesinde hiçbir şey bozulmaz

### 7.2 Tam Rollback (Opsiyonel)

Eğer email kodunda kritik bir bug varsa ve tam rollback gerekiyorsa:
1. [ ] Önceki commit'e geri dön
2. [ ] Deploy yap
3. [ ] Test et

**Not:** Best-effort pattern sayesinde genellikle tam rollback gerekmez, sadece `EMAIL_ENABLED=false` yeterlidir.

---

## 8. Monitoring ve Logging

### 8.1 Log Kontrolü

**Email Gönderim Log'ları:**
- [ ] `[sendOrderConfirmationEmail]` log'ları kontrol et
- [ ] `[sendAdminNotificationEmail]` log'ları kontrol et
- [ ] Hata durumunda `console.error` log'ları var

**Not:** Şu an sadece `console.error` log'ları var, structured logging/metrics yok.

### 8.2 Monitoring (Gelecek İyileştirme)

**Öneriler:**
- Email gönderim başarı/hata metrikleri
- Email gönderim süresi metrikleri
- SMTP bağlantı durumu metrikleri
- Email deliverability metrikleri

---

## 9. Sonuç ve Onay

**Checklist Tamamlandı:**
- [ ] Tüm ENV variable'ları ayarlandı
- [ ] Deploy sonrası smoke test PASS
- [ ] Güvenlik kontrolleri yapıldı
- [ ] Rollback planı hazır

**Email Entegrasyonu Durumu:**
- [ ] ✅ **KİLİTLİ / PROD-READY** - Tüm kontroller geçti, production'a hazır
- [ ] ❌ **KİLİTLİ DEĞİL** - Aşağıdaki sorunlar var:
  - [ ] Sorun 1: ...
  - [ ] Sorun 2: ...

---

**Son Güncelleme:** 2026-01-16  
**Hazırlayan:** [İsim]  
**Onaylayan:** [İsim]
