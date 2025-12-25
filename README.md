# Cinselhobi Next (Frontend)

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

### 4. Development Server'ı Başlatma

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

## ENV Kurulumu

Ortam değişkenlerini yapılandırmak için:

1. `.env.example` dosyasını `.env.local` olarak kopyalayın:

```bash
cp .env.example .env.local
```

2. `.env.local` dosyasını düzenleyip gerçek değerleri girin:
   - `DATABASE_URL`: Veritabanı bağlantı string'i (docker-compose.yml'deki varsayılan değerler kullanılabilir)
   - `WOO_BASE_URL`: WooCommerce sitenizin URL'i
   - `WOO_CONSUMER_KEY`: WooCommerce Consumer Key
   - `WOO_CONSUMER_SECRET`: WooCommerce Consumer Secret

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

## Notlar

- Bu adımda (Adım 1) Drizzle ORM, veritabanı şeması ve migration'lar henüz eklenmemiştir. Bunlar Adım 2'de eklenecektir.
- Veritabanı verileri Docker volume'unda (`pgdata`) saklanır. Container silinse bile veriler korunur.

