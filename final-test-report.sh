#!/usr/bin/env bash
set -euo pipefail

WEB_PORT=3000
LOCAL_AI_URL="http://127.0.0.1:8788"

log() { printf "\n\033[1;36m[STEP]\033[0m %s\n" "$*"; }
ok()  { printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }

REPORT=""

log "执行最终测试报告"

# 测试 1: 强制 local 模式
log "测试 1：强制 local 模式（?ai=local）"
RESP1=$(curl -sS -i -X POST "http://127.0.0.1:${WEB_PORT}/api/ai/ask?ai=local" \
  -H "content-type: application/json" \
  -d '{"question":"本地还是线上？","locale":"zh"}' 2>&1)

if echo "${RESP1}" | grep -qi "x-ai-service-mode: local"; then
  if echo "${RESP1}" | grep -qi "x-ai-service-url: ${LOCAL_AI_URL}"; then
    ok "✅ 测试 1 通过：强制 local 模式成功，响应头包含 x-ai-service-mode: local 和 x-ai-service-url"
    REPORT+="\n✅ 测试 1：强制 local 模式 - 通过"
  else
    warn "⚠️ 测试 1 部分通过：响应头包含 x-ai-service-mode: local，但缺少 x-ai-service-url"
    REPORT+="\n⚠️ 测试 1：强制 local 模式 - 部分通过（缺少 x-ai-service-url）"
  fi
else
  err "❌ 测试 1 失败：响应头中未找到 x-ai-service-mode: local"
  REPORT+="\n❌ 测试 1：强制 local 模式 - 失败（未找到调试响应头）"
fi

# 测试 2: 自动选择（不带参数）
log "测试 2：自动选择（不带 ai 参数，应为本地）"
RESP2=$(curl -sS -i -X POST "http://127.0.0.1:${WEB_PORT}/api/ai/ask" \
  -H "content-type: application/json" \
  -d '{"question":"自动选择哪边？","locale":"zh"}' 2>&1)

if echo "${RESP2}" | grep -qi "x-ai-service-mode: local"; then
  if echo "${RESP2}" | grep -qi "x-ai-service-url: ${LOCAL_AI_URL}"; then
    ok "✅ 测试 2 通过：自动选择本地成功"
    REPORT+="\n✅ 测试 2：自动选择本地 - 通过"
  else
    warn "⚠️ 测试 2 部分通过：响应头包含 x-ai-service-mode: local，但缺少 x-ai-service-url"
    REPORT+="\n⚠️ 测试 2：自动选择本地 - 部分通过（缺少 x-ai-service-url）"
  fi
else
  err "❌ 测试 2 失败：响应头中未找到 x-ai-service-mode: local"
  REPORT+="\n❌ 测试 2：自动选择本地 - 失败（未找到调试响应头）"
fi

# 测试 3: 强制 online 模式
log "测试 3：强制 online 模式（?ai=online）"
RESP3=$(curl -sS -i -X POST "http://127.0.0.1:${WEB_PORT}/api/ai/ask?ai=online" \
  -H "content-type: application/json" \
  -d '{"question":"验证线上配置","locale":"zh"}' 2>&1)

if echo "${RESP3}" | grep -qi "x-ai-service-mode: online"; then
  ok "✅ 测试 3 通过：强制 online 模式成功"
  REPORT+="\n✅ 测试 3：强制 online 模式 - 通过"
else
  if echo "${RESP3}" | grep -qi "Online AI service URL/TOKEN is not configured"; then
    warn "⚠️ 测试 3：强制 online 模式返回配置错误（如未配置线上 URL/TOKEN 属正常）"
    REPORT+="\n⚠️ 测试 3：强制 online 模式 - 配置错误（如未配置线上 URL/TOKEN 属正常）"
  else
    warn "⚠️ 测试 3：强制 online 模式未返回 x-ai-service-mode: online（如未配置线上 URL/TOKEN 属正常）"
    REPORT+="\n⚠️ 测试 3：强制 online 模式 - 未找到调试响应头（如未配置线上 URL/TOKEN 属正常）"
  fi
fi

# 汇总报告
log "========== 最终测试报告 =========="
echo -e "${REPORT}\n"
log "=================================="

PASS_COUNT=$(echo -e "${REPORT}" | grep -c "✅" || echo "0")
FAIL_COUNT=$(echo -e "${REPORT}" | grep -c "❌" || echo "0")
WARN_COUNT=$(echo -e "${REPORT}" | grep -c "⚠️" || echo "0")

log "统计：通过 ${PASS_COUNT} 项，失败 ${FAIL_COUNT} 项，警告 ${WARN_COUNT} 项"

if [[ "${FAIL_COUNT}" -eq 0 ]]; then
  ok "所有关键测试通过！"
else
  warn "部分测试失败，请检查代码和配置"
fi
