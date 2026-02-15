# Cinselhobi Next (Frontend)

## Nasıl çalıştırırım?

- **Local DB doğrula:** `npm run db:check` — Container'dan bağlantı bilgisini alır, `.env.local` içine `DATABASE_URL` yazar, `psql` ile test eder.
- **psql aç:** `npm run db:psql` — Önce `source scripts/dev/load_env.sh` ile env yükleyip ardından `psql "$DATABASE_URL"` açar.
- **SEO export:** `npm run export:seo:v1` — Katalog + kategori istatistiği export eder.
- **Çıktı klasörü:** `seo_exports/nextjs/v1/` (category-stats.json, category-columns.json, katalog dosyaları).

## Gereksinimler

- Node.js LTS (18 veya üzeri)
- Docker ve Docker Compose
- npm veya yarn

## Local Kurulum

### 1. Next.js Projesi Oluşturma

Eğer proje dizininde Next.js projesi yoksa, aşağıdaki komutu çalıştırın:

```bash
npm create next-app@latest . -- --ts --app --eslint --tailwind --src-dir
```

Not: Bu komut mevcut dizinde Next.js projesini oluşturur. Eğer proje zaten mevcutsa bu adımı atlayabilirsiniz.

### 2. PostgreSQL Veritabanını Başlatma

Docker Compose ile PostgreSQL container'ını başlatın:

```bash
docker compose up -d
```

Container'ın çalıştığını kontrol etmek için:

```bash
docker compose ps
```

### 3. Bağımlılıkları Kurma

```bash
npm install
```

### 4. Adım 2: Drizzle ORM Kurulumu ve Migration

Drizzle ORM ve PostgreSQL bağlantısını kurmak için:

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit dotenv tsx
npm run db:generate
npm run db:migrate
```

**Not:** `DATABASE_URL` değişkeninin `.env.local` (veya `.env`) dosyasında tanımlı olduğundan emin olun.

### 5. Development Server'ı Başlatma

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

## ENV Kurulumu

Ortam değişkenlerini yapılandırmak için:

1. Proje kök dizininde `.env.local` dosyası oluşturun (veya `.env` dosyası kullanabilirsiniz):

```bash
touch .env.local
```

2. `.env.local` dosyasını düzenleyip gerçek değerleri girin:
   - `DATABASE_URL`: Veritabanı bağlantı string'i (zorunlu - Drizzle migrate için gereklidir)
     - Örnek format: `postgresql://kullanici:sifre@localhost:5432/veritabani_adi`
     - Docker Compose ile çalışıyorsanız: `postgresql://postgres:postgres@localhost:5432/cinselhobi`
   - `WOO_BASE_URL`: WooCommerce sitenizin URL'i
   - `WOO_CONSUMER_KEY`: WooCommerce Consumer Key
   - `WOO_CONSUMER_SECRET`: WooCommerce Consumer Secret
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`: (isteğe bağlı) GA4 ölçüm kimliği, örn. `G-3JQ79MBRNB`. Sadece production build'de kullanılır; local/dev'de GA yüklenmez.

**Not:** `npm run db:migrate` komutunu çalıştırmadan önce `DATABASE_URL` değişkeninin `.env.local` veya `.env` dosyasında tanımlı olduğundan emin olun.

### Katalog export (SEO /seo repo için)

`.env.local` içinde `DATABASE_URL` tanımlı olmalı. Çalıştırma: `npm run export:catalog`. Çıktılar `seo_exports/nextjs/v1/` altında (JSONL, manifest, counts, schema-map, relations, assets, errors).

## Sorun Giderme

### PostgreSQL Portu (5432) Doluysa

Eğer 5432 portu zaten kullanılıyorsa:

1. Çalışan container'ı durdurun:
```bash
docker compose down
```

2. Veya `docker-compose.yml` dosyasında portu değiştirin (örn: `5433:5432`)

3. `.env.local` dosyasındaki `DATABASE_URL`'i de buna göre güncelleyin

### Container Başlamıyorsa

Container loglarını kontrol edin:

```bash
docker compose logs postgres
```

## WooCommerce Import

### WooCommerce API Key Oluşturma

WooCommerce REST API key'lerini oluşturmak için:

1. WordPress admin paneline giriş yapın
2. **WooCommerce** → **Settings** → **Advanced** → **REST API** bölümüne gidin
3. **Add key** butonuna tıklayın
4. Key için bir açıklama girin (örn: "Import Script")
5. **Read** yetkisini seçin
6. **Generate API key** butonuna tıklayın
7. Oluşturulan **Consumer Key** ve **Consumer Secret** değerlerini kopyalayın

### Import İşlemi

WooCommerce verilerini çekmek ve veritabanına aktarmak için:

1. `.env.local` dosyasına aşağıdaki değerleri ekleyin (DATABASE_URL zaten mevcut olmalı):

```env
WOO_BASE_URL="https://cinselhobi.com"
WOO_CONSUMER_KEY="ck_..."
WOO_CONSUMER_SECRET="cs_..."
```

2. Docker container'ını başlatın (eğer çalışmıyorsa):

```bash
docker compose up -d
```

3. Import script'ini çalıştırın:

**Full Import (tüm ürünler - varsayılan):**
```bash
npm run woo:import
```

veya açıkça belirtmek için:
```bash
WOO_IMPORT_MODE=full npm run woo:import
```

**Sample Import (sadece ilk N ürün - geliştirme/test için):**
```bash
WOO_IMPORT_MODE=sample WOO_IMPORT_LIMIT=20 npm run woo:import
```

Script şunları yapacaktır:
- WooCommerce API'den kategorileri ve ürünleri çeker
- `data/snapshots/<mode>/` klasörüne JSON snapshot'ları kaydeder (`full` veya `sample`)
- Veritabanına idempotent şekilde yazar (upsert)

**Notlar:**
- Varsayılan olarak sadece yayında olan ürünler (`status=publish`) import edilir. Tüm ürünleri (draft, pending, private vb.) import etmek için `.env.local` dosyasına `WOO_PRODUCT_STATUS=any` ekleyebilirsiniz.
- Sample mod geliştirme ve test için kullanılır. Canlı WooCommerce'e dokunmadan küçük bir veri seti ile çalışmanızı sağlar.
- Kategoriler her zaman tam olarak çekilir (az sayıda oldukları için).
- `woo:import` scripti ortam değişkenlerini önce `.env.local`, sonra `.env` dosyasından okur.
- Eğer 401 (Unauthorized) hatası alırsanız, `.env.local` dosyasına `WOO_AUTH_MODE=query` ekleyip tekrar deneyin. Bu durumda authentication query parametreleri ile yapılır (Basic Auth header yerine).

### Import Sonrası Kontrol

Import işlemi tamamlandıktan sonra veritabanındaki kayıt sayılarını kontrol edebilirsiniz:

```bash
# Ürün sayısı
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) from products;"

# Kategori sayısı
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) from categories;"
```

## Canonical domain (www) ve Sitemap / Robots

**Canonical politika:** Tek domain kullanılır; tüm trafik `https://www.cinselhobi.com` üzerinden sunulur. Production’da `cinselhobi.com` (www olmadan) veya diğer host’lara gelen istekler 308 ile `https://www.cinselhobi.com` aynı path/query’e yönlendirilir (middleware). Localhost / 127.0.0.1 yönlendirilmez.

- **Canonical base:** `src/lib/seo/canonical.ts` → `getCanonicalBaseUrl()`. Öncelik: `SITE_URL` (prod’da `https://www.cinselhobi.com` olmalı), yoksa aynı değer sabit. Host her zaman `www.cinselhobi.com` olacak şekilde normalize edilir.
- **Sitemap:** `/sitemap.xml` — Ana sayfa, `/urun/[slug]`, `/[slug]` (kategori); canonical base ile absolute URL’ler; revalidate 3600s.
- **Robots:** `/robots.txt` — Allow `/`, Disallow `/admin/`, `/api/`, `/dashboard/`, `/_next/`, `/account/`; `sitemap` canonical base ile.
- **Search Console:** Sitemaps bölümüne `https://www.cinselhobi.com/sitemap.xml` ekleyin.

**[LOCAL] Doğrulama:**

- `npm run dev` → tarayıcıda `http://localhost:3000/sitemap.xml` ve `http://localhost:3000/robots.txt` açın.
- İsteğe bağlı: `npm run build && npm run start` ile prod benzeri ortamda tekrar kontrol.

**[PROD] Doğrulama:**

- `curl -I https://cinselhobi.com/urun/...` → `308` ve `Location: https://www.cinselhobi.com/urun/...` beklenir.
- `curl -I https://www.cinselhobi.com/sitemap.xml` → `200` beklenir.

## GA4 doğrulama (production)

Deploy sonrası kontrol:

- **Tag Assistant:** Tarayıcıda [Tag Assistant](https://tagassistant.google.com/) veya Chrome uzantısı ile sitede ölçüm kimliği (Measurement ID) görünüyor mu kontrol edin.
- **GA4 Realtime:** GA4 mülkünde **Reports → Realtime** açın; canlı sitede gezinirken kullanıcı/trafik görünüyor mu kontrol edin.

## Notlar

- Veritabanı verileri Docker volume'unda (`pgdata`) saklanır. Container silinse bile veriler korunur.
- Drizzle ORM kullanılmaktadır. Prisma kullanılmamaktadır.
- TypeScript için `pg` modülü tipleri `@types/pg` devDependency olarak eklenmiştir.
- Snapshot dosyaları `data/snapshots/` klasöründe saklanır ve `.gitignore`'a eklenmiştir (büyük olabilir ve gizli veri içerebilir).

