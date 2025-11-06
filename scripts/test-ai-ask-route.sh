#!/usr/bin/env bash

set -euo pipefail



# ===== 基本参数 =====

WEB_DIR="apps/web"

WEB_PORT=3000

ROUTE_PATH="${WEB_DIR}/app/api/ai/ask/route.ts"



LOCAL_AI_DIR="apps/local-ai-service"

LOCAL_AI_PORT=8788

LOCAL_AI_URL="http://127.0.0.1:${LOCAL_AI_PORT}"

LOCAL_AI_TOKEN="local_ai_token_dev_12345"



FPRINT="ask-route-fp-$(date +%s)-$RANDOM" # 本次测试的指纹

REPORT=""

EARLY_PASS=0



log(){ printf "\n\033[1;36m[STEP]\033[0m %s\n" "$*"; }

ok(){ printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }

warn(){ printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }

err(){ printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }



kill_bg() {

  [[ -n "${WEB_PID:-}" ]] && kill ${WEB_PID} >/dev/null 2>&1 || true

  [[ -n "${AI_PID:-}"  ]] && kill ${AI_PID}  >/dev/null 2>&1 || true

}

trap kill_bg EXIT



wait_up() {

  local url="$1" name="$2" tries="${3:-60}"

  for i in $(seq 1 "$tries"); do

    if curl -sS -m 1 -o /dev/null "$url"; then ok "${name} UP: ${url}"; return 0; fi

    sleep 1

  done

  return 1

}



# ===== 0) 基础体检：是否存在路由文件、是否有"另一个 ask"冲突 =====

log "仓库体检（路由/改写/冲突排查）"

if [[ ! -f "$ROUTE_PATH" ]]; then err "未找到 ${ROUTE_PATH}。请确认你的 Next App Router 路径。"; exit 2; fi



# 查找同名路由/旧版 pages api/可能冲突的 chat 路由

echo "— 可能的 /api/ai/* 路由列表："

grep -RIl --include="route.*" "/api/ai/" "${WEB_DIR}/app" || true

echo "— pages api（旧目录）检查："

ls -1 "${WEB_DIR}/pages/api" 2>/dev/null || true

echo "— rewrite/middleware 检查："

[[ -f "${WEB_DIR}/middleware.ts" ]] && sed -n '1,160p' "${WEB_DIR}/middleware.ts" | sed -n '1,60p' || true

[[ -f "next.config.js" ]] && grep -n "rewrites" -n "next.config.js" && sed -n '1,200p' next.config.js | sed -n '1,200p' | grep -n "rewrites" -n || true

[[ -f "vercel.json" ]] && sed -n '1,200p' vercel.json || true



# ===== 1) 注入"不可被忽略"的响应头 & 指纹 & 统一返回工具 =====

log "为 ${ROUTE_PATH} 注入统一响应（含指纹 ${FPRINT}）与调试头（用 options 写入 headers）"

mkdir -p .backup_runbook

cp -f "${ROUTE_PATH}" ".backup_runbook/route.ts.$(date +%s)" || true



# 1.1 若不存在我们的 ENV block，则补齐（避免重复插入）

if ! grep -q "/* AI_ENV_BLOCK_START */" "${ROUTE_PATH}"; then

  perl -0777 -pe '

    BEGIN{$blk = q{

/* AI_ENV_BLOCK_START */

import { config as dotenv } from "dotenv";

import { resolve } from "node:path";



if (process.env.NODE_ENV !== "production") {

  // root .env → root .env.local → web .env → web .env.local(override)

  dotenv({ path: resolve(process.cwd(), ".env") });

  dotenv({ path: resolve(process.cwd(), ".env.local") });

  dotenv({ path: resolve(__dirname, "../../../.env") });

  dotenv({ path: resolve(__dirname, "../../../.env.local"), override: true });

}



function readRaw(key: string, d = "") { const v = process.env[key]; return (typeof v === "string" ? v : d).trim(); }

function readBool(key: string, d = false) { const v = readRaw(key, d ? "true" : "false").toLowerCase(); return v === "1"||v==="true"||v==="yes"||v==="on"; }

function readUrl(key: string, d = "") { const v = readRaw(key, d).replace(/\/+$/, ""); return v; }



const ENV = {

  USE_LOCAL_AI: readBool("USE_LOCAL_AI", false),

  LOCAL_AI_SERVICE_URL: readUrl("LOCAL_AI_SERVICE_URL"),

  LOCAL_AI_SERVICE_TOKEN: readRaw("LOCAL_AI_SERVICE_TOKEN"),

  AI_SERVICE_URL: readUrl("AI_SERVICE_URL"),

  AI_SERVICE_TOKEN: readRaw("AI_SERVICE_TOKEN"),

};



function forceModeFromReq(req: any): "local" | "online" | null {

  const m = req?.nextUrl?.searchParams?.get("ai")?.toLowerCase();

  if (m === "local" || m === "online") return m as any;

  return null;

}

function pickAiTarget(req: any) {

  const forced = forceModeFromReq(req);

  const wantLocal = forced ? forced === "local" : ENV.USE_LOCAL_AI;

  if (wantLocal) {

    if (!ENV.LOCAL_AI_SERVICE_URL) throw new Error("LOCAL_AI_SERVICE_URL is empty while USE_LOCAL_AI=true");

    if (!ENV.LOCAL_AI_SERVICE_TOKEN) throw new Error("LOCAL_AI_SERVICE_TOKEN is empty while USE_LOCAL_AI=true");

    return { mode: "local" as const, url: ENV.LOCAL_AI_SERVICE_URL, token: ENV.LOCAL_AI_SERVICE_TOKEN };

  }

  if (!ENV.AI_SERVICE_URL || !ENV.AI_SERVICE_TOKEN) throw new Error("Online AI service URL/TOKEN is not configured.");

  return { mode: "online" as const, url: ENV.AI_SERVICE_URL, token: ENV.AI_SERVICE_TOKEN };

}



// —— 统一响应工具（保证每条返回都有指纹和调试头）——

import { NextResponse } from "next/server";

const __ROUTE_FPRINT = "FPRINT_PLACEHOLDER";

function respondJSON(body: any, debug: Record<string,string> = {}) {

  return NextResponse.json(body, {

    headers: {

      "x-route-fingerprint": __ROUTE_FPRINT,

      ...debug,

    },

  });

}

/* AI_ENV_BLOCK_END */

  }; }

    s/^((?:import[^\n]*\n)+)/$1$blk/s;

  ' -i "${ROUTE_PATH}"

  # 写入本次指纹

  sed -i '' "s/FPRINT_PLACEHOLDER/${FPRINT}/g" "${ROUTE_PATH}" 2>/dev/null || sed -i "s/FPRINT_PLACEHOLDER/${FPRINT}/g" "${ROUTE_PATH}"

fi



# 1.2 在"发起 fetch 前"统一设置 target/url/token/debugHeaders，避免遗漏

if ! grep -q "/* AI_PICK_START */" "${ROUTE_PATH}"; then

  perl -0777 -pe '

    s|(\/\/\s*==\s*步骤5: 转发请求到AI服务[^\n]*\n)|

$1/* AI_PICK_START */

const __aiTarget = pickAiTarget(req);

const __requestUrl = `${__aiTarget.url}/v1/ask`;

const __debugHeaders = { "x-ai-service-mode": __aiTarget.mode, "x-ai-service-url": __aiTarget.url };

/* AI_PICK_END */

|s

  ' -i "${ROUTE_PATH}" || true

fi



# 1.3 将 fetch 的 Authorization 头强制替换为 __aiTarget.token

perl -0777 -pe 's/"authorization"\s*:\s*`Bearer\s*\$\{[^}]+\}`/"authorization": `Bearer ${__aiTarget.token}`/g' -i "${ROUTE_PATH}" || true

# 1.4 将最终成功返回统一改为 respondJSON（确保头一定带上）

perl -0777 -pe 's/NextResponse\.json\s*\(\s*({\s*ok:\s*true[\s\S]*?})\s*\)/respondJSON($1, __debugHeaders)/g' -i "${ROUTE_PATH}" || true

# 1.5 常见错误返回：替换成 respondJSON（带指纹，即使无 debugHeaders）

perl -0777 -pe 's/NextResponse\.json\s*\(\s*({\s*ok:\s*false[\s\S]*?})\s*\)/respondJSON($1)/g' -i "${ROUTE_PATH}" || true



ok "已注入指纹、debug headers（以 options 写入）、统一 respondJSON"



# ===== 2) 写入 apps/web/.env.local（确保本地优先）=====

log "写入 ${WEB_DIR}/.env.local"

mkdir -p "${WEB_DIR}"

{ grep -vE '^(USE_LOCAL_AI|LOCAL_AI_SERVICE_URL|LOCAL_AI_SERVICE_TOKEN)=' "${WEB_DIR}/.env.local" 2>/dev/null || true; } > "${WEB_DIR}/.env.local.tmp"

cat >> "${WEB_DIR}/.env.local.tmp" <<EOF

USE_LOCAL_AI=true

LOCAL_AI_SERVICE_URL=${LOCAL_AI_URL}

LOCAL_AI_SERVICE_TOKEN=${LOCAL_AI_TOKEN}

EOF

mv "${WEB_DIR}/.env.local.tmp" "${WEB_DIR}/.env.local"

ok "apps/web/.env.local 已设为本地优先"



# ===== 3) 启动本地 AI 与 Web =====

log "启动 Local AI-Service"

( cd "${LOCAL_AI_DIR}" && pnpm dev ) >/tmp/local-ai.log 2>&1 & AI_PID=$!

sleep 2

if ! wait_up "${LOCAL_AI_URL}/health" "Local AI" 10; then

  warn "未检出 /health，尝试直连端口"; wait_up "${LOCAL_AI_URL}" "Local AI" 20 || { err "AI 未启动，查看 /tmp/local-ai.log"; tail -n 80 /tmp/local-ai.log || true; exit 3; }

fi



log "启动 Web (Next.js)"

( cd "${WEB_DIR}" && pnpm dev ) >/tmp/web.log 2>&1 & WEB_PID=$!

sleep 3

wait_up "http://127.0.0.1:${WEB_PORT}" "Web" 60 || { err "Web 未启动，查看 /tmp/web.log"; tail -n 120 /tmp/web.log || true; exit 4; }



# ===== 4) 分步测试（高→低概率），每步成功即早停 =====

call_ask() {

  local url="$1"; local body="$2"

  curl -sS -i -X POST "$url" -H "content-type: application/json" -d "$body" | sed -n '1,60p'

}



# 4.1 强制 local（最短路径验证）

log "测试 4.1：?ai=local（应命中本地 & 带指纹/调试头）"

H1="$(call_ask "http://127.0.0.1:${WEB_PORT}/api/ai/ask?ai=local" '{"question":"probe local","locale":"zh"}')"

echo "$H1" | grep -qi "x-route-fingerprint: ${FPRINT}" && \

echo "$H1" | grep -qi "x-ai-service-mode: local" && \

echo "$H1" | grep -qi "x-ai-service-url: ${LOCAL_AI_URL}" && {

  ok "命中本地 & 指纹/调试头存在"

  REPORT+="\n- ✅ 4.1 强制 local：命中本地，headers 正常。"

  EARLY_PASS=1

} || {

  REPORT+="\n- ❌ 4.1 强制 local：未见指纹或未命中本地。"

  EARLY_PASS=0

}



# 如 4.1 未通过，立即给出"是否命中本文件"的提示线索

if [[ "${EARLY_PASS}" -eq 0 ]]; then

  log "快速鉴别：请求是否命中此 route.ts？（看是否至少有 x-route-fingerprint）"

  if echo "$H1" | grep -qi "x-route-fingerprint: ${FPRINT}"; then

    warn "命中了此 route.ts，但调试头缺失或被覆盖 → 检查返回路径是否绕过 respondJSON。"

  else

    warn "⚠️ 没有 x-route-fingerprint：请求可能被 rewrite / middleware 拦截或走到了另一条路由。"

    echo "建议重点检查："

    echo "  - ${WEB_DIR}/middleware.ts（是否重写 /api/ai/ask）"

    echo "  - next.config.js rewrites（是否把 /api/ai/ask 代理到线上）"

    echo "  - 是否存在另一份 /api/ai/ask（pages api 或其它 app 目录）"

  fi

fi



# 4.2 自动选择（USE_LOCAL_AI=true）

if [[ "${EARLY_PASS}" -eq 1 ]]; then

  log "测试 4.2：自动选择（不带 ai 参数，应命中本地）"

  H2="$(call_ask "http://127.0.0.1:${WEB_PORT}/api/ai/ask" '{"question":"auto select","locale":"zh"}')"

  echo "$H2" | grep -qi "x-route-fingerprint: ${FPRINT}" && \

  echo "$H2" | grep -qi "x-ai-service-mode: local" && \

  echo "$H2" | grep -qi "x-ai-service-url: ${LOCAL_AI_URL}" && {

    ok "自动选择命中本地"

    REPORT+="\n- ✅ 4.2 自动选择：命中本地，headers 正常。"

  } || {

    REPORT+="\n- ❌ 4.2 自动选择：未命中本地（检查 ENV.USE_LOCAL_AI 是否为 true，或是否被强制 online）。"

    EARLY_PASS=0

  }

fi



# 4.3 缺 token 时不回退线上（规范性保护）

if [[ "${EARLY_PASS}" -eq 1 ]]; then

  log "测试 4.3：缺失本地 token 时应显式报错（不应回线上）"

  cp -f "${WEB_DIR}/.env.local" ".backup_runbook/.env.local.$(date +%s)"

  grep -v "^LOCAL_AI_SERVICE_TOKEN=" "${WEB_DIR}/.env.local" > "${WEB_DIR}/.env.local.tmp" || true

  mv "${WEB_DIR}/.env.local.tmp" "${WEB_DIR}/.env.local"

  kill ${WEB_PID} >/dev/null 2>&1 || true

  ( cd "${WEB_DIR}" && pnpm dev ) >/tmp/web.log 2>&1 & WEB_PID=$!

  sleep 3; wait_up "http://127.0.0.1:${WEB_PORT}" "Web" 60



  set +e

  H3="$(call_ask "http://127.0.0.1:${WEB_PORT}/api/ai/ask" '{"question":"missing token","locale":"zh"}')"

  set -e

  if echo "$H3" | grep -qi "LOCAL_AI_SERVICE_TOKEN is empty while USE_LOCAL_AI=true"; then

    ok "缺 token 时显式报错，不回退线上"

    REPORT+="\n- ✅ 4.3 缺 token：显式报错，不回退线上。"

  else

    REPORT+="\n- ❌ 4.3 缺 token：未见明确错误信息，需要检查 pickAiTarget。"

  fi



  # 还原

  echo "LOCAL_AI_SERVICE_TOKEN=${LOCAL_AI_TOKEN}" >> "${WEB_DIR}/.env.local"

  kill ${WEB_PID} >/dev/null 2>&1 || true

  ( cd "${WEB_DIR}" && pnpm dev ) >/tmp/web.log 2>&1 & WEB_PID=$!

  sleep 3; wait_up "http://127.0.0.1:${WEB_PORT}" "Web" 60

fi



# 4.4 强制 online（仅验证开关 & 指纹）

log "测试 4.4：?ai=online（若未配置线上 URL/TOKEN，出现报错属正常）"

H4="$(call_ask "http://127.0.0.1:${WEB_PORT}/api/ai/ask?ai=online" '{"question":"force online","locale":"zh"}')"

if echo "$H4" | grep -qi "x-route-fingerprint: ${FPRINT}"; then

  REPORT+="\n- ✅ 4.4 强制 online：指纹存在，命中了本文件（是否能连上线上由你是否配置决定）。"

else

  REPORT+="\n- ❌ 4.4 强制 online：未见指纹，疑似 rewrite/middleware 拦截。"

fi



# ===== 5) 汇总报告 =====

log "最终报告"

echo -e "${REPORT}\n"



if echo "${REPORT}" | grep -q "❌ 4.1"; then

  warn "核心用例 4.1 未通过：首先确认是否命中此 route.ts（x-route-fingerprint）。"

  echo "=> 若没指纹：请重点检查 ${WEB_DIR}/middleware.ts、next.config.js rewrites、pages api 冲突。"

  echo "=> 若有指纹但无调试头：确认是否所有返回路径均改为 respondJSON（避免某个 early return 仍用 NextResponse.json）。"

elif echo "${REPORT}" | grep -q "❌"; then

  warn "部分检查未通过，请根据上方提示继续修正。"

else

  ok "✅ 结论：已命中本地 AI，选择/回退/可观测性全部正常。"

fi


