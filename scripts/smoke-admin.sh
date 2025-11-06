#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 BASE_URL ADMIN_TOKEN [--bypass BYPASS_TOKEN]
Example:
  $0 "https://drivequiz.example.vercel.app" "Aa123456"
  $0 "https://drivequiz.example.vercel.app" "Aa123456" --bypass "dgo9MHSP..."
EOF
  exit 1
}

if [ $# -lt 2 ]; then
  usage
fi

BASE="$1"
ADMIN_TOKEN="$2"
BYPASS_TOKEN=""
shift 2

while [ $# -gt 0 ]; do
  case "$1" in
    --bypass)
      BYPASS_TOKEN="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1"
      usage
      ;;
  esac
done

API_PING="${BASE%/}/api/admin/ping"
TMP_DIR=$(mktemp -d)
COOKIE_JAR="${TMP_DIR}/vercel_cookies.txt"
LOGFILE="logs/smoke-admin-$(date +%Y%m%d-%H%M%S).log"

mkdir -p logs

echo "→ Request URL: $API_PING"
echo "→ Cookie jar: $COOKIE_JAR"
echo "→ Log file: $LOGFILE"

# Build curl args
CURL_ARGS=(-sS -D - -o -) # -D - prints response headers to stdout with body separated; -o - body to stdout
# Follow redirects and keep cookies
CURL_ARGS+=(-L --max-redirs 10 --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR")
# Timeout
CURL_ARGS+=(--connect-timeout 10 --max-time 30)

# Authorization header if provided
if [ -n "$ADMIN_TOKEN" ]; then
  CURL_ARGS+=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
fi

REQUEST_URL="$API_PING"
if [ -n "$BYPASS_TOKEN" ]; then
  # attach bypass both as query and as cookie header to increase chance
  REQUEST_URL="${API_PING}?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${BYPASS_TOKEN}"
  CURL_ARGS+=(-H "Cookie: x-vercel-protection-bypass=${BYPASS_TOKEN}; x-vercel-set-bypass-cookie=true")
  echo "→ Using bypass token (attached to query and cookie header)."
fi

echo "→ Performing request to: $REQUEST_URL"
# Perform request and capture output
# We capture stdout (headers+body) to variable safely via temp file (avoids subshell issues)
RESP_FILE="${TMP_DIR}/resp.txt"
if ! curl "${CURL_ARGS[@]}" "$REQUEST_URL" > "$RESP_FILE" 2>&1; then
  echo "!!! curl failed. Dumping raw output to $LOGFILE"
  cp "$RESP_FILE" "$LOGFILE"
  cat "$LOGFILE"
  exit 10
fi

# Split headers and body: find first blank line
HEADER_LINES=$(awk 'BEGIN{h=1} { if(h){print; if($0=="") h=0 } }' "$RESP_FILE" || true)
BODY=$(awk 'BEGIN{h=1} { if(h && $0==""){h=0; next} if(!h) print }' "$RESP_FILE" || true)

# normalize CR
BODY=$(printf '%s' "$BODY" | tr -d '\r')

# Save to log
{
  echo "===== REQUEST: $REQUEST_URL"
  echo "===== HEADERS (first 80 lines):"
  printf '%s\n' "$HEADER_LINES" | sed -n '1,80p'
  echo "===== BODY (first 200 lines or first 20 lines):"
  printf '%s\n' "$BODY" | sed -n '1,200p'
  echo
} >> "$LOGFILE"

# Print short diagnostics to console
echo "---- Headers (truncated) ----"
printf '%s\n' "$HEADER_LINES" | sed -n '1,40p'
echo "---- /HEADERS ----"

if printf '%s' "$BODY" | grep -qi "<!doctype html\|Authentication Required\|Vercel Authentication"; then
  echo "!!! Detected HTML response -> likely Vercel deployment protection or SSO active."
  echo "See full log: $LOGFILE"
  exit 2
fi

if [ -z "$BODY" ]; then
  echo "Empty body returned. See $LOGFILE"
  exit 3
fi

if command -v jq >/dev/null 2>&1; then
  echo "→ Parsing JSON with jq:"
  printf '%s\n' "$BODY" | jq .
else
  echo "→ jq not installed; printing raw body (truncated):"
  printf '%s\n' "$BODY" | sed -n '1,200p'
fi

echo "→ Saved full exchange to $LOGFILE"
echo "→ smoke-admin.sh finished successfully."

# Clean up cookie jar (optional: keep for debugging)
# rm -f "$COOKIE_JAR"
# rmdir "$TMP_DIR"

exit 0
