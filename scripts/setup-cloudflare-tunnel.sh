#!/usr/bin/env bash

set -euo pipefail

LOCAL_PORT="${1:-8788}"
TUNNEL_NAME="${2:-local-ai-service}"
DOMAIN="${3:-}"

log(){ printf "\033[1;36m[INFO]\033[0m %s\n" "$*"; }
ok(){ printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }

echo "=========================================="
echo "Cloudflare Tunnel 设置向导"
echo "=========================================="
echo ""

# 检查 cloudflared 是否安装
if ! command -v cloudflared >/dev/null 2>&1; then
  err "cloudflared 未安装"
  echo ""
  echo "安装方法："
  echo "  macOS: brew install cloudflared"
  echo "  或访问: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

ok "cloudflared 已安装"

# 检查是否已登录
log "检查 Cloudflare 登录状态"
if ! cloudflared tunnel list >/dev/null 2>&1; then
  warn "未登录 Cloudflare"
  echo ""
  echo "请执行以下步骤："
  echo "1. 访问 https://dash.cloudflare.com 登录账号"
  echo "2. 运行: cloudflared tunnel login"
  echo ""
  read -p "是否现在登录? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "正在打开浏览器进行登录..."
    cloudflared tunnel login
    ok "登录成功"
  else
    err "需要登录才能继续"
    exit 1
  fi
else
  ok "已登录 Cloudflare"
fi

# 检查本地服务是否运行
log "检查本地服务是否运行在端口 $LOCAL_PORT"
if ! lsof -i ":$LOCAL_PORT" >/dev/null 2>&1; then
  warn "端口 $LOCAL_PORT 未被占用"
  echo ""
  echo "请先启动本地 AI 服务："
  echo "  cd apps/local-ai-service"
  echo "  pnpm dev"
  echo ""
  read -p "是否继续? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  ok "本地服务正在运行"
fi

# 检查隧道是否已存在
log "检查隧道是否已存在: $TUNNEL_NAME"
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
  warn "隧道 $TUNNEL_NAME 已存在"
  read -p "是否删除现有隧道并重新创建? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "删除现有隧道..."
    cloudflared tunnel delete "$TUNNEL_NAME" || true
    ok "隧道已删除"
  else
    log "使用现有隧道"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    ok "使用现有隧道 ID: $TUNNEL_ID"
  fi
else
  log "创建新隧道: $TUNNEL_NAME"
  TUNNEL_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
  TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP 'Created tunnel \K[^\s]+' || echo "$TUNNEL_NAME")
  ok "隧道已创建: $TUNNEL_ID"
fi

# 配置域名（如果提供）
if [ -n "$DOMAIN" ]; then
  log "配置域名: $DOMAIN"
  cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || {
    warn "DNS 配置失败，请手动配置"
    echo ""
    echo "请手动运行："
    echo "  cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN"
  }
  ok "域名已配置: $DOMAIN"
  PUBLIC_URL="https://$DOMAIN"
else
  warn "未提供域名，将使用临时 URL"
  PUBLIC_URL="临时 URL（需要手动配置域名）"
fi

# 创建配置文件
CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CONFIG_DIR/config.yml"
mkdir -p "$CONFIG_DIR"

log "创建配置文件: $CONFIG_FILE"

# 获取隧道 ID（如果还没有）
if [ -z "${TUNNEL_ID:-}" ]; then
  TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}' || echo "$TUNNEL_NAME")
fi

# 创建配置文件
cat > "$CONFIG_FILE" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - hostname: ${DOMAIN:-}
    service: http://localhost:$LOCAL_PORT
  - service: http_status:404
EOF

ok "配置文件已创建"

# 显示配置信息
echo ""
echo "=========================================="
ok "配置完成"
echo "=========================================="
echo ""
echo "隧道名称: $TUNNEL_NAME"
echo "隧道 ID: $TUNNEL_ID"
echo "本地端口: $LOCAL_PORT"
if [ -n "$DOMAIN" ]; then
  echo "公共 URL: https://$DOMAIN"
else
  echo "公共 URL: 需要配置域名"
fi
echo ""

# 显示下一步操作
echo "=========================================="
log "下一步操作"
echo "=========================================="
echo ""

if [ -z "$DOMAIN" ]; then
  echo "1. 配置域名（可选）："
  echo "   cloudflared tunnel route dns $TUNNEL_NAME your-subdomain.yourdomain.com"
  echo ""
fi

echo "2. 启动隧道："
echo "   cloudflared tunnel run $TUNNEL_NAME"
echo ""
echo "   或作为服务运行（macOS）："
echo "   sudo cloudflared service install"
echo "   sudo cloudflared service start"
echo ""

if [ -n "$DOMAIN" ]; then
  echo "3. 在 Vercel Production 环境变量中配置："
  echo "   USE_LOCAL_AI=true"
  echo "   LOCAL_AI_SERVICE_URL=https://$DOMAIN"
  echo "   LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345"
  echo ""
fi

echo "4. 测试连接："
if [ -n "$DOMAIN" ]; then
  echo "   curl https://$DOMAIN/healthz"
else
  echo "   curl https://your-domain.com/healthz"
fi
echo ""

echo "=========================================="
ok "设置完成"
echo "=========================================="

