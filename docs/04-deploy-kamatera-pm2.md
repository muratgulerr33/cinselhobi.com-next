# 04 — Kamatera Deploy (Git Pull + Build + PM2)

> Tarih: 2025-12-26

Bu doküman, projeyi Kamatera VPS’e yayınlamak için temel runbook’tur.

---

## 1) Sunucu Ön Hazırlık

- Linux VPS
- Node.js güncel LTS
- Git
- PM2

```bash
node -v
git --version
pm2 -v
```

---

## 2) Repo Klonlama

```bash
mkdir -p /var/www
cd /var/www
git clone <GITHUB_REPO_URL> cinselhobi.com-next
cd cinselhobi.com-next
```

---

## 3) Prod ENV

Sunucuda `.env.local` (veya `.env`) oluştur:

```env
DATABASE_URL="postgres://<USER>:<PASS>@<HOST>:5432/<DB>"

WOO_BASE_URL="https://cinselhobi.com"
WOO_CONSUMER_KEY="ck_..."
WOO_CONSUMER_SECRET="cs_..."
```

> Woo key’ler prod’da import için lazımsa koy; import bittikten sonra kaldırabilirsin.

---

## 4) Build & Start

```bash
cd /var/www/cinselhobi.com-next
npm ci
npm run build
```

PM2 ile çalıştırma:
```bash
pm2 start npm --name cinselhobi-next -- start
pm2 save
pm2 status
```

---

## 5) Güncelleme (Deploy Rutini)

```bash
cd /var/www/cinselhobi.com-next
git pull
npm ci
npm run build
pm2 restart cinselhobi-next
```

---

## 6) Sağlık Kontrol

```bash
pm2 logs cinselhobi-next --lines 200
```

---

## 7) Notlar

- Prod Postgres yönetimi ayrıca planlanmalı (backup, kullanıcı yetkileri, firewall).
- Reverse proxy gerekiyorsa ayrı bir runbook ile ekleriz.
