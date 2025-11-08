#!/usr/bin/env bash
# ============================================================
# 测试 /api/ai/ask 路由
# ============================================================

set -euo pipefail

VERCEL_URL="${VERCEL_URL:-}"
USER_JWT="${USER_JWT:-}"

if [ -z "$VERCEL_URL" ]; then
  echo "错误: 请设置 VERCEL_URL 环境变量"
  exit 1
fi

if [ -z "$USER_JWT" ]; then
  echo "错误: 请设置 USER_JWT 环境变量"
  exit 1
fi

COOKIE_FILE="./vercel.cookies"

echo "=== 测试 POST /api/ai/ask ==="
echo "→ 测试中文问题"
curl -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{"question":"日本的限速是多少？","locale":"zh-CN"}' \
  -i | head -30

echo ""
echo "→ 测试日文问题"
curl -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{"question":"日本の限速は？","locale":"ja"}' \
  -s | jq '.' 2>/dev/null || curl -X POST "$VERCEL_URL/api/ai/ask?token=$USER_JWT" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{"question":"日本の限速は？","locale":"ja"}' \
  -s

echo ""
echo "=== 测试完成 ==="

