# MCP Server Kurulum ve Kullanım Kılavuzu

## Hızlı Başlangıç

### 1. Bağımlılıkları Kur
```bash
cd mcp-server
npm install
```

### 2. Build Et
```bash
npm run build
```

### 3. Server'ı Başlat
```bash
npm start
# veya development mode için:
npm run dev
```

Server `http://localhost:8787` adresinde çalışacaktır.

## Test

### Health Check
```bash
curl http://localhost:8787/health
```

### Tools Listesi
```bash
curl http://localhost:8787/tools/list
```

### Dosya Okuma
```bash
curl -X POST http://localhost:8787/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "read_file",
    "arguments": {
      "filePath": "README.md"
    }
  }'
```

### Dosya Arama
```bash
curl -X POST http://localhost:8787/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_in_files",
    "arguments": {
      "query": "function",
      "directory": "src",
      "maxResults": 10
    }
  }'
```

## Cloudflare Tunnel Kurulumu

### Otomatik Kurulum
```bash
./cloudflare-setup.sh
```

### Manuel Kurulum

#### 1. Cloudflared Kurulumu
```bash
# macOS
brew install cloudflared

# Linux
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

#### 2. Tunnel Oluştur
```bash
cloudflared tunnel create mcp-dev
```

#### 3. DNS Kaydı Ekle
```bash
cloudflared tunnel route dns mcp-dev mcp-dev.yourdomain.com
```

#### 4. Config Dosyası Oluştur
`~/.cloudflared/config.yml`:
```yaml
tunnel: mcp-dev
credentials-file: /path/to/credentials.json

ingress:
  - hostname: mcp-dev.yourdomain.com
    service: http://localhost:8787
  - service: http_status:404
```

#### 5. Tunnel'ı Başlat
```bash
cloudflared tunnel run mcp-dev
```

## Cloudflare Access Ayarları

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. "Add an application" → Self-hosted
3. Ayarlar:
   - **Application name**: `mcp-dev`
   - **Session duration**: 24 hours
   - **Application domain**: `mcp-dev.yourdomain.com`
4. Policy:
   - **Include**: Email (your-email@example.com)
   - **Or**: Service Token (opsiyonel)

## ChatGPT Developer Mode Entegrasyonu

1. ChatGPT Developer Mode → Settings → MCP Servers
2. Add new server:
   - **Name**: `cinselhobi-mcp`
   - **URL**: `https://mcp-dev.yourdomain.com`
   - **Type**: HTTP
3. Test connection

## Güvenlik Kontrolleri

### ✅ Test Edildi
- ✅ Health check çalışıyor
- ✅ Tools listesi döndürülüyor
- ✅ Dosya okuma çalışıyor
- ✅ .env dosyaları engelleniyor
- ✅ Path traversal koruması aktif
- ✅ Secret masking çalışıyor

### Güvenlik Özellikleri
- ✅ Proje root dışına çıkış engellenir
- ✅ .env*, node_modules, .git gibi dosyalar engellenir
- ✅ Sadece text dosyaları okunabilir
- ✅ Maksimum dosya boyutu: 5MB
- ✅ Secret'lar otomatik maskelenir
- ✅ Log'larda secret'lar gösterilmez

## Sorun Giderme

### Port 8787 Kullanımda
```bash
# Port'u kontrol et
lsof -i :8787

# Farklı port kullan
PORT=8788 npm start
```

### Tunnel Bağlantı Hatası
- Cloudflare dashboard'da tunnel durumunu kontrol edin
- Credentials dosyasının doğru yolda olduğundan emin olun
- DNS kaydının doğru oluşturulduğunu kontrol edin

### Dosya Okunamıyor
- Dosya yolu proje root içinde mi?
- Dosya uzantısı izin verilen listede mi?
- Dosya blocklist'te mi?
- Dosya boyutu 5MB'dan küçük mü?

## DoD Kontrol Listesi

- [x] Server localhost:8787'de çalışıyor
- [x] Health check endpoint çalışıyor
- [x] Tools listesi döndürülüyor
- [x] Dosya okuma çalışıyor
- [x] .env dosyaları engelleniyor
- [x] Path traversal koruması aktif
- [x] Secret masking çalışıyor
- [ ] Cloudflare tunnel kuruldu
- [ ] Cloudflare Access yapılandırıldı
- [ ] ChatGPT Developer Mode'da test edildi




