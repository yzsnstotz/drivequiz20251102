#!/usr/bin/env bash

set -euo pipefail

LOCAL_PORT="${1:-8788}"
NGROK_AUTH_TOKEN="${NGROK_AUTH_TOKEN:-}"

log(){ printf "\033[1;36m[INFO]\033[0m %s\n" "$*"; }
ok(){ printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }

echo "=========================================="
echo "ngrok 本地服务暴露工具"
echo "=========================================="
echo ""

# 检查 ngrok 是否安装
if ! command -v ngrok >/dev/null 2>&1; then
  err "ngrok 未安装"
  echo ""
  echo "安装方法："
  echo "  macOS: brew install ngrok"
  echo "  或访问: https://ngrok.com/download"
  exit 1
fi

ok "ngrok 已安装"

# 检查是否已配置 authtoken
if [ -n "$NGROK_AUTH_TOKEN" ]; then
  log "使用环境变量中的 authtoken"
  ngrok config add-authtoken "$NGROK_AUTH_TOKEN" >/dev/null 2>&1 || true
elif ! ngrok config check >/dev/null 2>&1; then
  warn "ngrok 未配置 authtoken"
  echo ""
  echo "请执行以下步骤："
  echo "1. 访问 https://ngrok.com 注册账号"
  echo "2. 获取 authtoken"
  echo "3. 运行: ngrok config add-authtoken YOUR_AUTH_TOKEN"
  echo ""
  read -p "是否现在配置 authtoken? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入 authtoken: " token
    ngrok config add-authtoken "$token"
    ok "authtoken 已配置"
  else
    err "需要配置 authtoken 才能继续"
    exit 1
  fi
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

# 启动 ngrok
log "启动 ngrok，暴露端口 $LOCAL_PORT"
echo ""
echo "ngrok 将创建一个公共 URL，格式类似："
echo "  https://abc123.ngrok-free.app"
echo ""
echo "按 Ctrl+C 停止 ngrok"
echo ""

# 启动 ngrok
ngrok http "$LOCAL_PORT"

