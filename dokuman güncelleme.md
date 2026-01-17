## Parça 1/3 — Hub Native Navigation “Merged Branch” Analizi (Özet + Kararlar + Kilitler)

### 0) Kapsam: Bu dalda **neyi kilitledik / neyi geliştirdik?**

Bu dalın ana deliverable’ı: **Hub’larda ( `/hub` + `/hub/[hubSlug]` ) native-app hissi veren hızlı keşif + ürün önizleme navigasyonu**.

* **/hub**: “Bento grid” hub kartları (hub seçimi)
* **/hub/[hubSlug]**: Hero + akış (stream) + “Quick Explore” rail + “Quick Look” bottom sheet
* Rail tık → **Bottom Sheet (Vaul Drawer)** açılır → **Sheet açılınca fetch** (lazy) → 8 ürün → “Tümünü Gör” ile kategori sayfasına gider
  Bu “Goal / Non-negotiables” lock doc’ta net tanımlı. 

---

### 1) Tüm Güncellemeler (Change-log mantığında, en önemli dönüm noktaları)

#### 1.1 “Category kartı” yerine **Quick Explore Rail + Quick Look Sheet** pivotu

* Hub detail’de kullanıcıyı aşağı sürükletmeden **tek ekranda keşif** hedefi: rail üstte, ürünler sheet’te.
* Bu pivotun performans ayağı: **56 ürün gibi toplu fetch yok**, yalnızca user sheet açarsa fetch. 

#### 1.2 Rail UI kararı: başlangıçta **Story Bubble**, sonra Türkçe label nedeniyle **Chip/Pill**’e evrim

* Lock doküman v1’de “Story bubbles (64x64)” kilitli. 
* Ancak pratikte TR kategori isimleri (“Sertleşme & Pompalar” vb.) story alt-label’da görsel kaliteyi bozduğu için dal içinde **chip/pill pattern**’e geçiş yapıldı (wrap yok, tek satır + ellipsis yaklaşımı).
  ➡️ Bu, “kilit dokümanın (v1)” ile **son UI gerçekliği arasında** güncellenmesi gereken bir sapma (Parça 3’te “update lock doc v2” olarak işaretleyeceğim).

#### 1.3 Hero banner entegrasyonu + asset setinin tamamlanması

* Lock doc, hero image’ları `public/images/hub/hero/${hubSlug}.webp` olarak tanımlar ve 5 hub için örnek isimleri verir. 
* Sen bu 5 görseli aynı isimlerle klasöre koyup webp’ye çevirip temizledin → hero alanı artık “text-only fallback” değil, görsel destekli native vitrin.

#### 1.4 Next/Image runtime crash fix (drawer “beyaz ekran” hatası)

* Ürün görseli `string` yerine `{src, alt}` object gelince Next/Image patlıyordu.
* Dal içinde: **image normalize** yapılıp `imgSrc/imgAlt` ayrıştırıldı → crash bitti. (Bu lock doc’ta yazmıyor; bu “implementation fix” olarak kayda geçti.)

#### 1.5 “Stokta olmayan ürünleri çekme” mini-fix

* Drawer fetch URL’ine `&inStock=1` eklendi → sheet sadece instock ürünleri getiriyor (kategori boşsa empty state).
  Bu hamle “Quick Look Sheet” fetch stratejisi bölümüne ek bir kural olarak işlenmeli (lock doc v1’de stok filtresi “badge” olarak geçiyor). 

#### 1.6 Lint quality gate temizliği (repo çapında)

* `scripts/` klasörü için ESLint override
* `intent-filter-chips.tsx` hooks rule fix
* `checkout/page.tsx` içindeki `any`’ler `unknown` + type-guard
  Bunlar hub işinden bağımsız ama “DoD: lint error = 0” kapısını açmak için yapıldı. Lock doc DoD zaten build+lint geçmesini ister. 

---

### 2) Alınan Kararlar (Design/Architecture Decisions)

#### 2.1 Template kararı (Route + sayfa şablonu) — **KİLİT**

* `/hub` = bento grid
* `/hub/[hubSlug]` = hero + stream
  Lock doc bunu “Non-negotiable” olarak kilitliyor. 

#### 2.2 Quick Look fetch stratejisi — **KİLİT**

* **Sadece sheet açılınca fetch** (open===true && category!=null)
* Skeleton → data
* 8 ürün limit
  N+1’i kıran ana hamle bu. 

#### 2.3 “Tümünü Gör” navigasyon formatı — **KİLİT**

* URL formatı: `/${parentSlug}?sub=${childWcId}`
  Bu contract kırılmayacak. 

#### 2.4 Empty category policy — **KİLİT**

* Boş kategori **asla** rail’de görünmez (policy hidden-if-empty).
  Lock doc bunu hem UI hem query katmanında kanıtlıyor. 

#### 2.5 Single drawer rule (cart + quick look çakışması) — **KİLİT**

* Vaul ile aynı anda tek drawer açık varsayımı.
  Bu kural “sepete ekle drawer” ile çakışma kaygını da çözüyor: Vaul davranışı gereği biri açılırken diğeri kapanır. 

#### 2.6 Guardrail intent kuralları — **KİLİT**

* Forbidden intent kombinasyonları + script ile doğrulama. 

#### 2.7 Hub Map config-first yaklaşımı — **MasterPack KİLİDİ (üst seviye)**

* Hub navigation’ın tek kaynağı `src/config/hub-map.ts` ve `npm run hub:verify` PASS zorunlu. 

---

### 3) Uygulanan İşlemler (Operasyonlar — “ne yaptık?” üst seviye)

> (Dosya bazlı tam envanteri Parça 2’de “tek tek path + amaç + değişiklik” olarak dökeceğim.)

* Hub rail + sheet bileşenleri oluşturuldu ve wrapper ile koordine edildi (state: `selectedCategory`, `sheetOpen`). 
* Quick Look Sheet: user-triggered fetch + skeleton/error/empty state + 8 ürün + “Tümünü Gör”. 
* Drawer rules + cart çakışma davranışı locklandı. 
* Hero image asset pipeline tanımlandı ve 5 hub için isim standardı sabitlendi. 

---

### 4) Kilitlediğimiz Yerler (MasterPack ile hizalı “non-negotiable” listesi)

MasterPack’in “evidence index” yaklaşımı: lock’lar değişirse doküman güncellenir. 

**Bu dalda kilit (değiştirilemez) kalanlar:**

1. Route template: `/hub` bento, `/hub/[hubSlug]` hero+stream 
2. Quick look fetch: sheet açılınca, 8 ürün limit, skeleton-first 
3. “Tümünü Gör” route contract: `/${parentSlug}?sub=${childWcId}` 
4. Empty category gizleme policy 
5. Single drawer rule (cart + quick look) 
6. Guardrail intent uyumu + script ile doğrulama 
7. Hub Map config-first + `hub:verify` zorunluluğu (MasterPack kilidi) 

---

### 5) Not: Lock Doc v1 ile “gerçek implementasyon” arasında görünen sapmalar (şimdiden işaretliyorum)

Bunları Parça 3’te “boşta kalanlar / yapılacaklar” kısmına resmen yazacağım ama burada **erken uyarı** olarak kayda geçiyorum:

* Lock doc v1 rail’i “story bubble” anlatıyor. 
  Ama dal içinde **chip/pill**’e geçildi (TR label realitesi). → Lock doc v2 revizyon ihtiyacı.
* Lock doc v1 hub detail şablonunda “Category Cards Grid” hâlâ var görünüyor. 
  Ama implementasyonda “kart grid kaldırıldı” kararı uygulanmıştı. → Lock doc + masterpack doc hizası güncellenmeli.

---

According to a document from **2026-01-16**, aşağıdaki **PARÇA 2/3** “masterpack hizalama” çıktısı; **kilitli kararlar + uygulanmış işler + dosya haritası + hangi Master Pack maddesine oturduğu** şeklinde düzenlendi. 

---

## PARÇA 2/3 — Kilitlenen kararlar + Uygulama haritası + Master Pack hizası

### 1) Kilitli kararlar (Lock v1’de “non-negotiable” olanlar)

Aşağıdakiler sistemin “dokunulmaz” çekirdeği olarak kilitlenmişti:

* **Route şablonu**

  * `/hub` = bento grid hub kartları
  * `/hub/[hubSlug]` = hero + stream (hub detay)

* **Quick Category Rail**

  * Story bubble pattern (min tap 64x64)
  * Boş kategoriler asla render edilmez
  * Tıklayınca bottom sheet açılır

* **Bottom Sheet Quick Look**

  * Fetch yalnızca sheet açılınca (user-triggered / lazy)
  * İlk anda skeleton
  * Limit 8 (sort newest)

* **“Tümünü Gör” navigasyonu**

  * Format: `/${parentSlug}?sub=${childWcId}`
  * URL üretimi: `buildHubCardHref(parentSlug, childWcId)`

* **DB / API kısıtları**

  * DB schema değişikliği yok
  * Yeni endpoint yok; mevcut `/api/products` kullanılır

* **Drawer kuralları**

  * Vaul kullanımı
  * Aynı anda **tek drawer açık** (quick look + cart çakışması Vaul davranışıyla çözülür)

* **Guardrail zorunluluğu**

  * Intent kuralları (male/female çatışmaları vb.)
  * `npm run guardrail:forbidden` ile doğrulama

* **Asset stratejisi**

  * Hero görselleri: `public/images/hub/hero/${hubSlug}.webp` isimlendirmesi

---

### 2) Lock v1 üstüne gelen “revizyonlar / hotfix” (dokümana işlenmesi gerekenler)

Bu sohbet dalında Lock v1’e göre **mantıksal hedef aynı kalıp** (native hızlı keşif + sheet) bazı noktalar “ürün gerçekliği” nedeniyle revize edildi:

* **Rail tasarımı: Story bubble → Chip/Pill**

  * Sebep: Türkçe etiketlerin uzunluğu (wrap/zigzag) ve okunabilirlik.
  * Davranış korunuyor: tıkla → sheet aç, yatay scroll devam.
  * *Dokümana etkisi:* Lock v1 “story bubbles” diye kilitli; bu artık **Lock v2 patch** gerektiriyor. (Aşağıdaki “kilitlenecek yeni kararlar” bölümüne ekledim.)

* **Next/Image runtime fix (product.images tipi)**

  * Drawer açılınca beyaz ekran / runtime hatası: `Image src`’e `{src, alt}` object gelmesi.
  * Çözüm: görseli normalize edip `src` string’e düşürmek (ve alt fallback).
  * *Dokümana etkisi:* API contract / frontend contract tarafına “images shape” notu eklenmeli.

* **“Tümünü Gör” drawer’ında stok dışı ürünler**

  * Çözüm: drawer fetch URL’ine `inStock=1` eklenmesi (API zaten destekliyordu).
  * *Dokümana etkisi:* Quick Look fetch contract’ına `inStock` paramı eklenmeli (Lock v2).

---

### 3) Uygulanan işlemler (hub deneyimini “native”e yaklaştıran set)

Lock dokümanının hedeflediği native hissi sağlayan ana uygulama seti:

* **User-triggered fetch + skeleton ilk frame** (sheet açılır açılmaz skeleton → sonra ürünler)
* **Limit=8 ürün** ve “Tümünü Gör” footer aksiyonu
* **Single drawer kuralı + cart çakışma davranışı**

> Not: Bu dalda ayrıca “label/initials/scroll affordance” gibi rail ergonomisi iyileştirmeleri de yapıldı; bunlar Lock v1’de detaylı değil, **UI polish** olarak Master Pack “native ux rules” tarafına not düşülmeli.

---

### 4) Değiştirilen / üretilen dosyalar (dosya haritası)

Lock dokümanında “touch” listesi şöyle kilitlenmiş:

**Route**

* `src/app/hub/page.tsx`
* `src/app/hub/[hubSlug]/page.tsx`
* `src/app/hub/[hubSlug]/loading.tsx`
* `src/app/hub/loading.tsx`

**Components**

* `src/components/hub/category-bubble-rail.tsx`
* `src/components/hub/hub-category-rail.tsx`
* `src/components/hub/category-quick-look-sheet.tsx`

**Config / Queries / API**

* `src/config/hub-ui.ts`
* `src/db/queries/catalog.ts`
* `src/app/api/products/route.ts` (mevcut endpoint, quick look burada)

**UI / Assets**

* `src/components/ui/drawer.tsx`
* `public/images/hub/hero/${hubSlug}.webp` (opsiyonelden “fiili kullanım”a geçti)

**Bu dalda ek olarak etkilenmiş alanlar (Lock v1 listesinde yok ama pratikte dokunan)**

* `src/app/globals.css` (scrollbar-hide vb.)
* bazı `scripts/*` dosyaları (eslint override / any -> unknown / hooks fix)

---

### 5) “Kilitlediğimiz yerler” (Master Pack ile hizalı şekilde dondurulması gerekenler)

Aşağıdakiler artık **sürdürme maliyeti** nedeniyle “stabil kontrat” gibi ele alınmalı:

* **Hub slug’ları değişmez** (URL kırılır) — Master Pack footgun olarak da geçiyor
* **Boş kategori politikası**: `policy: "hidden-if-empty"` + DB filtreleri (direct_publish vs rollup)
* **“Tümünü Gör” URL formatı**: `/${parentSlug}?sub=${childWcId}` (hem hub kartları hem sheet footer)
* **Fetch kuralı**: yalnız sheet open’da fetch (bandwidth & TTFB için kritik)
* **Single drawer kuralı** (Vaul davranışıyla)

---

### 6) Master Pack hizası (hangi DOC nereye oturuyor?)

Master Pack “Evidence Index” bize hangi dokümanın neyi yönettiğini söylüyor; hub işi özellikle şu başlıklara oturuyor:

* **Architecture lock / yasaklar** (yeni endpoint yok vb.)
* **Routes & navigation map** (route table, param formatları)
* **Native UX rules** (feedback, sheet, mobile-first)
* **Data fetching & cache rules** (user-triggered fetch, skeleton)
* **Frontend standards / DoD** (build/lint/QA)

Bu dalda yapılanlar, Lock v1’deki kanıt/komut setiyle de hizalı: `npm run build`, `npm run lint`, `npm run guardrail:forbidden`, `npm run category:lock`
(Sende build/lint akışı temiz; guardrail & category:lock ise “tam QA kapanışı” için finalde mutlaka koşturulmalı.)

---



### 3. Parça — Boşta kalanlar, “drift” (doküman ↔ kod farkı), risk/QA ve sıradaki adımlar

#### 3.1 Şu an “neredeyiz?”

**Hub Native Navigation akışı çalışıyor**: `/hub` index + `/hub/[hubSlug]` detail, üstte Hero, altında yatay “Quick Explore”, chip’e basınca Bottom Sheet açılıyor, içeride skeleton → ürünler geliyor, “Tümünü Gör” kategori sayfasına gidiyor. Bu akış lock dokümanının hedeflediği native “hızlı keşif + sheet preview” fikriyle uyumlu. 

#### 3.2 En kritik “drift”: Lock dokümanı Story Bubble diyor, kod artık Chip/Pill

Lock dokümanında Quick Category Rail açıkça **Story bubbles (64x64 min)** diye kilitlenmiş. 

Ama siz, Türkçe uzun etiketler yüzünden **chip/pill’e pivot** yaptınız (doğru pivot). Bu yüzden:

* Lock dokümanı **v1 şu an gerçeği tam yansıtmıyor** (özellikle “Quick Category Rail” bölümü).
* “Non-negotiables” kısmında geçen **min tap size 64x64** artık “chip height + padding” olarak yeniden tanımlanmalı.
* Smoke test adımları “bubbles” kelimesiyle geçiyor; bunlar “chips” diye güncellenmeli. 

✅ Bu drift’i düzeltmeden “kilitledik, bitti” demek doküman-kod uyumsuzluğu yaratır.

#### 3.3 İkinci drift: Hero image “optional / sadece 1 tane var” yazıyor, siz 5’ini de koydunuz

Lock dokümanı “erkek-ve-performans.webp mevcut, diğerleri optional” demiş. 

Sen ise **5 hub görselini** `public/images/hub/hero/${hubSlug}.webp` olarak hazırlayıp koyduğunu söyledin. Bu harika; dokümanda “Current Status” satırları güncellenmeli. (Ayrıca naming convention zaten doğru.) 

#### 3.4 Üçüncü drift: Drawer artık “inStock=1” ile geliyor (dokümanda yok)

Lock dokümanı ürün listesinde “stok badge göster” gibi bir senaryodan bahsediyor. 

Ama sen **drawer’dan out-of-stock’u filtreledin** (`inStock=1`). Bu davranış artık **kilitli karar** mı yoksa “şimdilik UX tercihi” mi, dokümana yazılmalı.

* Eğer “native hızlı keşif” hedefi = *anında satın alınabilir ürün göster* ise → **kilitlemek mantıklı**.
* Eğer “koleksiyon keşfi” = stokta yok olsa bile vitrinlemek istiyoruz ise → drawer’da değil ama “Tümünü Gör” sayfasında gösterebiliriz.

#### 3.5 “Kategori kart grid” konusu: kaldı mı, kalktı mı? (şu an belirsiz)

Lock dokümanı Phase 2’de “kategori cards grid” var diyor. 

Ama senin ekranlarda ve anlattığında “tek ekran vitrin / aşağı sürüklemiyoruz” yaklaşımı öne çıktı. Bu, Hub UI Polish dokümanındaki “grid/bento” önerisiyle potansiyel bir çelişki yaratabilir (grid önerisi orada var). 

Burada karar netleşmeli:

* **Seçenek A (Native, hızlı):** Grid’i kaldır → primary navigation = chip + sheet + CTA (senin istediğin “tek ekran”).
* **Seçenek B (Hybrid):** Üste chip+sheet, altına “Tüm kategoriler” mini grid (fold altı), böylece hem keşif hem SEO/derin gezinme.

Bunu dokümana “locked” veya “deferred decision” olarak yazmadan ilerlemek ileride sürpriz çıkarır.

---

## 3.6 QA / Native standartları karşılıyor muyuz?

**Çekirdek hedefleri karşılıyor**:

* Lazy load (sheet açılınca fetch) ve skeleton pattern lock’a uygun. 
* “Tek drawer açık” kuralı Vaul ile uyumlu. 
* Performans stratejisi (N+1 kaçınma + lazy) dokümanda var ve yaklaşım doğru. 
* DoD/Smoke test mantığı doğru set edilmiş. 

**Ama Masterpack DoD tarafında** (kalite kapıları) “lint/build/manuel test” net checklist var. 

* `npm run build` ✅
* `npm run lint` sende **0 error ama çok warning**. ESLint genelde warning ile fail etmez; ama “tam temiz repo” hedefliyorsak bu **backlog**. (Hub işini bloklamaz ama release öncesi temizlenmesi iyi olur.)
* Ayrıca lock dokümanında QA komutları arasında guardrail ve category lock var; bunları **bu sprintte** en az 1 kez koşturmak “native + güvenlik” tarafını tamamlar. 

---

## 3.7 Boşta kalan yerler (öncelik sırasıyla)

### P0 — Doküman-kod senkronu (bunu yapmadan “kilit” tam kilit sayılmaz)

1. Lock dokümanını **v2** yap:

* “Story bubbles” → **Chip/Pill rail** (boyut, truncation/ellipsis, a11y aria-label).
* “Hero images current status” → 5/5 mevcut.
* “Quick look fetch” → `inStock=1` davranışı (kilit mi, opsiyon mu? karar yaz).
* Smoke test metinlerini “bubbles” yerine “chips” yap.
  (Referans bölümler: Non-negotiables, DoD & QA, Asset Strategy.) 

### P1 — Tasarım/UX kararı (ileride geri dönüp kırmayalım)

2. Hub detail’de **grid tamamen kalktı mı**? (A mı B mi) → bunu netleştir.
3. “Tümünü Gör” sayfası stok dışını gösterecek mi? Drawer filtresi ayrı, PLP ayrı olabilir.

### P2 — Kalite ve polish

4. Guardrail + category lock komutları bir kez çalıştırılıp sonuçlarının not edilmesi. 
5. Lint warning temizliği (en azından scripts klasörü stratejisi net: ignore mu, override mı). Masterpack DoD “lint hatasız” diye çerçeve koyuyor. 

---

## 3.8 Risk & rollback tarafı

Lock dokümanındaki risk/rollback planı yeterli: performans (N+1), UX (fetch yavaşsa), data consistency (boş kategori) ve rollback adımları yazıyor. 

Yeni ek risk (dokümana eklenebilir):

* “Chip label ellipsis” yüzünden kullanıcı bazı kategorileri ayırt edemeyebilir → çözüm: aria-label var + sheet title’da tam isim göster (muhtemelen var) + gerekirse “long press tooltip” (opsiyonel).

---

### Bu parçanın çıktısı (kısa hüküm)

* **Amaç** (native hızlı hub keşfi) = ✅ büyük ölçüde oldu.
* **Native standartları** = ✅ davranış olarak evet; dokümantasyon ve birkaç kalite kapısı tarafında **P0/P1** işleri var.
* **En acil iş** = lock dokümanını **gerçeğe güncellemek (v2)**: story bubble → chip, hero status, inStock kararı, smoke test metinleri.

tamam
### 3. Parça — Boşta kalanlar, “drift” (doküman ↔ kod farkı), risk/QA ve sıradaki adımlar

#### 3.1 Şu an “neredeyiz?”

**Hub Native Navigation akışı çalışıyor**: `/hub` index + `/hub/[hubSlug]` detail, üstte Hero, altında yatay “Quick Explore”, chip’e basınca Bottom Sheet açılıyor, içeride skeleton → ürünler geliyor, “Tümünü Gör” kategori sayfasına gidiyor. Bu akış lock dokümanının hedeflediği native “hızlı keşif + sheet preview” fikriyle uyumlu. 

#### 3.2 En kritik “drift”: Lock dokümanı Story Bubble diyor, kod artık Chip/Pill

Lock dokümanında Quick Category Rail açıkça **Story bubbles (64x64 min)** diye kilitlenmiş. 

Ama siz, Türkçe uzun etiketler yüzünden **chip/pill’e pivot** yaptınız (doğru pivot). Bu yüzden:

* Lock dokümanı **v1 şu an gerçeği tam yansıtmıyor** (özellikle “Quick Category Rail” bölümü).
* “Non-negotiables” kısmında geçen **min tap size 64x64** artık “chip height + padding” olarak yeniden tanımlanmalı.
* Smoke test adımları “bubbles” kelimesiyle geçiyor; bunlar “chips” diye güncellenmeli. 

✅ Bu drift’i düzeltmeden “kilitledik, bitti” demek doküman-kod uyumsuzluğu yaratır.

#### 3.3 İkinci drift: Hero image “optional / sadece 1 tane var” yazıyor, siz 5’ini de koydunuz

Lock dokümanı “erkek-ve-performans.webp mevcut, diğerleri optional” demiş. 

Sen ise **5 hub görselini** `public/images/hub/hero/${hubSlug}.webp` olarak hazırlayıp koyduğunu söyledin. Bu harika; dokümanda “Current Status” satırları güncellenmeli. (Ayrıca naming convention zaten doğru.) 

#### 3.4 Üçüncü drift: Drawer artık “inStock=1” ile geliyor (dokümanda yok)

Lock dokümanı ürün listesinde “stok badge göster” gibi bir senaryodan bahsediyor. 

Ama sen **drawer’dan out-of-stock’u filtreledin** (`inStock=1`). Bu davranış artık **kilitli karar** mı yoksa “şimdilik UX tercihi” mi, dokümana yazılmalı.

* Eğer “native hızlı keşif” hedefi = *anında satın alınabilir ürün göster* ise → **kilitlemek mantıklı**.
* Eğer “koleksiyon keşfi” = stokta yok olsa bile vitrinlemek istiyoruz ise → drawer’da değil ama “Tümünü Gör” sayfasında gösterebiliriz.

#### 3.5 “Kategori kart grid” konusu: kaldı mı, kalktı mı? (şu an belirsiz)

Lock dokümanı Phase 2’de “kategori cards grid” var diyor. 

Ama senin ekranlarda ve anlattığında “tek ekran vitrin / aşağı sürüklemiyoruz” yaklaşımı öne çıktı. Bu, Hub UI Polish dokümanındaki “grid/bento” önerisiyle potansiyel bir çelişki yaratabilir (grid önerisi orada var). 

Burada karar netleşmeli:

* **Seçenek A (Native, hızlı):** Grid’i kaldır → primary navigation = chip + sheet + CTA (senin istediğin “tek ekran”).
* **Seçenek B (Hybrid):** Üste chip+sheet, altına “Tüm kategoriler” mini grid (fold altı), böylece hem keşif hem SEO/derin gezinme.

Bunu dokümana “locked” veya “deferred decision” olarak yazmadan ilerlemek ileride sürpriz çıkarır.

---

## 3.6 QA / Native standartları karşılıyor muyuz?

**Çekirdek hedefleri karşılıyor**:

* Lazy load (sheet açılınca fetch) ve skeleton pattern lock’a uygun. 
* “Tek drawer açık” kuralı Vaul ile uyumlu. 
* Performans stratejisi (N+1 kaçınma + lazy) dokümanda var ve yaklaşım doğru. 
* DoD/Smoke test mantığı doğru set edilmiş. 

**Ama Masterpack DoD tarafında** (kalite kapıları) “lint/build/manuel test” net checklist var. 

* `npm run build` ✅
* `npm run lint` sende **0 error ama çok warning**. ESLint genelde warning ile fail etmez; ama “tam temiz repo” hedefliyorsak bu **backlog**. (Hub işini bloklamaz ama release öncesi temizlenmesi iyi olur.)
* Ayrıca lock dokümanında QA komutları arasında guardrail ve category lock var; bunları **bu sprintte** en az 1 kez koşturmak “native + güvenlik” tarafını tamamlar. 

---

## 3.7 Boşta kalan yerler (öncelik sırasıyla)

### P0 — Doküman-kod senkronu (bunu yapmadan “kilit” tam kilit sayılmaz)

1. Lock dokümanını **v2** yap:

* “Story bubbles” → **Chip/Pill rail** (boyut, truncation/ellipsis, a11y aria-label).
* “Hero images current status” → 5/5 mevcut.
* “Quick look fetch” → `inStock=1` davranışı (kilit mi, opsiyon mu? karar yaz).
* Smoke test metinlerini “bubbles” yerine “chips” yap.
  (Referans bölümler: Non-negotiables, DoD & QA, Asset Strategy.) 

### P1 — Tasarım/UX kararı (ileride geri dönüp kırmayalım)

2. Hub detail’de **grid tamamen kalktı mı**? (A mı B mi) → bunu netleştir.
3. “Tümünü Gör” sayfası stok dışını gösterecek mi? Drawer filtresi ayrı, PLP ayrı olabilir.

### P2 — Kalite ve polish

4. Guardrail + category lock komutları bir kez çalıştırılıp sonuçlarının not edilmesi. 
5. Lint warning temizliği (en azından scripts klasörü stratejisi net: ignore mu, override mı). Masterpack DoD “lint hatasız” diye çerçeve koyuyor. 

---

## 3.8 Risk & rollback tarafı

Lock dokümanındaki risk/rollback planı yeterli: performans (N+1), UX (fetch yavaşsa), data consistency (boş kategori) ve rollback adımları yazıyor. 

Yeni ek risk (dokümana eklenebilir):

* “Chip label ellipsis” yüzünden kullanıcı bazı kategorileri ayırt edemeyebilir → çözüm: aria-label var + sheet title’da tam isim göster (muhtemelen var) + gerekirse “long press tooltip” (opsiyonel).

---

### Bu parçanın çıktısı (kısa hüküm)

* **Amaç** (native hızlı hub keşfi) = ✅ büyük ölçüde oldu.
* **Native standartları** = ✅ davranış olarak evet; dokümantasyon ve birkaç kalite kapısı tarafında **P0/P1** işleri var.
* **En acil iş** = lock dokümanını **gerçeğe güncellemek (v2)**: story bubble → chip, hero status, inStock kararı, smoke test metinleri.

tamam
