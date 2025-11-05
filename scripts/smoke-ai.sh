#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ZALEM AI 问答模块集成测试脚本（Render 版）
# 文件名: smoke-ai.sh
# 用途: 一键验证核心路由返回 200
# ============================================================

BASE_URL="${1:?Main site base url (Vercel)}"
AI_SERVICE_URL="${2:?AI service base url (Render, e.g. https://xxx.onrender.com)}"
ADMIN_TOKEN="${3:?Admin JWT}"
USER_TOKEN="${4:?User JWT}"
AI_SERVICE_TOKEN="${5:?Service token}"

echo "→ Ping /healthz"
curl -fsS "$AI_SERVICE_URL/healthz" > /dev/null

echo "→ /v1/ask (service token)"
curl -fsS -X POST "$AI_SERVICE_URL/v1/ask" \
  -H "Authorization: Bearer $AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"テスト","locale":"ja"}' | jq '.ok' | grep true

echo "→ /api/ai/ask (user)"
curl -fsS -X POST "$BASE_URL/api/ai/ask" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"测试","locale":"zh-CN"}' | jq '.ok' | grep true

echo "→ /api/admin/ai/logs (admin)"
curl -fsS "$BASE_URL/api/admin/ai/logs?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.ok' | grep true

echo "→ /api/admin/ai/filters (create)"
curl -fsS -X POST "$BASE_URL/api/admin/ai/filters" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"type":"not-driving","pattern":"(?i)股票|恋爱"}]}' | jq '.ok' | grep true

echo "→ /api/admin/ai/rag/docs (create)"
curl -fsS -X POST "$BASE_URL/api/admin/ai/rag/docs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Road Law","url":"https://example.com/law","lang":"ja"}' | jq '.ok' | grep true

echo "→ /v1/admin/daily-summary (service token)"
TODAY=$(date -u +"%Y-%m-%d")
curl -fsS "$AI_SERVICE_URL/v1/admin/daily-summary?date=$TODAY" \
  -H "Authorization: Bearer $AI_SERVICE_TOKEN" | jq '.ok' | grep true

echo "✔ Smoke done."


