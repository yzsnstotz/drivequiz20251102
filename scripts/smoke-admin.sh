#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
TOKEN="${2:-}"
if [ -z "$TOKEN" ]; then
  echo "Usage: scripts/smoke-admin.sh <base_url> <admin_token>"
  exit 1
fi
echo "→ GET $BASE/api/admin/ping"
curl -sS "$BASE/api/admin/ping" -H "Authorization: Bearer $TOKEN" | jq .
echo "→ GET $BASE/api/admin/users?limit=1"
curl -sS "$BASE/api/admin/users?limit=1" -H "Authorization: Bearer $TOKEN" | jq .
echo "OK"

