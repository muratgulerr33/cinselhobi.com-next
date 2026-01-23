# 03 — Woo Import Rehberi (Snapshot + DB Import)

> Tarih: 2025-12-26

Bu doküman, WooCommerce’den veriyi **okuyup** lokal PostgreSQL’e yazan import akışını anlatır.

---

## 1) Gerekli ENV

`.env.local` içine:

```env
DATABASE_URL="postgres://cinselhobi:cinselhobi@localhost:5432/cinselhobi"

WOO_BASE_URL="https://cinselhobi.com"
WOO_CONSUMER_KEY="ck_..."
WOO_CONSUMER_SECRET="cs_..."
```

---

## 2) Çalıştırma

Local Postgres:
```bash
docker compose up -d
```

### Sample Import (önerilen)
Geliştirme/test sırasında DB’yi küçük tutar:

```bash
WOO_AUTH_MODE=query WOO_IMPORT_MODE=sample WOO_IMPORT_LIMIT=20 npm run woo:import
```

### Full Import
```bash
WOO_AUTH_MODE=query WOO_IMPORT_MODE=full npm run woo:import
```

---

## 3) Auth Modları

- `WOO_AUTH_MODE=basic` (default): Authorization header kullanır.
- `WOO_AUTH_MODE=query`: URL’e `consumer_key` ve `consumer_secret` ekler.

401 alırsan `query` ile dene.

---

## 4) Snapshot Yapısı

Snapshot’lar gitignore’dadır.

```
data/snapshots/
  sample/
    categories.json
    products_page_001.json
    summary.json
  full/
    ...
```

`summary.json` içinde:
- mode
- limit (sample modda)
- importedProducts
- totalFetchedProducts
- tarih/saat

---

## 5) Ürün Filtreleri

Varsayılan:
- `status=publish` (yayında ürünler)

---

## 6) DB Yazma Mantığı (İdempotent)

- categories: `wc_id` unique → upsert
- products: `wc_id` unique → upsert
- product_categories: PK (product_id, category_id) → duplicate olursa ignore

Script’i tekrar çalıştırmak güvenlidir.

---

## 7) Doğrulama

```bash
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) as categories from categories;"
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) as products from products;"
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) as links from product_categories;"
```

---

## 8) Performans İpucu

- UI geliştirirken **sample mod** kullan.
- UI bitmeye yakın **full import** ile tüm veriyi çekip final kontrol yap.
