#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"

echo "== Vehicles list =="
curl -fsS "$BASE/api/vehicles?page=2&limit=8&sortBy=price&order=asc" | jq '.ok, .pagination'

echo "== Vehicles detail 404 =="
curl -fsS "$BASE/api/vehicles/999999" | jq '.ok, .errorCode'

echo "== Services list (inspection) =="
curl -fsS "$BASE/api/services?category=inspection&page=1" | jq '.ok, .pagination.total'

echo "== Profile ja =="
curl -fsS -X PUT "$BASE/api/profile" -H "Content-Type: application/json" -d '{"language":"ja"}' | jq '.ok'
curl -fsS "$BASE/api/profile" | jq '.data.language'

echo "== Ads slot license_top =="
curl -fsS "$BASE/api/ads?position=license_top" | jq '.ok, .data.title'

echo "== Exam provisional =="
curl -fsS "$BASE/api/exam/provisional?licenseType=regular&page=1&limit=10" | jq '.ok, .pagination'

