# Cinselhobi.com Next — Frontend Proje Dokümanı (v1)

> Tarih: 2025-12-26  
> Repo: cinselhobi.com-next  
> Hedef: WooCommerce (WordPress) tabanlı mevcut site verilerini **tek seferlik** çekip, yeni bir **Next.js (App Router) + React + Tailwind** arayüz ile Kamatera VPS üzerinde yayınlamak.

---

## 1) Proje Özeti

Bu projede:
- Mevcut WooCommerce sitenden **kategoriler ve ürünler** okunur (REST API).
- Veriler lokal ortamda **PostgreSQL** içine import edilir.
- Yeni arayüz Next.js ile bu DB’den okur.
- Yayın tarafı Kamatera VPS’te, klasik “git pull → build → PM2” akışıyla yönetilir.

---

## 2) Kesin Kurallar

- Sunucu: **Kamatera (Linux VPS / self-hosted)**  
- Deploy: **GitHub** → sunucuda `git pull` → `npm ci` → `npm run build` → **PM2** ile çalıştır
- Veritabanı: **PostgreSQL**
- ORM: **Prisma yok**. **Drizzle ORM + pg** var.
- UI yaklaşımı: “Web sitesi” gibi değil, **native mobile app hissi** (dokunsal, akıcı, sade).

---

## 3) Hedef Dışı (Şimdilik Yapmıyoruz)

- [ ] Prisma kullanımı
- [ ] VPS dışı yönetilen platform kullanımı
- [ ] “Her şeyi bir anda” özellik ekleme (önce iskelet + veri + temel UI)

---

## 4) Teknoloji Stack

- Next.js (App Router) + TypeScript
- React 19+
- Tailwind CSS
- PostgreSQL 16 (local: Docker)
- Drizzle ORM + pg
- tsx (script çalıştırma)
- PM2 (prod process manager)

---

## 5) Repo Yapısı (Mevcut)

```
/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── db/                  # DB katmanı
│       ├── schema.ts        # Drizzle schema
│       └── connection.ts    # pg Pool + drizzle db export
├── scripts/
│   └── woo-import.ts        # Woo → snapshot → Postgres import
├── drizzle/                 # Drizzle migration çıktıları (SQL + meta)
├── docs/
│   ├── 01-frontend-project-doc-v1.md
│   ├── 02-db-drizzle-setup.md
│   ├── 03-woo-import-guide.md
│   └── 04-deploy-kamatera-pm2.md
├── public/
├── docker-compose.yml       # Local Postgres
├── drizzle.config.ts
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
└── tsconfig.json
```

---

## 6) Planlanan Yapı (Sonraki Adımlar)

```
src/
├── components/              # UI bileşenleri (planlanan)
│   ├── ui/
│   └── features/
├── lib/                     # yardımcılar (planlanan)
└── app/                     # sayfalar büyüyecek
data/
└── snapshots/               # Woo snapshot (gitignore)
```

---

## 7) Ortam Değişkenleri (ENV)

`.env.example` (template) şu alanları içerir:

```env
# Database
DATABASE_URL=postgres://cinselhobi:cinselhobi@localhost:5432/cinselhobi

# WooCommerce REST API
WOO_BASE_URL=https://example.com
WOO_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WOO_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Önemli:**
- `.env.local` dosyasında **DATABASE_URL zorunlu** (Drizzle migrate + import script için).
- `scripts/woo-import.ts` ve `src/db/connection.ts` **.env.local → .env** sırasıyla okur.
- `.env` ve `.env.local` git’e girmez (gitignore).

---

## 8) Local Kurulum (Mac)

### Gereksinimler
- Node.js **güncel LTS**
- Docker Desktop
- Git

### Kurulum
```bash
cd /Users/apple/dev/cinselhobi.com-next
npm ci
```

### Local Postgres (Docker)
```bash
docker compose up -d
docker compose ps
docker logs cinselhobi_db --tail 50
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi
```

### Dev
```bash
npm run dev
# http://localhost:3000
```

### Build (Prod test)
```bash
npm run build
```

---

## 9) Drizzle — DB Komutları

```bash
npm run db:generate
npm run db:migrate
```

---

## 10) Woo Import (Özet)

Import script:
- Kategorileri ve ürünleri Woo REST API’den çeker.
- Snapshot’ları kaydeder (gitignore).
- Postgres’e upsert eder.

Kullanım örnekleri:

```bash
# Sample: ilk 20 ürün
WOO_AUTH_MODE=query WOO_IMPORT_MODE=sample WOO_IMPORT_LIMIT=20 npm run woo:import

# Full: tüm ürünler
WOO_AUTH_MODE=query WOO_IMPORT_MODE=full npm run woo:import
```

Notlar:
- `WOO_AUTH_MODE` default `basic` ama 401 gelirse `query` kullan.
- Ürünler default `status=publish` çekilir.

---

## 11) Doğrulama Komutları

```bash
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) as categories from categories;"
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) as products from products;"
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) as links from product_categories;"
```

---

## 12) Sık Hatalar ve Çözümler

### A) `tsx must be loaded with --import instead of --loader`
Node 20+ için doğru kullanım:
- `node --import tsx ...`

### B) `DATABASE_URL is missing`
`.env.local` içinde DATABASE_URL tanımla.

### C) Woo 401 Unauthorized
- Key/secret doğru mu? Yetki “Read” mi?
- `WOO_BASE_URL` canonical mı? (`https://cinselhobi.com`)
- Çözüm: `WOO_AUTH_MODE=query`

---

## 13) Adım Adım İş Sırası

- Adım 1: Proje iskeleti + local postgres
- Adım 2: Drizzle schema + migrations + build fix
- Adım 3: Woo import (sample/full) + snapshot + DB doğrulama
- Adım 4: UI sayfalar (kategori/ürün liste + detay) + native hissiyat
- Adım 5: Kamatera deploy + PM2 + (opsiyonel) reverse proxy

---

## 14) Kısa Sözlük

- **Woo**: WooCommerce
- **Snapshot**: Woo’dan çekilen ham JSON dosyaları
- **Upsert**: Varsa güncelle, yoksa ekle
- **Idempotent**: Script’i tekrar çalıştırınca kopya üretmemesi
