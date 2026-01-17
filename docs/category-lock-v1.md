# Category Lock v1 — Kategori Yapısı ve Sayım Kuralları

> **Versiyon:** v1  
> **Tarih:** 2026-01-15  
> **Durum:** KİLİT (Locked)

---

## 1. Terminoloji

### 1.1 Temel Terimler

- **Direct (Direkt):** Bir kategoriye doğrudan bağlı ürün sayısı (child kategoriler dahil değil)
- **Descendant (Alt Kategori):** Bir kategorinin altındaki tüm child kategoriler
- **Rollup (Toplama):** Alt kategorilerdeki ürünleri de dahil ederek toplam sayı hesaplama
- **Overlap (Çakışma):** Aynı ürünün hem parent hem child kategoriye bağlı olması durumu
- **Unique (Tekilleştirilmiş):** Aynı ürün birden fazla kategoride olsa bile sayımda sadece bir kez sayılması

### 1.2 Sayım Türleri

- **Direct Instock:** Kategoriye direkt bağlı ve `status=publish` + `stock_status=instock` olan ürün sayısı
- **Descendant Instock:** Alt kategorilerdeki instock ürün sayısı (tekilleştirilmiş)
- **Rolled-Up Unique Instock:** Direct + Descendant - Overlap (tekilleştirilmiş toplam)

---

## 2. UI Sayım Standardı (KİLİT)

### 2.1 Child Kategori Kart/Sayfa Sayımı

**Kural:** Child kategori kartlarında ve sayfalarında gösterilecek sayı **Direct Instock** olmalıdır.

**Örnek:**
- Kategori: "Bayan İstek Arttırıcılar" (child kategori)
- Direct Instock: 3
- Gösterilecek sayı: **3**

### 2.2 Top-Level Kategori Sayımı

**Kural:** Top-level kategorilerde gösterilecek sayı **Rolled-Up Unique Instock** olmalıdır.

**Hesaplama:**
```
Rolled-Up Unique Instock = Direct Instock + Descendant Instock - Overlap Instock
```

**Örnek:**
- Kategori: "Kozmetik" (top-level)
- Direct Instock: 0
- Descendant Instock: 13
- Overlap Instock: 0
- Rolled-Up Unique Instock: 0 + 13 - 0 = **13**
- Gösterilecek sayı: **13**

### 2.3 Navigation'da Görünme Kuralı

**Kural:** Bir kategori navigation'da (menü, sidebar, vb.) sadece **Rolled-Up Unique Instock > 0** ise gösterilmelidir.

**Özel Durum:** Child kategoriler için Direct Instock > 0 kontrolü yapılabilir (UI tasarımına göre).

---

## 3. "Kozmetik" Kuralı (KİLİT)

### 3.1 Durum

"Kozmetik" kategorisi özel bir durumdur:
- Direct Instock: **0** (kategoriye direkt bağlı ürün yok)
- Rolled-Up Unique Instock: **13** (alt kategorilerden geliyor)

### 3.2 UI Davranışı

1. **Rolled-Up Unique Instock > 0 ise:**
   - Kategori navigation'da gösterilir
   - Top-level kategori sayfasında rolled-up unique sayı ile ürünler gösterilir
   - Kategori "boş" olarak görünmez

2. **Rolled-Up Unique Instock = 0 ise (fallback):**
   - Kategori UI'da gizlenir (DB'den silinmez)
   - Bu durumda kategori muhtemelen gerçekten boştur

### 3.3 Genel Kural

**Kural:** Herhangi bir top-level kategori için `direct=0` olabilir; eğer `rolled-up unique > 0` ise kategori UI'da gösterilir ve ürünler listelenir.

---

## 4. Overlap/Double-Link Politikası (KİLİT ama değiştirilebilir)

### 4.1 Mevcut Durum

Veritabanında şu anda **211 kayıt** parent+child birlikte linkli ürün içermektedir. Bu durum:
- Kategori bazlı toplamların şişmesine neden olur
- Aynı ürün birden fazla kategoride sayılabilir

### 4.2 UI Kuralı

**Kritik Kural:** UI asla "kategorilerdeki instock toplamı"nı global ürün sayısı sanmamalıdır.

**Örnek:**
- Global publish+instock ürün sayısı: **244**
- Kategorilerdeki rolled-up unique toplamı: **> 244** (overlap nedeniyle)

Bu durum normaldir ve UI'da hata olarak gösterilmemelidir.

### 4.3 Gelecek Değişiklik Politikası

Bu politika **KİLİT** olarak işaretlenmiştir ama **değiştirilebilir**. Değişiklik yapılacaksa:
1. Backup alınmalı
2. Plan SQL oluşturulmalı (ROLLBACK hazır)
3. Apply SQL uygulanmalı (COMMIT)
4. Verify SQL ile doğrulanmalı

---

## 5. Açık Kararlar "LOCK DEĞİL" Bölümü

### 5.1 Vibratörler Kategorisi

**Durum:** 2 aday kategori mevcut:
- `modern-vibratorler`
- `realistik-vibratorler`

**Açık Soru:** 
- Tek slug mı olacak?
- Sanal koleksiyon mu olacak?
- Hub mantığı mı uygulanacak?

**Karar:** LOCK DEĞİL — Hub QC komutu (`npm run hub:qc`) ile takip edilmektedir.

### 5.2 App&Akıllı Kategorisi

**Durum:** İsim/etiket kuralları henüz kilitlenmemiştir.

**Açık Soru:**
- İsim standardı nedir?
- Etiketleme kuralı nedir?

**Karar:** LOCK DEĞİL — Hub QC komutu ile takip edilmektedir.

### 5.3 Hub'ların Konumu

**Açık Soru:**
- Hub'lar DB'de mi yaşayacak?
- UI'da mı yaşayacak?
- URL stratejisi nedir?

**Karar:** LOCK DEĞİL — Gelecek kararlar için açık bırakılmıştır.

---

## 6. Baseline Sayıları (KİLİT)

### 6.1 Ürün Baseline

- **Publish + Instock:** 244
- **Publish + Outofstock:** 30
- **Publish Total:** 274

### 6.2 Kategori Baseline

- **Toplam Kategori:** 26
- **Top-Level Kategori:** 9
- **Child Kategori:** 17
- **Max Depth:** 1

### 6.3 Sağlık Kontrolü Baseline

- **Orphan Products:** 0 (kategorisiz ürün olmamalı)
- **Multi-Top-Level:** 0 (ürün 2+ top-level kategoride olmamalı)

**Not:** Bu sayılar `category:lock` script'i tarafından doğrulanır.

---

## 7. Doğrulama Prosedürü

### 7.1 Otomatik Doğrulama

`npm run category:lock` komutu çalıştırıldığında:
1. Baseline sayıları kontrol edilir
2. Sağlık kontrolleri yapılır
3. Rapor üretilir
4. FAIL durumunda exit code 1 döner

### 7.2 Manuel Doğrulama

Baseline dosyası (`locks/category-lock-baseline.json`) değiştirilmeden önce:
1. Değişiklik nedenleri dokümante edilmelidir
2. Change Log satırı eklenmelidir
3. Kasıtlı değişiklik kanıtı olmalıdır

---

## 8. Değişiklik Yönetimi

### 8.1 Baseline Güncelleme

Baseline dosyası güncellenirken:
1. **Change Log** satırı eklenmelidir
2. Versiyon numarası artırılmalıdır
3. Değişiklik nedeni açıklanmalıdır

### 8.2 Kural Değişikliği

Bu dokümandaki kurallar değiştirilirken:
1. Versiyon numarası artırılmalıdır (örn: v1 → v2)
2. Değişiklik tarihi güncellenmelidir
3. Değişiklik nedeni ve etkisi dokümante edilmelidir

---

## 9. Referanslar

- **Baseline Dosyası:** `locks/category-lock-baseline.json`
- **Doğrulama Script'i:** `scripts/category-tree-analysis.ts`
- **Rapor Dosyaları:** `exports/` klasörü
- **Hub QC Komutu:** `npm run hub:qc`

---

## 10. Örnekler

### 10.1 Normal Child Kategori

**Kategori:** "Bayan İstek Arttırıcılar" (child)
- Direct Instock: 3
- UI'da gösterilecek: **3**

### 10.2 Normal Top-Level Kategori

**Kategori:** "Anal Oyuncaklar" (top-level)
- Direct Instock: 21
- Descendant Instock: 0
- Overlap Instock: 0
- Rolled-Up Unique Instock: 21
- UI'da gösterilecek: **21**

### 10.3 Özel Durum: Kozmetik

**Kategori:** "Kozmetik" (top-level)
- Direct Instock: 0
- Descendant Instock: 13
- Overlap Instock: 0
- Rolled-Up Unique Instock: 13
- UI'da gösterilecek: **13** (kategori boş görünmez)

### 10.4 Overlap Örneği

**Kategori:** "Sex Oyuncakları" (top-level)
- Direct Instock: 91
- Descendant Instock: 94
- Overlap Instock: 91
- Rolled-Up Unique Instock: 91 + 94 - 91 = **94**
- UI'da gösterilecek: **94** (overlap çıkarılmış)

---

## 11. Guardrail Rules (KİLİT)

Guardrail kuralları, import/manuel hataların tekrar etmesini önlemek için otomatik kontrol mekanizmasıdır. Bu kurallar READ-ONLY ve FAIL-fast prensibiyle çalışır.

### 11.1 Çalıştırma

Guardrail kontrolü şu komutla çalıştırılır:
```bash
npm run guardrail:forbidden
```

Script, tüm publish+instock ürünleri kontrol eder ve ihlal bulursa:
- `exports/guardrail-violations.csv` dosyasına ihlalleri yazar
- Exit code 1 ile sonlanır (FAIL)
- Konsola detaylı ihlal raporu yazdırır

Eğer hiçbir ihlal yoksa:
- Exit code 0 ile sonlanır (PASS)
- Konsola başarı mesajı yazdırır

### 11.2 RULE-1: Manken Ürünleri ve Et Dokulu Ürünler

**Kural:** Ürün slug veya name'de 'manken' içeren ürünler `et-dokulu-urunler` kategorisinde bulunamaz.

**Neden:** Manken ürünleri, et dokulu ürünler kategorisinden farklı bir intent'e sahiptir. Manken ürünleri genellikle tam vücut veya yarım vücut mankenlerdir ve `realistik-mankenler` gibi özel kategorilerde olmalıdır.

**Örnek İhlal:**
- Ürün: `yarim-vucut-mega-boy-ultra-realistik-manken`
- Kategoriler: `et-dokulu-urunler`, `realistik-mankenler`
- İhlal: Ürün 'manken' içeriyor ve `et-dokulu-urunler` kategorisinde bulunuyor

**Çözüm:** Ürünün `et-dokulu-urunler` kategorisinden bağlantısını kaldırın.

### 11.3 RULE-2: Kadınlara Özel Hub ve Erkek Intent

**Kural:** `kadinlara-ozel` hub'ı altında erkek-intent keyword'lü ürün bulunamaz.

**Neden:** Hub'lar intent bazlı ayrım yapar. `kadinlara-ozel` hub'ı kadın kullanıcılara yönelik ürünler içermelidir. Erkek-intent keyword'leri (penis, masturbator, pompa, kilif, halka, suni-vajina) içeren ürünler bu hub altında olmamalıdır.

**Intent Tespiti:** Script, ürün slug ve name'de şu keyword'leri arar:
- Erkek intent: `penis`, `masturbator`, `pompa`, `kilif`, `halka`, `suni-vajina`
- Kadın intent: `vibrator`, `dildo`, `vajina`

**Örnek İhlal:**
- Ürün: `gercekci-penis-masturbator-set`
- Hub: `kadinlara-ozel`
- Intent: `erkek` (penis, masturbator keyword'leri nedeniyle)
- İhlal: Erkek-intent ürün kadınlara özel hub'ında bulunuyor

**Çözüm:** Ürünü doğru hub'a taşıyın (örn: `erkeklere-ozel` veya uygun kategori).

### 11.4 RULE-3: Erkeklere Özel Hub ve Kadın Intent

**Kural:** `erkeklere-ozel` hub'ı altında kadın-intent keyword'lü ürün bulunamaz.

**Neden:** Hub'lar intent bazlı ayrım yapar. `erkeklere-ozel` hub'ı erkek kullanıcılara yönelik ürünler içermelidir. Kadın-intent keyword'leri (vibrator, dildo, vajina) içeren ürünler bu hub altında olmamalıdır.

**Örnek İhlal:**
- Ürün: `gucu-yuksek-vibrator-dildo-set`
- Hub: `erkeklere-ozel`
- Intent: `kadin` (vibrator, dildo keyword'leri nedeniyle)
- İhlal: Kadın-intent ürün erkeklere özel hub'ında bulunuyor

**Çözüm:** Ürünü doğru hub'a taşıyın (örn: `kadinlara-ozel` veya uygun kategori).

### 11.5 Intent Heuristics ve Kategori Bağlamı

Intent heuristics, skor bazlı hesaplama yapar ve kategori bağlamını kullanarak intent'i belirler. Kategori override mekanizması sayesinde, belirli kategorilerdeki ürünler için intent kesin olarak belirlenir:

- **Erkek Override Kategorileri:** `suni-vajina-masturbatorler` → Bu kategorideki ürünler her zaman `erkek` intent'ine sahiptir
- **Kadın Override Kategorileri:** `realistik-vibratorler`, `modern-vibratorler` → Bu kategorilerdeki ürünler her zaman `kadin` intent'ine sahiptir

**Örnek:** `big-ass-buyuk-boy-ultra-realistik-anal-vajinal-girisli-et-dokusunda-kalca` ürünü slug/name'de "vajinal" içerse bile, eğer `suni-vajina-masturbatorler` kategorisindeyse intent `erkek` olarak belirlenir. Bu sayede false-positive'ler önlenir.

**Not:** "vajina/vajinal" kelimesi tek başına kadın intent yapmaz, çünkü "suni vajina masturbator" erkek bağlamında normal bir ifadedir.

### 11.6 Exceptions (İstisnalar) Dosyası

False-positive durumlarında, ürünleri exceptions dosyasına ekleyerek guardrail kontrolünden muaf tutabilirsiniz.

**Dosya Konumu:** `locks/guardrail-exceptions.json`

**Format:**
```json
{
  "RULE-1": ["product-slug-1", "product-slug-2"],
  "RULE-2": [],
  "RULE-3": []
}
```

**Kullanım:**
- Her RULE için bir array tanımlanır
- Array'e eklenen product slug'ları, o kural için ihlal olarak sayılmaz
- Dosya yoksa veya okunamazsa, tüm kurallar normal şekilde uygulanır

**Not:** Heuristics fix doğru çalışırsa, exceptions dosyasına ürün eklemeye gerek kalmayacaktır. Bu dosya sadece edge case'ler için kullanılmalıdır.

### 11.7 Hub Ancestor Hesaplama

Script, her ürün için kategori ağacını yukarı doğru takip ederek top-level hub'ı (parent_wc_id IS NULL olan kategori) bulur. Ürün birden fazla kategoriye bağlıysa, tüm hub'lar kontrol edilir.

### 11.8 Violations CSV Formatı

`exports/guardrail-violations.csv` dosyası şu kolonları içerir:
- `rule`: İhlal edilen kural (RULE-1, RULE-2, RULE-3)
- `product_id`: Ürün ID
- `product_slug`: Ürün slug
- `product_name`: Ürün adı
- `hub_id`: Hub kategori ID (RULE-1 için null olabilir)
- `hub_slug`: Hub kategori slug
- `hub_name`: Hub kategori adı
- `category_slugs`: Ürünün tüm kategori slug'ları (noktalı virgülle ayrılmış)
- `reason`: İhlal nedeni (açıklama)

### 11.9 CI/CD Entegrasyonu

Guardrail kontrolü, CI/CD pipeline'ında şu şekilde kullanılabilir:
```bash
npm run guardrail:forbidden
```

Eğer ihlal varsa, pipeline FAIL olur ve deploy engellenir. Bu sayede hatalı kategori atamaları production'a gitmeden önce yakalanır.

---

## 12. Data Fix Ledger

Bu bölüm, kategori yapısındaki veri düzeltmelerini kayıt altına alır. Her fix, prod'a taşınabilir ve geri alınabilir SQL dosyaları ile dokümante edilmiştir.

### 11.1 Fix: Move Manken to Realistik Mankenler

**Tarih:** 2026-01-15  
**Ürün:** `yarim-vucut-mega-boy-ultra-realistik-manken`  
**Neden:** UX/Intent - Ürün manken kategorisine daha uygun. MultiTopLevel kuralı ihlalini düzeltmek için `sex-oyuncaklari` linki kaldırıldı.

**Değişiklikler:**
- `et-dokulu-urunler` linki kaldırıldı
- `realistik-mankenler` linki eklendi
- `sex-oyuncaklari` linki kaldırıldı (multiTopLevel kuralı)

**SQL Dosyaları:**
- Forward: `locks/db-fixes/2026-01-15_move_manken_to_realistik_mankenler.sql`
- Rollback: `locks/db-fixes/2026-01-15_move_manken_to_realistik_mankenler.rollback.sql`

---

## 13. UI Hub Mapping Lock (v1) (KİLİT)

### 13.1 Temel Prensip

**Kural:** UI navigasyonu asla DB'den otomatik türetilmez. Navigation tek bir config dosyasından (`src/config/hub-map.ts`) beslenir.

**Felsefe:**
- **DB = Depo:** Veritabanı sadece veri deposudur. Kategoriler DB'de saklanır ama UI'da nasıl gösterileceği DB yapısına bağlı değildir.
- **UI Hub = Kullanıcı Niyeti:** Hub'lar kullanıcı intent'ine göre organize edilir. DB top-level kategorileri ile birebir olmak zorunda değildir.

### 13.2 Hub Map Yapısı

**Dosya:** `src/config/hub-map.ts`

**Hub Tanımları:**
1. **Erkek & Performans** (`men-performance`)
2. **Kadın & Haz** (`women-pleasure`)
3. **Çiftlere Özel** (`couples`) - Virtual collection (v1'de placeholder)
4. **Sağlık & Bakım** (`health-care`)
5. **Fantezi Dünyası** (`fantasy-world`)

**Hub Item Tipleri:**
- `type: "category"` - Gerçek kategori slug'ı (DB'de mevcut olmalı)
- `type: "virtual"` - Sanal koleksiyon (DB'de kategori yok, query ile ürün seçimi)

### 13.3 Mixed Intent Kategoriler Politikası

**Kural:** Mixed intent kategoriler (örn: `sex-oyuncaklari`) hub menülerine direkt eklenmez; sadece güvenli alt linkler eklenir.

**Örnek:**
- `sex-oyuncaklari` kategorisi mixed intent olduğu için hub'a direkt eklenmez
- Ancak alt kategorileri (örn: `et-dokulu-urunler`, `modern-vibratorler`) kadın odaklı olduğu için "Kadın & Haz" hub'ına eklenir
- Bu alt kategoriler `note` alanında `"sex-oyuncaklari alt kategorisi"` olarak işaretlenir

### 13.4 Et-Dokulu Ürünler Kararı (KİLİT)

**Karar:** `et-dokulu-urunler` kategorisi UI'da "Kadın & Haz" hub'ı altında listelenir.

**Gerekçe:**
- Şimdiki envanter gerçekliği: 9 kadın odaklı ürün
- UI label'ı: "Ten Dokulu Modeller" (daha anlaşılır)
- Slug değişmez: `et-dokulu-urunler` (label ≠ slug)

**Gelecek Senaryo:**
- İleride erkek et-dokulu ürün gelirse guardrail ile yakalanacak (opsiyonel RULE-4)

### 13.5 Boş Kategori Politikası

**Kural:** `direct_publish=0` ise kategori "hidden-if-empty" politikasına sahiptir.

**Uygulama:**
- Hub Map'te `policy: "hidden-if-empty"` olan kategoriler, `getChildCategoriesByParentWcId` filtresiyle uyumludur
- Bu filtre, `direct_publish > 0` olan kategorileri döndürür
- UI'da boş kategoriler (0 publish) menüde görünmez

**Örnek:**
- `kozmetik` kategorisi `direct_publish=0` ama `rolled-up unique > 0` (alt kategorilerden geliyor)
- Hub Map'te `policy: "hidden-if-empty"` olarak işaretlenir
- UI'da gösterilir çünkü alt kategorilerinde ürün var

### 13.6 Parent-Child İlişkisi

**Kural:** Parent-child ilişkisi Hub Map'te manuel olarak tanımlanır. DB'den otomatik çekilmez.

**Format:**
- Parent kategoriler: `note` alanı yok veya "alt kategorisi" içermez
- Child kategoriler: `note` alanında `"{parent-slug} alt kategorisi"` formatında

**Örnek:**
```typescript
{
  type: "category",
  label: "Kadınlara Özel",
  slug: "kadinlara-ozel",
  // Parent kategori (note yok)
},
{
  type: "category",
  label: "Bayan İstek Arttırıcılar",
  slug: "bayan-istek-arttiricilar",
  note: "kadinlara-ozel alt kategorisi", // Child kategori
}
```

### 13.7 DesktopNavigation Entegrasyonu

**Dosya:** `src/components/layout/DesktopNavigation.tsx`

**Değişiklik:**
- Hardcoded `categoryTree` array kaldırıldı
- `getCategoryTreeFromHubMap()` fonksiyonu kullanılıyor
- Navigation artık Hub Map'ten besleniyor

**Not:** UI aynı kalır; sadece data kaynağı config olur.

### 13.8 Doğrulama

**Script:** `scripts/verify-hub-map.ts` (opsiyonel ama önerilir)

**Kontrol:**
- DB'den `categories.slug` listesini çek
- Hub Map içindeki `type="category"` item slug'larının DB'de varlığını doğrula
- Bulunmayan slug varsa exit code 1 (FAIL)

**Komut:** `npm run hub:verify`

---

## 14. DB Top-level Final Tree (2026-01-16)

### 14.1 Top-Level Kategoriler (5 adet)

Top-level cleanup sonrası final top-level kategori listesi:

1. `erkeklere-ozel`
2. `kadinlara-ozel`
3. `sex-oyuncaklari`
4. `kozmetik`
5. `fantezi-aksesuarlar`

**Önceki durum:** 9 top-level kategori  
**Yeni durum:** 5 top-level kategori

### 14.2 Taşınan Kategoriler

4 kategori parent altına taşındı:

1. **`anal-oyuncaklar`** → parent: `sex-oyuncaklari`
2. **`kayganlastirici-jeller`** → parent: `kozmetik`
3. **`geciktiriciler`** → parent: `erkeklere-ozel`
4. **`realistik-mankenler`** → parent: `erkeklere-ozel`

### 14.3 SQL Dosyaları

- **Forward SQL:** `locks/db-fixes/2026-01-16_move_top_levels_under_parents.sql`
- **Rollback SQL:** `locks/db-fixes/2026-01-16_move_top_levels_under_parents.rollback.sql`

### 14.4 Doğrulama

**Top-level listesi sorgusu:**
```sql
SELECT slug FROM categories WHERE parent_wc_id IS NULL ORDER BY slug;
```

**Beklenen sonuç:** 5 satır (yukarıdaki 5 kategori)

**Ağaç çıktısı sorgusu:**
```sql
SELECT parent.slug AS parent_slug, child.slug AS child_slug
FROM categories parent
LEFT JOIN categories child ON child.parent_wc_id = parent.wc_id
WHERE parent.parent_wc_id IS NULL
ORDER BY parent.slug, child.slug;
```

---

**Son Güncelleme:** 2026-01-16  
**Versiyon:** v1
