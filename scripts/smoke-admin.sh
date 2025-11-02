#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <BASE_URL> <ADMIN_TOKEN> [--bypass <VERCEL_BYPASS_TOKEN>]"
  exit 1
fi

BASE_URL="$1"
ADMIN_TOKEN="$2"
BYPASS_TOKEN=""

shift 2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bypass)
      BYPASS_TOKEN="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

COOKIES_FILE="$(mktemp)"
cleanup() { rm -f "$COOKIES_FILE"; }
trap cleanup EXIT

# 如果提供了 bypass token，先种 cookie
if [[ -n "${BYPASS_TOKEN}" ]]; then
  echo "→ Set Vercel bypass cookie..."
  curl -sS -c "$COOKIES_FILE" \
    "${BASE_URL}/api/admin/ping?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${BYPASS_TOKEN}" >/dev/null || true
fi

echo "→ GET ${BASE_URL}/api/admin/ping"
RESP="$(curl -sS -i ${BYPASS_TOKEN:+-b "$COOKIES_FILE"} \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BASE_URL}/api/admin/ping")"

STATUS="$(printf "%s" "$RESP" | head -n1 | awk '{print $2}')"
BODY="$(printf "%s" "$RESP" | sed -n '/^\r\?$/{:a;n;p;ba};1,1d')"

# 判定是否被 Vercel Auth 拦截（HTML）
if printf "%s" "$BODY" | grep -qi "<title>Authentication Required</title>"; then
  echo "✖ Still seeing Vercel Authentication HTML (status ${STATUS})."
  echo "  → 说明该环境仍开启了 Vercel Authentication，或 bypass token 无效/未生效。"
  exit 3
fi

# 尝试解析 JSON（若 jq 不在则跳过）
if command -v jq >/dev/null 2>&1; then
  OK="$(printf "%s" "$BODY" | jq -r '.ok' 2>/dev/null || true)"
  if [[ "$OK" == "true" ]]; then
    echo "✔ Admin ping passed."
    exit 0
  fi
fi

# 兜底输出
echo "$RESP"
exit 0
