# 02 — DB & Drizzle Kurulumu (Runbook)

> Tarih: 2025-12-26

Bu doküman, veritabanı ve Drizzle katmanını **kurmak/çalıştırmak** için “kopyala-yapıştır” seviyesinde notlar içerir.

---

## 1) Local PostgreSQL (Docker)

```bash
cd /Users/apple/dev/cinselhobi.com-next
docker compose up -d
docker compose ps
```

PSQL:
```bash
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi
```

---

## 2) ENV (zorunlu)

`.env.local` içine:

```env
DATABASE_URL="postgres://cinselhobi:cinselhobi@localhost:5432/cinselhobi"
```

---

## 3) Drizzle Komutları

```bash
npm run db:generate
npm run db:migrate
```

Not:
- `db:generate` schema değişikliklerine göre migration üretir.
- Schema değişmediyse “nothing to migrate” demesi normal.

---

## 4) Şema (Tablolar)

### categories
- wc_id (unique)
- slug (unique)
- name
- parent_wc_id
- description
- image_url
- created_at / updated_at

### products
- wc_id (unique)
- slug (unique)
- name, status, type
- sku
- price / regular_price / sale_price (integer: kuruş)
- currency (default TRY)
- short_description, description
- stock_status, stock_quantity
- images (jsonb)
- raw (jsonb, full object)
- created_at / updated_at

### product_categories
- product_id (FK → products.id)
- category_id (FK → categories.id)
- (PK) product_id + category_id

---

## 5) Doğrulama Sorguları

```bash
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) from categories;"
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) from products;"
docker exec -it cinselhobi_db psql -U cinselhobi -d cinselhobi -c "select count(*) from product_categories;"
```

---

## 6) Sık Hatalar

### A) `Could not find a declaration file for module 'pg'`
Çözüm:
```bash
npm i -D @types/pg
```

### B) `client password must be a string` (pg SCRAM)
Sebep: env daha yüklenmeden DB connection kurulmuş olabilir.  
Çözüm: `src/db/connection.ts` içinde `.env.local` yükleme + DATABASE_URL kontrolü.

---

## 7) Build Test

```bash
npm run build
```

Build geçiyorsa DB katmanı TS açısından da OK demektir.
