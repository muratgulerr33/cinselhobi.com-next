#!/bin/bash

# Cloudflare Tunnel Kurulum Script'i
# Bu script, MCP server'ı Cloudflare tunnel ile expose eder

set -e

echo "🚀 Cloudflare Tunnel Kurulumu"
echo "================================"
echo ""

# 1. Cloudflared kontrolü
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared bulunamadı. Lütfen önce cloudflared'i kurun:"
    echo "   macOS: brew install cloudflared"
    echo "   Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

echo "✅ cloudflared bulundu"
echo ""

# 2. Tunnel oluştur
TUNNEL_NAME="mcp-dev"
echo "📦 Tunnel oluşturuluyor: $TUNNEL_NAME"
cloudflared tunnel create $TUNNEL_NAME || echo "⚠️  Tunnel zaten mevcut, devam ediliyor..."
echo ""

# 3. Domain bilgisi al
read -p "🌐 Domain adınızı girin (örn: yourdomain.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "❌ Domain adı gerekli!"
    exit 1
fi

SUBDOMAIN="mcp-dev"
FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"

echo ""
echo "📝 DNS kaydı oluşturuluyor: $FULL_DOMAIN"
cloudflared tunnel route dns $TUNNEL_NAME $FULL_DOMAIN || echo "⚠️  DNS kaydı zaten mevcut olabilir"
echo ""

# 4. Config dosyası oluştur
CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CONFIG_DIR/config.yml"

mkdir -p "$CONFIG_DIR"

# Tunnel credentials dosyasını bul
CREDENTIALS_FILE=$(find "$CONFIG_DIR" -name "*.json" -path "*${TUNNEL_NAME}*" | head -1)

if [ -z "$CREDENTIALS_FILE" ]; then
    echo "⚠️  Credentials dosyası bulunamadı. Tunnel'ı yeniden oluşturmayı deneyin."
    exit 1
fi

echo "📄 Config dosyası oluşturuluyor: $CONFIG_FILE"

cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_NAME
credentials-file: $CREDENTIALS_FILE

ingress:
  - hostname: $FULL_DOMAIN
    service: http://localhost:8787
  - service: http_status:404
EOF

echo "✅ Config dosyası oluşturuldu"
echo ""

# 5. Tunnel'ı başlat (opsiyonel)
read -p "🚀 Tunnel'ı şimdi başlatmak ister misiniz? (y/n): " START_NOW

if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
    echo ""
    echo "🌐 Tunnel başlatılıyor..."
    echo "   URL: https://$FULL_DOMAIN"
    echo "   Local: http://localhost:8787"
    echo ""
    echo "⚠️  Tunnel'ı durdurmak için Ctrl+C basın"
    echo ""
    cloudflared tunnel run $TUNNEL_NAME
else
    echo ""
    echo "✅ Kurulum tamamlandı!"
    echo ""
    echo "Tunnel'ı başlatmak için:"
    echo "  cloudflared tunnel run $TUNNEL_NAME"
    echo ""
    echo "Tunnel URL: https://$FULL_DOMAIN"
    echo ""
fi




