#!/usr/bin/env bash
# ============================================================
# Vercel API 路由验证脚本
# 用途: 验证 /api/_debug-alive 和 /api/ai/ask 是否正常工作
# ============================================================

set -euo pipefail

VERCEL_URL="${VERCEL_URL:-}"
VERCEL_BYPASS="${VERCEL_BYPASS:-}"
USER_JWT="${USER_JWT:-}"

if [ -z "$VERCEL_URL" ]; then
  echo "错误: 请设置 VERCEL_URL 环境变量"
  exit 1
fi

if [ -z "$VERCEL_BYPASS" ]; then
  echo "警告: 未设置 VERCEL_BYPASS，可能无法访问受保护的预览环境"
fi

COOKIE_FILE="./vercel.cookies"

# 重新种 bypass cookie（防止 cookie 过期）
echo "→ 设置 Vercel bypass cookie..."
if [ -n "$VERCEL_BYPASS" ]; then
  curl -sI "$VERCEL_URL/?x-vercel-protection-bypass=$VERCEL_BYPASS&x-vercel-set-bypass-cookie=true" -c "$COOKIE_FILE" > /dev/null
  echo "✓ Cookie 已设置"
else
  echo "⚠ 跳过 cookie 设置（未提供 VERCEL_BYPASS）"
fi

echo ""
echo "=== 步骤 1: 验证 App Router 活性 ==="
echo "→ GET /api/_debug-alive"
HTTP_CODE=$(curl -sI "$VERCEL_URL/api/_debug-alive" -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ HTTP 200 - App Router 正常工作"
  curl -s "$VERCEL_URL/api/_debug-alive" -b "$COOKIE_FILE" | jq '.' 2>/dev/null || curl -s "$VERCEL_URL/api/_debug-alive" -b "$COOKIE_FILE"
else
  echo "✗ HTTP $HTTP_CODE - App Router 可能未正常工作"
  curl -sI "$VERCEL_URL/api/_debug-alive" -b "$COOKIE_FILE" | sed -n '1,12p'
fi

echo ""
echo "=== 步骤 2: 验证 /api/ai/ask GET（调试模式） ==="
echo "→ GET /api/ai/ask"
HTTP_CODE=$(curl -sI "$VERCEL_URL/api/ai/ask" -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ HTTP 200 - 路由已匹配（DEBUG_API_ASK=1 已启用）"
  curl -s "$VERCEL_URL/api/ai/ask" -b "$COOKIE_FILE" | jq '.' 2>/dev/null || curl -s "$VERCEL_URL/api/ai/ask" -b "$COOKIE_FILE"
elif [ "$HTTP_CODE" = "405" ]; then
  echo "✓ HTTP 405 - 路由已匹配（DEBUG_API_ASK 未启用，这是正常的）"
  curl -sI "$VERCEL_URL/api/ai/ask" -b "$COOKIE_FILE" | sed -n '1,12p'
else
  echo "✗ HTTP $HTTP_CODE - 路由可能未匹配"
  curl -sI "$VERCEL_URL/api/ai/ask" -b "$COOKIE_FILE" | sed -n '1,12p'
fi

echo ""
echo "=== 步骤 3: 验证 /api/ai/ask POST（真实调用） ==="
if [ -z "$USER_JWT" ]; then
  echo "⚠ 跳过 POST 测试（未提供 USER_JWT）"
  echo "   如需测试，请运行:"
  echo "   curl -X POST \"$VERCEL_URL/api/ai/ask?token=\$USER_JWT\" \\"
  echo "     -H \"Content-Type: application/json\" \\"
  echo "     -b ./vercel.cookies \\"
  echo "     -d '{\"question\":\"日本的限速是多少？\"}' -i"
else
  echo "→ POST /api/ai/ask"
  HTTP_CODE=$(curl -s -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d '{"question":"日本的限速是多少？"}' \
    -o /dev/null -w "%{http_code}")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ HTTP 200 - POST 请求成功"
    curl -s -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_FILE" \
      -d '{"question":"日本的限速是多少？"}' | jq '.' 2>/dev/null || \
    curl -s -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_FILE" \
      -d '{"question":"日本的限速是多少？"}'
  else
    echo "✗ HTTP $HTTP_CODE - POST 请求失败"
    curl -i -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_FILE" \
      -d '{"question":"日本的限速是多少？"}' | head -20
  fi
fi

echo ""
echo "=== 验证完成 ==="

