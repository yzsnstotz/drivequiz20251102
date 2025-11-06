#!/usr/bin/env bash
# ============================================================
# 直接测试 /api/ai/ask 路由（设置好环境变量后运行）
# 使用方法：
#   export VERCEL_URL="你的预览URL"
#   export USER_JWT="你的JWT token"
#   ./scripts/test-ai-ask-direct.sh
# ============================================================

set -euo pipefail

VERCEL_URL="${VERCEL_URL:-}"
USER_JWT="${USER_JWT:-}"

if [ -z "$VERCEL_URL" ]; then
  echo "❌ 错误: 请设置 VERCEL_URL 环境变量"
  echo "   例如: export VERCEL_URL='https://xxx.vercel.app'"
  exit 1
fi

if [ -z "$USER_JWT" ]; then
  echo "❌ 错误: 请设置 USER_JWT 环境变量"
  exit 1
fi

COOKIE_FILE="./vercel.cookies"

echo "=== 测试 POST /api/ai/ask ==="
echo ""
echo "→ 测试 1: 中文问题"
echo "   URL: $VERCEL_URL/api/ai/ask"
echo "   Question: 日本的限速是多少？"
echo ""

HTTP_CODE=$(curl -s -o /tmp/response1.json -w "%{http_code}" -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{"question":"日本的限速是多少？","locale":"zh-CN"}')

echo "   HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ 成功"
  cat /tmp/response1.json | jq '.' 2>/dev/null || cat /tmp/response1.json
else
  echo "   ❌ 失败"
  cat /tmp/response1.json
fi

echo ""
echo "→ 测试 2: 日文问题"
echo "   URL: $VERCEL_URL/api/ai/ask"
echo "   Question: 日本の限速は？"
echo ""

HTTP_CODE=$(curl -s -o /tmp/response2.json -w "%{http_code}" -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{"question":"日本の限速は？","locale":"ja"}')

echo "   HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ 成功"
  cat /tmp/response2.json | jq '.' 2>/dev/null || cat /tmp/response2.json
else
  echo "   ❌ 失败"
  cat /tmp/response2.json
fi

echo ""
echo "=== 测试完成 ==="

