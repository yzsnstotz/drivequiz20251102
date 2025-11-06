#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ZALEM AI 问答模块集成测试脚本（Render 版 + Vercel Bypass）
# 文件名: smoke-ai-with-bypass.sh
# 用途: 一键验证核心路由返回 200（支持 Vercel Protection bypass）
# ============================================================

BASE_URL="${1:?Main site base url (Vercel)}"
AI_SERVICE_URL="${2:?AI service base url (Render, e.g. https://xxx.onrender.com)}"
ADMIN_TOKEN="${3:?Admin JWT}"
USER_TOKEN="${4:?User JWT}"
AI_SERVICE_TOKEN="${5:?Service token}"
VERCEL_BYPASS_TOKEN="${6:-}"  # 可选：Vercel bypass token

# 构建 bypass 参数和 Cookie
if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
  BYPASS_PARAMS="?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN"
  BYPASS_COOKIE="-H 'Cookie: x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN'"
else
  BYPASS_PARAMS=""
  BYPASS_COOKIE=""
fi

echo "→ Ping /healthz"
curl -fsS "$AI_SERVICE_URL/healthz" > /dev/null

echo "→ /v1/ask (service token)"
curl -fsS -X POST "$AI_SERVICE_URL/v1/ask" \
  -H "Authorization: Bearer $AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"テスト","locale":"ja"}' | jq '.ok' | grep true

echo "→ /api/ai/ask (user)"
if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
  curl -fsS -X POST "$BASE_URL/api/ai/ask$BYPASS_PARAMS" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Cookie: x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"question":"测试","locale":"zh-CN"}' | jq '.ok' | grep true
else
  curl -fsS -X POST "$BASE_URL/api/ai/ask" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"question":"测试","locale":"zh-CN"}' | jq '.ok' | grep true
fi

echo "→ /api/admin/ai/logs (admin)"
if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
  curl -fsS "$BASE_URL/api/admin/ai/logs$BYPASS_PARAMS?page=1&limit=10" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Cookie: x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN" | jq '.ok' | grep true
else
  curl -fsS "$BASE_URL/api/admin/ai/logs?page=1&limit=10" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.ok' | grep true
fi

echo "→ /api/admin/ai/filters (create)"
if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
  curl -fsS -X POST "$BASE_URL/api/admin/ai/filters$BYPASS_PARAMS" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Cookie: x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"items":[{"type":"not-driving","pattern":"(?i)股票|恋爱"}]}' | jq '.ok' | grep true
else
  curl -fsS -X POST "$BASE_URL/api/admin/ai/filters" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"items":[{"type":"not-driving","pattern":"(?i)股票|恋爱"}]}' | jq '.ok' | grep true
fi

echo "→ /api/admin/ai/rag/docs (create)"
if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
  curl -fsS -X POST "$BASE_URL/api/admin/ai/rag/docs$BYPASS_PARAMS" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Cookie: x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Road Law","url":"https://example.com/law","lang":"ja"}' | jq '.ok' | grep true
else
  curl -fsS -X POST "$BASE_URL/api/admin/ai/rag/docs" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Road Law","url":"https://example.com/law","lang":"ja"}' | jq '.ok' | grep true
fi

echo "→ /v1/admin/daily-summary (service token)"
TODAY=$(date -u +"%Y-%m-%d")
curl -fsS "$AI_SERVICE_URL/v1/admin/daily-summary?date=$TODAY" \
  -H "Authorization: Bearer $AI_SERVICE_TOKEN" | jq '.ok' | grep true

echo "✔ Smoke done."

