# Frontend Proje Dokümantasyonu v1

## 1) Proje Özeti

Bu proje, WooCommerce tabanlı bir e-ticaret sitesinin modern bir Next.js uygulamasına dönüştürülmesi için hazırlanmıştır. Mobil öncelikli, native app hissi veren bir kullanıcı deneyimi hedeflenmektedir. Proje, self-hosted VPS (Kamatera) üzerinde çalışacak şekilde tasarlanmıştır ve adım adım ilerleme prensibiyle geliştirilecektir.

## 2) Hedefler ve Hedef Dışı

### Hedefler
- [ ] WooCommerce verilerinin PostgreSQL'e güvenli şekilde taşınması
- [ ] Next.js App Router ile modern, performanslı bir frontend oluşturulması
- [ ] Mobil öncelikli, native app hissi veren kullanıcı arayüzü
- [ ] Self-hosted VPS üzerinde stabil çalışan production ortamı
- [ ] Drizzle ORM ile tip-güvenli veritabanı işlemleri
- [ ] Adım adım, test edilmiş geliştirme süreci

### Hedef Dışı
- [ ] Prisma ORM kullanımı (Drizzle tercih ediliyor)
- [ ] Serverless veya cloud platform entegrasyonu
- [ ] Desktop öncelikli tasarım
- [ ] WooCommerce'in direkt kullanımı (sadece veri taşıma)
- [ ] Hızlı prototipleme veya MVP'den önce özellik ekleme

## 3) Kesin Kurallar

- **Deploy**: GitHub repository'den sunucuda `git pull` → `npm ci` → `npm run build` → PM2 ile başlatma
- **Veritabanı**: PostgreSQL (local: Docker Compose, production: sunucuda servis olarak)
- **ORM**: Prisma YASAK. Drizzle ORM + pg (node-postgres) kullanılacak
- **Frontend**: Next.js App Router + React 19+ + Tailwind CSS
- **UI/UX**: Native mobile app hissi (mobil öncelikli, dokunsal, akıcı)
- **Çalışma Şekli**: Her adım "Tamamdır" ile kapanmadan sonraki adıma geçilmez

## 4) Teknik Yığın (Stack) ve Nedenleri

- **Next.js App Router**: Modern routing, server components, performans
- **React 19+**: En güncel React özellikleri ve optimizasyonlar
- **Tailwind CSS**: Hızlı, tutarlı stil geliştirme
- **Drizzle ORM**: Tip-güvenli, hafif, Prisma alternatifi
- **PostgreSQL**: Güçlü, ilişkisel veri yapısı
- **PM2**: Process yönetimi, otomatik restart, log yönetimi
- **Nginx**: Reverse proxy, statik dosya servisi
- **Docker Compose**: Local PostgreSQL ortamı için kolay kurulum

## 5) Mimari Şema

**Akış:**
1. Developer → GitHub'a kod push eder
2. Production sunucuda → `git pull` ile güncelleme çekilir
3. `npm ci` ile bağımlılıklar kurulur
4. `npm run build` ile Next.js uygulaması build edilir
5. PM2 ile uygulama başlatılır/yeniden yüklenir
6. Nginx, PM2'nin çalıştırdığı Next.js uygulamasına reverse proxy yapar
7. Next.js uygulaması PostgreSQL veritabanına Drizzle ORM ile bağlanır
8. Kullanıcı → Nginx → Next.js → PostgreSQL

**Bileşenler:**
- Next.js App: Frontend ve API routes
- PostgreSQL: Veritabanı (local: Docker, prod: servis)
- PM2: Process manager
- Nginx: Web server ve reverse proxy

## 6) Repo Yapısı

```
/
├── app/                    # Next.js App Router sayfaları
│   ├── (routes)/          # Route grupları
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React bileşenleri
│   ├── ui/               # Temel UI bileşenleri
│   └── features/         # Özellik bazlı bileşenler
├── lib/                  # Yardımcı fonksiyonlar
│   ├── db/               # Drizzle setup ve queries
│   └── utils/            # Genel yardımcılar
├── data/                 # Veri dosyaları
│   └── snapshots/        # WooCommerce snapshot'ları
├── drizzle/              # Drizzle schema ve migrations
│   ├── schema.ts
│   └── migrations/
├── public/               # Statik dosyalar
├── scripts/              # Utility scriptler
│   └── import.ts         # WooCommerce import scripti
├── .env.example          # Ortam değişkenleri şablonu
├── docker-compose.yml    # Local PostgreSQL
├── drizzle.config.ts     # Drizzle yapılandırması
├── next.config.js        # Next.js yapılandırması
├── package.json
├── tailwind.config.js    # Tailwind yapılandırması
└── tsconfig.json         # TypeScript yapılandırması
```

## 7) Ortam Değişkenleri (ENV)

`.env.example` dosyası içeriği:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cinselhobi

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Production (sunucuda doldurulacak)
# DATABASE_URL=postgresql://user:password@localhost:5432/cinselhobi_prod
# NEXT_PUBLIC_APP_URL=https://cinselhobi.com
```

## 8) Local Kurulum Checklist (Mac)

### Next.js Kurulum

```bash
# Node.js 18+ kurulu olmalı
node --version

# Proje bağımlılıklarını kur
npm ci

# Development server'ı başlat
npm run dev
```

### Docker Compose ile PostgreSQL

```bash
# Docker Compose ile PostgreSQL'i başlat
docker-compose up -d

# PostgreSQL'in çalıştığını kontrol et
docker-compose ps

# PostgreSQL'e bağlan (opsiyonel)
docker-compose exec postgres psql -U user -d cinselhobi
```

### Drizzle Migrate Akışı

```bash
# Schema değişikliklerinden migration oluştur
npm run db:generate

# Migration'ları veritabanına uygula
npm run db:migrate

# (Opsiyonel) Veritabanı durumunu kontrol et
npm run db:studio
```

## 9) Veri Taşıma Planı (WooCommerce -> Snapshot -> PostgreSQL)

### Çekilecek Veriler
- Kategoriler (id, name, slug, parent_id, description)
- Ürünler (id, name, slug, description, price, stock_status, image_url)
- Ürün-Kategori İlişkisi (product_id, category_id)
- Görsel URL'leri (ürün görselleri için)

### Snapshot Dosya Yapısı

```
data/snapshots/
├── categories.json
├── products.json
├── product_categories.json
└── images.json
```

### Import Prensipleri
- **Pagination**: WooCommerce API'den sayfa sayfa veri çekme
- **Retry**: Başarısız istekler için otomatik yeniden deneme
- **Upsert**: Mevcut kayıtları güncelleme, yeni olanları ekleme
- **Idempotent**: Script birden fazla çalıştırılsa bile aynı sonucu vermeli

## 10) Sayfa/Rota Planı (MVP)

### `/` (Home)
**Ne gösterecek:**
- Hero section
- Öne çıkan kategoriler
- Yeni ürünler listesi
- Hızlı erişim butonları

**Minimum bileşenler:**
- `HeroSection`
- `CategoryGrid`
- `ProductList`
- `QuickActions`

### `/product/[slug]`
**Ne gösterecek:**
- Ürün detayları (isim, açıklama, fiyat)
- Ürün görselleri (galeri)
- Stok durumu
- Kategoriler
- Sepete ekle butonu

**Minimum bileşenler:**
- `ProductDetail`
- `ProductGallery`
- `ProductInfo`
- `AddToCartButton`

### `/product-category/[slug]`
**Ne gösterecek:**
- Kategori bilgisi
- Kategoriye ait ürünler listesi (grid)
- Filtreleme seçenekleri (gelecekte)
- Sayfalama

**Minimum bileşenler:**
- `CategoryHeader`
- `ProductGrid`
- `Pagination`

## 11) UI/UX Kuralları (Native App Hissi)

### Mobil Öncelik
- Tüm tasarım mobil ekrandan başlar, desktop'a genişletilir
- Touch-friendly elementler (minimum 44x44px hit area)

### Büyük Hit-Area
- Butonlar ve tıklanabilir elementler en az 44x44px
- Padding ve spacing geniş tutulur

### Sticky Bottom Action Alanı
- Önemli aksiyonlar (sepete ekle, satın al) ekranın altında sabit kalır
- Scroll edildiğinde görünür kalır

### Skeleton/Loading Yaklaşımı
- Veri yüklenirken skeleton UI gösterilir
- Ani yüklemeler yerine kademeli görünüm

### Tutarlı Spacing & Typography
- Tailwind spacing scale kullanılır (4px base)
- Typography scale tutarlı şekilde uygulanır
- Mobil ve desktop için responsive typography

## 12) Tasarım Token Entegrasyonu (Markalar Dünyası)

Tokenlar geldiğinde yapılacaklar:

1. **CSS Variables Yaklaşımı:**
   - `app/globals.css` içinde CSS custom properties tanımlanır
   - Tokenlar (renkler, spacing, typography) CSS variables'a dönüştürülür

2. **Tailwind Config Entegrasyonu:**
   - `tailwind.config.js` içinde `theme.extend` kullanılır
   - CSS variables Tailwind theme değerlerine map edilir
   - Örnek: `colors.primary` → `var(--color-primary)`

3. **Kullanım:**
   - Bileşenlerde Tailwind class'ları kullanılır
   - Direkt CSS variable kullanımı minimal tutulur

## 13) Prod Deploy Planı (Kamatera)

### Sunucuda Gereksinimler
- Node.js 18+ kurulu
- PostgreSQL servis çalışıyor
- PM2 global olarak kurulu (`npm install -g pm2`)
- Nginx kurulu ve çalışıyor
- Git kurulu
- Domain DNS ayarları yapılmış

### Build ve PM2 Start/Reload Adımları

```bash
# Proje dizinine git
cd /path/to/cinselhobi.com-next

# Son değişiklikleri çek
git pull origin main

# Bağımlılıkları kur
npm ci

# Build et
npm run build

# PM2 ile başlat (ilk kez)
pm2 start npm --name "cinselhobi" -- start

# PM2 ile yeniden yükle (güncelleme)
pm2 reload cinselhobi

# PM2 durumunu kontrol et
pm2 status

# PM2 loglarını görüntüle
pm2 logs cinselhobi
```

### Nginx Reverse Proxy Notları

Nginx yapılandırması (`/etc/nginx/sites-available/cinselhobi`):

```nginx
server {
    listen 80;
    server_name cinselhobi.com www.cinselhobi.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

SSL için Let's Encrypt kullanılabilir.

## 14) İş Sırası (Adım Adım)

### Adım 1: İskelet + Docker + ENV

**Amaç:** Proje iskeletini oluştur, local PostgreSQL'i hazırla, ortam değişkenlerini yapılandır.

**Çıktılar:**
- Next.js projesi kurulmuş
- `docker-compose.yml` hazır
- `.env.example` oluşturulmuş
- `README.md` local kurulum adımlarıyla güncellenmiş

**Çalıştırılacak komutlar:**
```bash
npx create-next-app@latest . --typescript --tailwind --app
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
docker-compose up -d
```

**Bitti kriteri:**
- [ ] Next.js dev server çalışıyor (`npm run dev`)
- [ ] PostgreSQL Docker container'ı çalışıyor
- [ ] `.env.example` dosyası mevcut
- [ ] `README.md` local kurulum adımlarını içeriyor

### Adım 2: Drizzle + Schema + Migrations

**Amaç:** Veritabanı şemasını tanımla, migration'ları oluştur ve uygula.

**Çıktılar:**
- `drizzle/schema.ts` dosyası (categories, products, product_categories tabloları)
- `drizzle.config.ts` yapılandırması
- İlk migration dosyası
- Veritabanında tablolar oluşturulmuş

**Çalıştırılacak komutlar:**
```bash
npm run db:generate
npm run db:migrate
```

**Bitti kriteri:**
- [ ] Schema dosyası kategoriler, ürünler ve ilişki tablolarını içeriyor
- [ ] Migration başarıyla uygulandı
- [ ] Veritabanında tablolar mevcut

### Adım 3: Import Script + Snapshot + DB Dolumu

**Amaç:** WooCommerce verilerini snapshot olarak kaydet, PostgreSQL'e import et.

**Çıktılar:**
- `scripts/import.ts` scripti hazır
- `data/snapshots/` klasöründe JSON dosyaları
- Veritabanı verilerle dolu

**Çalıştırılacak komutlar:**
```bash
npm run import
# veya
tsx scripts/import.ts
```

**Bitti kriteri:**
- [ ] Snapshot dosyaları oluşturuldu
- [ ] Veritabanında kategoriler ve ürünler mevcut
- [ ] Import script idempotent çalışıyor (tekrar çalıştırılabilir)

### Adım 4: Sayfalar + Temel UI

**Amaç:** MVP sayfalarını oluştur, temel UI bileşenlerini ekle.

**Çıktılar:**
- `/` (home) sayfası çalışıyor
- `/product/[slug]` sayfası çalışıyor
- `/product-category/[slug]` sayfası çalışıyor
- Temel UI bileşenleri (skeleton, buttons, cards)

**Çalıştırılacak komutlar:**
```bash
npm run dev
# Tarayıcıda test et
```

**Bitti kriteri:**
- [ ] Tüm sayfalar render oluyor
- [ ] Veriler veritabanından çekiliyor
- [ ] Mobil görünüm düzgün çalışıyor
- [ ] Loading state'ler gösteriliyor

### Adım 5: Prod Deploy

**Amaç:** Production sunucusuna deploy et, Nginx yapılandır, domain'i bağla.

**Çıktılar:**
- Production sunucusunda uygulama çalışıyor
- Nginx reverse proxy yapılandırılmış
- Domain erişilebilir
- PM2 process yönetimi aktif

**Çalıştırılacak komutlar:**
```bash
# Sunucuda
git pull origin main
npm ci
npm run build
pm2 start npm --name "cinselhobi" -- start
# Nginx yapılandırması manuel yapılacak
```

**Bitti kriteri:**
- [ ] Uygulama production'da çalışıyor
- [ ] Domain üzerinden erişilebiliyor
- [ ] PM2 process çalışıyor
- [ ] Nginx doğru yönlendirme yapıyor

## 15) Riskler ve Önlemler

**Riskler:**
- Veri kaybı: Import sırasında veri bozulması
- **Önlem:** Snapshot dosyaları yedeklenir, import script idempotent çalışır

- Production'da build hatası
- **Önlem:** Local'de build test edilir, CI/CD pipeline eklenebilir

- Veritabanı bağlantı sorunları
- **Önlem:** Connection pooling kullanılır, retry mekanizması eklenir

- PM2 process crash
- **Önlem:** PM2 auto-restart aktif, loglar izlenir

## 16) Kısa Sözlük

- **Slug**: URL'de kullanılan, SEO-friendly, küçük harfli, tire ile ayrılmış metin (örn: "urun-adi-123")
- **Migration**: Veritabanı şema değişikliklerini uygulayan script dosyaları
- **Upsert**: Kayıt varsa güncelle, yoksa ekle işlemi (update + insert)
- **Snapshot**: Belirli bir zamandaki veri durumunun JSON dosyası olarak kaydı
- **Reverse Proxy**: Nginx'in istekleri arka plandaki Next.js uygulamasına yönlendirmesi
- **Idempotent**: Aynı işlemin birden fazla kez yapılması durumunda sonucun değişmemesi

---

## Sonraki Adım: Cursor Prompt #1

```
Adım 1'i uygula: Next.js proje iskeletini oluştur, TypeScript ve Tailwind CSS ile. Docker Compose ile PostgreSQL container'ı hazırla. .env.example dosyasını oluştur ve gerekli ortam değişkenlerini ekle. README.md dosyasını local kurulum adımlarını içerecek şekilde güncelle. Proje kök dizininde gerekli klasör yapısını oluştur (app/, components/, lib/, data/snapshots/, drizzle/, scripts/).
```

