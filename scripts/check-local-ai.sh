#!/usr/bin/env bash

set -euo pipefail

LOCAL_AI_URL="${LOCAL_AI_SERVICE_URL:-http://127.0.0.1:8788}"
LOCAL_AI_TOKEN="${LOCAL_AI_SERVICE_TOKEN:-local_ai_token_dev_12345}"

log(){ printf "\033[1;36m[INFO]\033[0m %s\n" "$*"; }
ok(){ printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }

echo "=========================================="
echo "本地 AI 服务状态检查"
echo "=========================================="
echo ""

# 1. 检查健康检查端点
log "1. 检查健康检查端点: ${LOCAL_AI_URL}/healthz"
if response=$(curl -sS -m 5 "${LOCAL_AI_URL}/healthz" 2>&1); then
  if echo "$response" | grep -q '"ok":true'; then
    ok "服务正在运行"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
  else
    warn "服务响应异常: $response"
  fi
else
  err "无法连接到服务"
  echo "可能的原因："
  echo "  - 服务未启动"
  echo "  - 端口被占用"
  echo "  - URL 配置错误"
  exit 1
fi

echo ""

# 2. 检查端口是否被占用
log "2. 检查端口占用情况"
if command -v lsof >/dev/null 2>&1; then
  port=$(echo "$LOCAL_AI_URL" | sed 's/.*://')
  if lsof -i ":$port" >/dev/null 2>&1; then
    ok "端口 $port 已被占用"
    lsof -i ":$port" | head -3
  else
    warn "端口 $port 未被占用"
  fi
elif command -v netstat >/dev/null 2>&1; then
  port=$(echo "$LOCAL_AI_URL" | sed 's/.*://')
  if netstat -an | grep -q ":$port"; then
    ok "端口 $port 已被占用"
  else
    warn "端口 $port 未被占用"
  fi
else
  warn "无法检查端口占用（需要 lsof 或 netstat）"
fi

echo ""

# 3. 测试 API 端点
log "3. 测试 API 端点: ${LOCAL_AI_URL}/v1/ask"
test_response=$(curl -sS -m 10 -X POST "${LOCAL_AI_URL}/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LOCAL_AI_TOKEN}" \
  -d '{
    "question": "测试问题",
    "lang": "zh"
  }' 2>&1)

if echo "$test_response" | grep -q '"ok":true'; then
  ok "API 端点测试成功"
  echo "$test_response" | jq '.data.answer' 2>/dev/null || echo "$test_response" | head -5
elif echo "$test_response" | grep -q "401\|Unauthorized"; then
  warn "认证失败，请检查 LOCAL_AI_SERVICE_TOKEN"
elif echo "$test_response" | grep -q "404\|Not Found"; then
  warn "端点不存在，请检查路由配置"
else
  warn "API 端点测试失败: $test_response"
fi

echo ""

# 4. 检查环境变量
log "4. 检查环境变量配置"
if [ -n "${USE_LOCAL_AI:-}" ]; then
  ok "USE_LOCAL_AI=$USE_LOCAL_AI"
else
  warn "USE_LOCAL_AI 未设置（将使用默认值 false）"
fi

if [ -n "${LOCAL_AI_SERVICE_URL:-}" ]; then
  ok "LOCAL_AI_SERVICE_URL=$LOCAL_AI_SERVICE_URL"
else
  warn "LOCAL_AI_SERVICE_URL 未设置（将使用默认值 http://127.0.0.1:8788）"
fi

if [ -n "${LOCAL_AI_SERVICE_TOKEN:-}" ]; then
  ok "LOCAL_AI_SERVICE_TOKEN=***（已设置）"
else
  warn "LOCAL_AI_SERVICE_TOKEN 未设置（将使用默认值）"
fi

echo ""
echo "=========================================="
ok "检查完成"
echo "=========================================="

