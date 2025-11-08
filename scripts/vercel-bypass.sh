#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <BASE_URL> <VERCEL_BYPASS_TOKEN>"
  exit 1
fi

BASE_URL="$1"
TOKEN="$2"
COOKIES_FILE="$(mktemp)"
trap 'rm -f "$COOKIES_FILE"' EXIT

echo "→ Set bypass cookie..."
curl -sS -i -c "$COOKIES_FILE" \
  "${BASE_URL}/api/admin/ping?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${TOKEN}" >/dev/null || true

echo "→ Verify cookie works..."
RESP="$(curl -sS -i -b "$COOKIES_FILE" "${BASE_URL}/api/admin/ping")"
STATUS="$(printf "%s" "$RESP" | head -n1 | awk '{print $2}')"

if printf "%s" "$RESP" | grep -qi "<title>Authentication Required</title>"; then
  echo "✖ Cookie not accepted. Still blocked by Vercel Authentication (status ${STATUS})."
  exit 2
fi

echo "✔ Bypass cookie seems accepted (status ${STATUS})."
echo "Cookies saved in: $COOKIES_FILE"

