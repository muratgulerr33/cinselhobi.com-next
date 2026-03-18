# Cinselhobi Next (Frontend)

## Nasıl çalıştırırım?

- **Local DB doğrula:** `npm run db:check` — Container'dan bağlantı bilgisini alır, `.env.local` içine `DATABASE_URL` yazar, `psql` ile test eder.
- **psql aç:** `npm run db:psql` — Önce `source scripts/dev/load_env.sh` ile env yükleyip ardından `psql "$DATABASE_URL"` açar.
- **SEO export:** `npm run export:seo:v1` — Katalog + kategori istatistiği export eder.
- **Çıktı klasörü:** `seo_exports/nextjs/v1/` (category-stats.json, category-columns.json, katalog dosyaları).

## Production deploy (current truth)

Current prod deploy script: `scripts/deploy-prod.sh`

Sunucuda önerilen çalıştırma komutu:

```bash
cd /var/www/cinselhobi/app
./scripts/deploy-prod.sh
```

Dry-run ile güvenli ön kontrol:

```bash
cd /var/www/cinselhobi/app
./scripts/deploy-prod.sh --dry-run
```

Bu script current prod truth ile uyumludur ve şu sabitleri kullanır:

- **Provider / model:** Hetzner self-hosted Linux VPS
- **App path:** `/var/www/cinselhobi/app`
- **PM2 process:** `cinselhobi-next`
- **Branch:** `main`
- **Port:** `3000`
- **Canonical domain:** `https://www.cinselhobi.com`

Script ne yapar:

1. Çalıştırılabilir komutları (`git`, `npm`, `pm2`, opsiyonel olarak `curl`) doğrular.
2. `package.json`, git working tree ve aktif branch'in `main` olduğunu doğrular.
3. Dirty working tree varsa deploy'u durdurur (gerekirse `--allow-dirty` ile bilinçli override edilebilir).
4. `git status -sb` ve `git rev-parse HEAD` ile mevcut durumu loglar.
5. `git pull origin main` çalıştırır.
6. `npm ci` çalıştırır.
7. `npm run build` çalıştırır.
8. **Sadece build başarılıysa** `pm2 restart cinselhobi-next` çalıştırır.
9. `pm2 list` ve `pm2 logs cinselhobi-next --lines 200 --nostream` ile kontrollü doğrulama yapar.
10. `curl` ile `http://127.0.0.1:3000/` ve `https://www.cinselhobi.com/` için HTTP smoke check dener.

**Kritik güvenlik davranışı:** `npm run build` fail verirse script `pm2 restart` çalıştırmaz, net hata mesajı verir ve non-zero exit ile deploy'u başarısız bitirir.

Notlar:

- Script sonsuz log tail yapmaz; `pm2 logs ... --nostream` kullanır.
- Script current prod truth dışındaki legacy provider / eski import akışı / Woo bootstrap bilgilerini deploy akışına taşımaz.
- README ve operasyon anlatımı current truth olarak Hetzner + `/var/www/cinselhobi/app` + `cinselhobi-next` + `main` üzerinden okunmalıdır.

## Gereksinimler

- Node.js
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

**Historical note:** İlk veri bootstrap aşamasında eski bir tek seferlik import yolu kullanıldı. Current sistemin aktif setup, deploy veya runtime bağımlılığı bu akışa bağlı değildir.

## Canonical domain (www) ve Sitemap / Robots

**Canonical politika:** Tek domain kullanılır; tüm trafik `https://www.cinselhobi.com` üzerinden sunulur. Production’da `cinselhobi.com` (www olmadan) veya diğer host’lara gelen istekler 308 ile `https://www.cinselhobi.com` aynı path/query’e yönlendirilir (middleware). Localhost / 127.0.0.1 yönlendirilmez.

**2026-03-15 prod reality note:** Current public/canonical prod URL `https://www.cinselhobi.com` olarak kullanılmalıdır. Current prod altyapısı Hetzner üzerinde çalışan self-hosted Linux VPS'tir; app directory `/var/www/cinselhobi/app`, PM2 process `cinselhobi-next`, app port `3000` olarak doğrulanmıştır. Current git remote `github-cinselhobi:muratgulerr33/cinselhobi.com-next.git`; `github-cinselhobi` alias ve doğru deploy key ile `git pull origin main` çalışmaktadır. Observed PM2 runtime env on 2026-03-15 still showed non-www `AUTH_URL`/`NEXTAUTH_URL`; docs standard canonical should be www.

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
- Deploy/ops runbook current prod için `docs/04-deploy-prod-pm2.md` içindeki Hetzner self-hosted VPS, `/var/www/cinselhobi/app`, `cinselhobi-next`, `PORT=3000` ve çalışan `github-cinselhobi` alias gerçekleriyle okunmalıdır.

## GA4 doğrulama (production)

Deploy sonrası kontrol:

- **Tag Assistant:** Tarayıcıda [Tag Assistant](https://tagassistant.google.com/) veya Chrome uzantısı ile sitede ölçüm kimliği (Measurement ID) görünüyor mu kontrol edin.
- **GA4 Realtime:** GA4 mülkünde **Reports → Realtime** açın; canlı sitede gezinirken kullanıcı/trafik görünüyor mu kontrol edin.

## Notlar

- Veritabanı verileri Docker volume'unda (`pgdata`) saklanır. Container silinse bile veriler korunur.
- Drizzle ORM kullanılmaktadır. Prisma kullanılmamaktadır.
- TypeScript için `pg` modülü tipleri `@types/pg` devDependency olarak eklenmiştir.
- Snapshot dosyaları `data/snapshots/` klasöründe saklanır ve `.gitignore`'a eklenmiştir (büyük olabilir ve gizli veri içerebilir).
