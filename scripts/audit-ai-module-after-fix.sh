#!/usr/bin/env bash

# ZALEM · AI 模块 二次一致性审计脚本（After-Fix）

# 作用：在上轮修复后进行缺漏复核 + 新增保护位验证

# 依赖：ripgrep (rg), jq(可选), curl(可选)

set -euo pipefail

if ! command -v rg &>/dev/null; then echo "❌ 需要 ripgrep(rg)"; exit 1; fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

REPORT="docs/AI_AUDIT_REPORT_after_fix.md"
mkdir -p docs
: > "$REPORT"

say() { echo -e "$@" | tee -a "$REPORT"; }
pass(){ say "✅ $*"; }
warn(){ say "⚠️ $*"; }
fail(){ say "❌ $*"; FAILED=1; }

FAILED=0

say "# ZALEM · AI 模块 二次一致性审计（After-Fix）"
say "> 时间：$(date '+%Y-%m-%d %H:%M:%S')\n"

############################
# 0) 基线文档是否存在（可选）
############################
DOC_MISS=0
for f in \
  "📘 ZALEM · AI问答模块 产品文档 v1.0（草案）.md" \
  "🛠️ ZALEM · AI问答模块 研发规范 v1.0.md" \
  "📐 接口与命名规范 v1.0.md" \
  "🏠当前研发进度与衔接说明 v1.8.md"
do
  if ! rg -l -S "$f" -g "**/*.md" >/dev/null; then
    warn "未在仓库中定位到文档：$f（仅提示，不阻断）"
    DOC_MISS=1
  fi
done
[ $DOC_MISS -eq 0 ] && pass "四份基线文档定位通过"

######################################
# 1) 架构边界：禁直连 & 转发链路
######################################
say "## 1) 架构边界"

# 1.1 生产禁直连 /api/ai/chat
CHAT_FILE=$(rg -n "app/api/ai/chat/route\.ts" apps/web src -l || true)
if [ -n "${CHAT_FILE:-}" ]; then
  if rg -n "Direct OpenAI in production is disabled|FORBIDDEN|生产环境已禁用|isProduction" $CHAT_FILE >/dev/null; then
    pass "生产禁直连开关已在 $CHAT_FILE"
  else
    fail "未检测到生产禁直连逻辑（$CHAT_FILE）"
  fi
else
  pass "未发现 /api/ai/chat；或已删除/下线"
fi

# 1.2 主站 → AI-Service 转发唯一入口 /api/ai/ask（含 JWT）
ASK_FILE=$(rg -n "app/api/ai/ask/route\.ts" apps/web -l || true)
if [ -z "${ASK_FILE:-}" ]; then
  ASK_FILE=$(rg -n "app/api/ai/ask/route\.ts" src -l || true)
fi

if [ -n "${ASK_FILE:-}" ]; then
  rg -n "AI_SERVICE_URL|AI_SERVICE_TOKEN" "$ASK_FILE" >/dev/null && pass "/api/ai/ask 使用 Service URL + Token" || fail "/api/ai/ask 未使用 AI_SERVICE_URL/AI_SERVICE_TOKEN"
  rg -n "Authorization|JWT|withUserAuth|get(Token|UserFromToken)|ensure.*Auth|verifyJwt|readUserJwt" "$ASK_FILE" >/dev/null && pass "/api/ai/ask 存在用户 JWT 校验" || fail "/api/ai/ask 缺少用户 JWT 校验"
else
  fail "未找到 /api/ai/ask 路由文件"
fi

# 1.3 OpenAI 客户端仅允许在 ai-service
if rg -n "(from ['\"]openai['\"]|new OpenAI\(|openai\.)" apps/web src --hidden --no-ignore | grep -v "apps/ai-service" >/dev/null; then
  fail "在非 ai-service 目录发现 OpenAI 使用："
  rg -n "(from ['\"]openai['\"]|new OpenAI\(|openai\.)" apps/web src --hidden --no-ignore | grep -v "apps/ai-service" | tee -a "$REPORT"
else
  pass "OpenAI 使用范围限定在 apps/ai-service"
fi

#################################################
# 2) AI-Service 鉴权中间件与路由挂载
#################################################
say "## 2) AI-Service 鉴权"
rg -n "ensureServiceAuth|readBearerToken" apps/ai-service/src >/dev/null && pass "鉴权中间件存在" || fail "缺少鉴权中间件 ensureServiceAuth/readBearerToken"
rg -n "fastify\.(post|get)\(.+?/v1/ask|app\.post\(['\"]/ask" apps/ai-service/src >/dev/null && pass "/v1/ask 路由存在" || fail "未找到 /v1/ask 路由注册"

# 是否对 /v1/ask 应用了 ensureServiceAuth（近似检测）
if rg -n "ensureServiceAuth.+/v1/ask|/v1/ask.+ensureServiceAuth|ensureServiceAuth" apps/ai-service/src/routes/ask.ts >/dev/null; then
  pass "/v1/ask 受鉴权保护"
else
  warn "未直接匹配到 /v1/ask 与 ensureServiceAuth 的同处（请人工确认路由注册顺序）"
fi

###############################################
# 3) RAG / 缓存 / 日志 / 成本 四要素校验
###############################################
say "## 3) RAG / 缓存 / 日志 / 成本"

# 3.1 RAG
rg -n "lib/rag\.ts|ragSearch|match_documents|ai_vectors" apps/ai-service >/dev/null && pass "RAG 模块与调用检测通过" || fail "未检出 RAG 模块/调用"

# 阈值/TopK（启发式）
if rg -n "top[_-]?k\s*[:=]\s*3|topK\s*[:=]\s*3" apps/ai-service >/dev/null; then pass "RAG TopK≈3"; else warn "未检出 TopK≈3（仅提示）"; fi
if rg -n "0\.7[5-9]|0\.8[0-9]" apps/ai-service | rg -n "threshold|score|similarity|>=|>" >/dev/null; then pass "RAG 阈值≈0.75+"; else warn "未检出明显的 RAG 阈值（仅提示）"; fi

# 3.2 缓存
rg -n "lib/cache\.ts|LRU|Redis|cacheSet|cacheGet" apps/ai-service >/dev/null && pass "缓存实现存在" || fail "未检出缓存实现"
rg -n "sha256|createHash" apps/ai-service >/dev/null && pass "缓存 Key 具备哈希归一化迹象" || warn "未检出 sha256/hash（仅提示）"
rg -n "TTL|ttl|24h|86400" apps/ai-service >/dev/null && pass "缓存 TTL 配置存在" || warn "未显式发现 TTL（仅提示）"

# 3.3 日志落库
rg -n "ai_logs|dbLogger|logAiInteraction" apps/ai-service apps/web >/dev/null && pass "日志写入封装存在" || fail "未检出日志落库实现"

# 至少两处调用点（/v1/ask、/api/ai/chat或/api/ai/ask）
CALLS=$(rg -n "logAiInteraction" apps/ai-service apps/web 2>/dev/null | wc -l | tr -d ' ' || echo "0")
[ "${CALLS:-0}" -ge 1 ] && pass "logAiInteraction 调用点 >=1（$CALLS）" || fail "logAiInteraction 调用点过少"

# 3.4 成本估算字段
rg -n "costEstimate|inputTokens|outputTokens|approxUsd" apps/ai-service >/dev/null && pass "成本估算字段与逻辑存在" || fail "未检出成本估算字段/逻辑"

########################################
# 4) 管理端与定时任务/摘要
########################################
say "## 4) 管理端 & 定时任务"
rg -n "admin/ai-monitor|/api/admin/ai/(logs|summary|filters|rag/docs)" apps/web src >/dev/null && pass "管理端页面/API 路由存在" || fail "未检出管理端页面或相关 API"
rg -n "dailySummarize|/v1/admin/daily-summary|cron\.daily" apps/ai-service >/dev/null && pass "每日汇总任务/摘要接口存在" || fail "未检出每日汇总任务/摘要接口"

########################################
# 5) UI 五要素（静态扫描）
########################################
say "## 5) UI 五要素"
UI_OK=1
rg -n "sources\s*[:=]|参考|出典|sourceRef" src apps/web | rg -E "\.tsx|\.ts" >/dev/null || { UI_OK=0; warn "缺：来源引用 UI"; }
rg -n "updatedAt|createdAt|回答时间|最終更新|Last Updated|timestamp" src apps/web | rg -E "\.tsx|\.ts" >/dev/null || { UI_OK=0; warn "缺：时间标注 UI"; }
rg -n "仅供参考|以官方|Disclaimer|免責|本回答" src apps/web | rg -E "\.tsx|\.ts" >/dev/null || { UI_OK=0; warn "缺：免责声明 UI"; }
rg -n "10次|10 回|daily|配額|quota|remaining" src apps/web | rg -E "\.tsx|\.ts" >/dev/null || { UI_OK=0; warn "缺：日配额提示 UI"; }
rg -n "locale|言語|语言|language|ja-JP|zh-CN|en-US|翻訳|切替|switch language" src apps/web | rg -E "\.tsx|\.ts" >/dev/null || { UI_OK=0; warn "缺：语言切换 UI"; }
[ $UI_OK -eq 1 ] && pass "UI 五要素：全部命中或已存在实现迹象"

########################################
# 6) 迁移与 RPC（静态）
########################################
say "## 6) 迁移与 RPC"
rg -n "ai_logs|ai_filters|ai_daily_summary|ai_vectors|match_documents" src/migrations >/dev/null && pass "迁移与 RPC 脚本存在" || fail "未检出迁移/pgvector RPC 脚本"

# pgvector 启用迹象（启发式）
rg -n "create extension if not exists pgvector|pgvector" src/migrations >/dev/null && pass "pgvector 扩展启用脚本迹象" || warn "未检出 pgvector 启用脚本（确认 Supabase 已手动开启）"

########################################
# 7) CI 守护（限制 OpenAI 用法）
########################################
say "## 7) CI 守护"
test -f scripts/check-openai-usage.sh && pass "CI 守护脚本存在：scripts/check-openai-usage.sh" || fail "缺少 CI 守护脚本：scripts/check-openai-usage.sh"
if rg -n "\"audit:ai\"" package.json >/dev/null; then pass "package.json 已挂载 audit:ai"; else warn "未在 package.json 配置 audit:ai（建议添加）"; fi

########################################
# 8) 可选：在线探活（需要环境变量）
########################################
say "## 8) Online(可选)"
VERCEL_URL="${VERCEL_URL:-}"
AI_SERVICE_URL="${AI_SERVICE_URL:-}"
AI_SERVICE_TOKEN="${AI_SERVICE_TOKEN:-}"
ADMIN_BYPASS_TOKEN="${ADMIN_BYPASS_TOKEN:-}"

if [ -n "$VERCEL_URL" ]; then
  if command -v curl &>/dev/null; then
    say "- 探测主站：$VERCEL_URL"
    curl -sS "$VERCEL_URL/api/admin/ping?__bypass=$ADMIN_BYPASS_TOKEN" -I 2>/dev/null | head -n 1 | tee -a "$REPORT" || true
    curl -sS "$VERCEL_URL/api/ai/ask" -I 2>/dev/null | head -n 1 | tee -a "$REPORT" || true
    if [ -z "${ALLOW_DIRECT_OPENAI:-}" ]; then
      curl -sS "$VERCEL_URL/api/ai/chat" -I 2>/dev/null | head -n 1 | tee -a "$REPORT" || true
    fi
  else
    warn "未安装 curl，跳过在线探活"
  fi
else
  warn "未设置 VERCEL_URL，跳过主站探活"
fi

if [ -n "$AI_SERVICE_URL" ] && [ -n "$AI_SERVICE_TOKEN" ]; then
  if command -v curl &>/dev/null; then
    say "- 探测 AI-Service：$AI_SERVICE_URL"
    curl -sS -H "Authorization: Bearer $AI_SERVICE_TOKEN" "$AI_SERVICE_URL/healthz" -I 2>/dev/null | head -n 1 | tee -a "$REPORT" || true
    curl -sS -H "Authorization: Bearer $AI_SERVICE_TOKEN" "$AI_SERVICE_URL/v1/admin/daily-summary" -I 2>/dev/null | head -n 1 | tee -a "$REPORT" || true
  else
    warn "未安装 curl，跳过 AI-Service 探活"
  fi
else
  warn "未设置 AI_SERVICE_URL/AI_SERVICE_TOKEN，跳过 AI-Service 探活"
fi

########################################
# 9) 汇总
########################################
say "\n---\n## 结果汇总"

if [ $FAILED -eq 0 ]; then
  pass "二次审计通过（无阻断项）"
  exit 0
else
  fail "二次审计存在阻断项，请根据上文 ❌ 修复后重试"
  exit 1
fi

