#!/usr/bin/env bash

set -euo pipefail

LOCAL_AI_URL="${LOCAL_AI_SERVICE_URL:-http://127.0.0.1:8788}"
LOCAL_AI_TOKEN="${LOCAL_AI_SERVICE_TOKEN:-local_ai_token_dev_12345}"

log(){ printf "\033[1;36m[TEST]\033[0m %s\n" "$*"; }
ok(){ printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[FAIL]\033[0m %s\n" "$*"; }

echo "=========================================="
echo "语言检测测试"
echo "=========================================="
echo ""

# 测试1：中文问题
log "测试1：中文问题 '你好'"
response=$(curl -sS -X POST "${LOCAL_AI_URL}/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LOCAL_AI_TOKEN}" \
  -d '{"question":"你好","userId":"test"}')

lang=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('lang', 'N/A'))" 2>/dev/null || echo "N/A")
answer=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('answer', 'N/A')[:50])" 2>/dev/null || echo "N/A")

echo "检测到的语言: $lang"
echo "回答预览: $answer"
if echo "$answer" | grep -q "[\u4E00-\u9FAF]"; then
  ok "回答包含中文字符"
else
  err "回答不包含中文字符（可能用其他语言回复）"
fi
echo ""

# 测试2：英文问题
log "测试2：英文问题 'how fast could you drive in Japan for highways'"
response=$(curl -sS -X POST "${LOCAL_AI_URL}/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LOCAL_AI_TOKEN}" \
  -d '{"question":"how fast could you drive in Japan for highways","userId":"test"}')

lang=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('lang', 'N/A'))" 2>/dev/null || echo "N/A")
answer=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('answer', 'N/A')[:50])" 2>/dev/null || echo "N/A")

echo "检测到的语言: $lang"
echo "回答预览: $answer"
if echo "$answer" | grep -qE "^[a-zA-Z\s.,!?'\"-]+$"; then
  ok "回答主要是英文字符"
else
  warn "回答包含非英文字符（可能用其他语言回复）"
fi
echo ""

# 测试3：日文问题
log "测试3：日文问题 'こんにちは'"
response=$(curl -sS -X POST "${LOCAL_AI_URL}/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LOCAL_AI_TOKEN}" \
  -d '{"question":"こんにちは","userId":"test"}')

lang=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('lang', 'N/A'))" 2>/dev/null || echo "N/A")
answer=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('answer', 'N/A')[:50])" 2>/dev/null || echo "N/A")

echo "检测到的语言: $lang"
echo "回答预览: $answer"
if echo "$answer" | grep -qE "[\u3040-\u309F\u30A0-\u30FF]"; then
  ok "回答包含日文字符"
else
  warn "回答不包含日文字符（可能用其他语言回复）"
fi
echo ""

echo "=========================================="
ok "测试完成"
echo "=========================================="


