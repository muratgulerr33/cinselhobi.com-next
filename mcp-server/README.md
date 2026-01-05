# Cinselhobi MCP Server

Güvenli local dosya erişimi sağlayan MCP (Model Context Protocol) server. ChatGPT Developer Mode ile entegre edilebilir.

## Özellikler

- ✅ **Güvenli dosya erişimi**: Path traversal koruması, allowlist/blocklist
- ✅ **Secret masking**: Otomatik secret masking (API keys, passwords, tokens)
- ✅ **Text dosya desteği**: Sadece text dosyaları okunabilir
- ✅ **Dosya boyutu limiti**: Maksimum 5MB
- ✅ **Git entegrasyonu**: Git status kontrolü

## Kurulum

```bash
cd mcp-server
npm install
npm run build
```

## Kullanım

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

Server `http://localhost:8787` adresinde çalışacaktır.

## API Endpoints

### Health Check
```
GET /health
```

### Tools Listesi
```
GET /tools/list
```

### Tool Çağrısı
```
POST /tools
Content-Type: application/json

{
  "tool": "read_file",
  "arguments": {
    "filePath": "README.md"
  }
}
```

### SSE Endpoint
```
GET /sse
```

## Tools

### 1. list_files
Dizindeki dosya ve klasörleri listeler.

**Parametreler:**
- `directory` (string, opsiyonel): Listelenecek dizin (varsayılan: ".")

**Örnek:**
```json
{
  "tool": "list_files",
  "arguments": {
    "directory": "src"
  }
}
```

### 2. read_file
Dosya içeriğini okur. Secret'lar otomatik maskelenir.

**Parametreler:**
- `filePath` (string, gerekli): Okunacak dosya yolu

**Örnek:**
```json
{
  "tool": "read_file",
  "arguments": {
    "filePath": "package.json"
  }
}
```

### 3. search_in_files
Dosyalarda metin araması yapar.

**Parametreler:**
- `query` (string, gerekli): Aranacak metin
- `directory` (string, opsiyonel): Arama yapılacak dizin (varsayılan: ".")
- `maxResults` (number, opsiyonel): Maksimum sonuç sayısı (varsayılan: 50)

**Örnek:**
```json
{
  "tool": "search_in_files",
  "arguments": {
    "query": "function",
    "directory": "src",
    "maxResults": 20
  }
}
```

### 4. git_status
Git working tree durumunu kontrol eder.

**Parametreler:** Yok

**Örnek:**
```json
{
  "tool": "git_status",
  "arguments": {}
}
```

## Güvenlik

### Blocklist
Aşağıdaki dosya/klasör pattern'leri otomatik olarak engellenir:
- `.env*` dosyaları
- `node_modules/`
- `.git/`
- `data/snapshots/`
- `.next/`, `dist/`, `build/`
- `.cache/`, `coverage/`
- `.log`, `.lock` dosyaları

### İzin Verilen Uzantılar
Sadece text dosyaları okunabilir:
- `.md`, `.ts`, `.tsx`, `.js`, `.jsx`
- `.json`, `.txt`, `.css`, `.html`
- `.yml`, `.yaml`, `.xml`, `.sql`
- `.sh`, `.mjs`, `.cjs`, `.mts`, `.cts`

### Secret Masking
Aşağıdaki pattern'ler otomatik maskelenir:
- `password`, `passwd`, `pwd`
- `api_key`, `apikey`
- `secret`, `token`, `auth_token`
- `consumer_key`, `consumer_secret`
- `DATABASE_URL`, `WOO_CONSUMER_KEY`, vb.

## Cloudflare Tunnel Kurulumu

### 1. Cloudflare Tunnel Oluşturma

```bash
# Cloudflare Tunnel kurulumu (ilk kez)
cloudflared tunnel create mcp-dev

# Tunnel'ı domain'e bağla
cloudflared tunnel route dns mcp-dev mcp-dev.yourdomain.com

# Config dosyası oluştur (~/.cloudflared/config.yml)
tunnel: mcp-dev
credentials-file: /path/to/credentials.json

ingress:
  - hostname: mcp-dev.yourdomain.com
    service: http://localhost:8787
  - service: http_status:404
```

### 2. Tunnel'ı Başlatma

```bash
cloudflared tunnel run mcp-dev
```

### 3. Cloudflare Access Ayarları

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. "Add an application" → Self-hosted
3. Application name: `mcp-dev`
4. Session duration: 24 hours
5. Application domain: `mcp-dev.yourdomain.com`
6. Policy:
   - Include: Email (your-email@example.com)
   - Or: Service Token (opsiyonel)

### 4. ChatGPT Developer Mode Entegrasyonu

1. ChatGPT Developer Mode → Settings → MCP Servers
2. Add new server:
   - **Name**: `cinselhobi-mcp`
   - **URL**: `https://mcp-dev.yourdomain.com`
   - **Type**: HTTP
3. Test connection

## Test

### Health Check
```bash
curl http://localhost:8787/health
```

### Tools List
```bash
curl http://localhost:8787/tools/list
```

### Read File
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

### Search Files
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

## DoD (Definition of Done)

- ✅ ChatGPT tools'u görüyor
- ✅ Proje içinden bir .md dosyasını okuyup içeriğe dayanarak doğru task/prompt üretiyor
- ✅ .env vb. dosyalar okunamıyor

## Notlar

- Server sadece proje root dizini içindeki dosyalara erişebilir
- Path traversal saldırıları engellenir
- Secret'lar otomatik maskelenir
- Maksimum dosya boyutu: 5MB
- Sadece text dosyaları okunabilir




