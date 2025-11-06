#!/usr/bin/env bash

set -euo pipefail

LOCAL_PORT="${1:-8788}"
TUNNEL_NAME="${2:-local-ai-service}"

log(){ printf "\033[1;36m[INFO]\033[0m %s\n" "$*"; }
ok(){ printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }

echo "=========================================="
echo "Cloudflare Tunnel 配置（使用免费域名）"
echo "=========================================="
echo ""

# 检查 cloudflared 是否安装
if ! command -v cloudflared >/dev/null 2>&1; then
  err "cloudflared 未安装"
  echo ""
  echo "请先安装："
  echo "  brew install cloudflared"
  exit 1
fi

ok "cloudflared 已安装"

# 检查本地服务是否运行
log "检查本地 AI 服务是否运行在端口 $LOCAL_PORT"
if ! lsof -i ":$LOCAL_PORT" >/dev/null 2>&1; then
  warn "端口 $LOCAL_PORT 未被占用"
  echo ""
  echo "⚠️  请先启动本地 AI 服务："
  echo "   cd apps/local-ai-service"
  echo "   pnpm dev"
  echo ""
  echo "启动后，请重新运行此脚本"
  exit 1
fi

ok "本地 AI 服务正在运行"

# 检查是否已登录
log "检查 Cloudflare 登录状态"
if ! cloudflared tunnel list >/dev/null 2>&1; then
  warn "未登录 Cloudflare"
  echo ""
  echo "正在打开浏览器进行登录..."
  echo "请按照以下步骤操作："
  echo "1. 浏览器会自动打开 Cloudflare 登录页面"
  echo "2. 登录你的 Cloudflare 账号"
  echo "3. 选择你的域名（如果没有域名，选择任意一个或跳过）"
  echo "4. 点击 Authorize 授权"
  echo ""
  cloudflared tunnel login || {
    err "登录失败"
    exit 1
  }
  ok "登录成功"
else
  ok "已登录 Cloudflare"
fi

# 检查隧道是否已存在
log "检查隧道是否已存在: $TUNNEL_NAME"
TUNNEL_EXISTS=false
if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
  TUNNEL_EXISTS=true
  warn "隧道 $TUNNEL_NAME 已存在"
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}' | head -1)
  ok "使用现有隧道 ID: $TUNNEL_ID"
else
  log "创建新隧道: $TUNNEL_NAME"
  TUNNEL_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
  TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP 'Created tunnel \K[^\s]+' || echo "$TUNNEL_NAME")
  if [ -z "$TUNNEL_ID" ] || [ "$TUNNEL_ID" = "$TUNNEL_NAME" ]; then
    # 尝试从列表获取
    TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}' | head -1)
  fi
  ok "隧道已创建: $TUNNEL_ID"
fi

# 创建配置文件
CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CONFIG_DIR/config.yml"
mkdir -p "$CONFIG_DIR"

log "创建配置文件: $CONFIG_FILE"

# 获取隧道 ID（如果还没有）
if [ -z "${TUNNEL_ID:-}" ]; then
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}' | head -1)
fi

# 检查凭证文件是否存在
CREDENTIALS_FILE="$CONFIG_DIR/$TUNNEL_ID.json"
if [ ! -f "$CREDENTIALS_FILE" ]; then
  warn "凭证文件不存在: $CREDENTIALS_FILE"
  echo "请确保已正确登录 Cloudflare"
fi

# 创建配置文件（使用 Cloudflare 免费域名，不需要 hostname）
cat > "$CONFIG_FILE" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CREDENTIALS_FILE

ingress:
  - service: http://localhost:$LOCAL_PORT
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
echo "配置文件: $CONFIG_FILE"
echo ""

# 显示下一步操作
echo "=========================================="
log "下一步操作"
echo "=========================================="
echo ""

echo "1. 启动隧道（开发测试）："
echo "   cloudflared tunnel run $TUNNEL_NAME"
echo ""
echo "   启动后会显示类似以下信息："
echo "   +--------------------------------------------------------------------------------------------+"
echo "   |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |"
echo "   |  https://xxxx-xxxx-xxxx.trycloudflare.com                                                 |"
echo "   +--------------------------------------------------------------------------------------------+"
echo ""

echo "2. 或作为服务运行（生产环境，后台运行）："
echo "   sudo cloudflared service install"
echo "   sudo cloudflared service start"
echo ""

echo "3. 获取公共 URL："
echo "   启动隧道后，会显示一个 Cloudflare 免费域名 URL"
echo "   格式类似：https://xxxx-xxxx-xxxx.trycloudflare.com"
echo "   这个 URL 就是你的公共访问地址"
echo ""

echo "4. 在 Vercel Production 环境变量中配置："
echo "   USE_LOCAL_AI=true"
echo "   LOCAL_AI_SERVICE_URL=https://xxxx-xxxx-xxxx.trycloudflare.com"
echo "   LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345"
echo ""

echo "5. 测试连接："
echo "   curl https://xxxx-xxxx-xxxx.trycloudflare.com/healthz"
echo ""

echo "=========================================="
ok "准备就绪，可以启动隧道了"
echo "=========================================="

