#!/usr/bin/env bash
# ping-sitemap.sh — Notify search engines after every production deploy
#
# Usage:
#   ./ping-sitemap.sh
#   npm run ping          (from beam/ directory)
#
# What it does:
#   1. Pings Google's sitemap endpoint (lightweight re-crawl request)
#   2. Submits all sitemap URLs to Bing/Yandex via IndexNow API
#
# Requirements:
#   - INDEXNOW_KEY env var (set in .env or as wrangler secret)
#   - curl
#
# Exit codes:
#   0 — both pings succeeded (HTTP 200 or 202)
#   1 — one or more pings failed

set -euo pipefail

# Keep this aligned with runtime defaults in src/lib/publicUrl.ts unless overridden.
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://beam-privacy.com}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"
HOST="${HOST:-${PUBLIC_BASE_URL#https://}}"
HOST="${HOST#http://}"
SITEMAP_URL="${SITEMAP_URL:-${PUBLIC_BASE_URL}/sitemap.xml}"
INDEXNOW_KEY="${INDEXNOW_KEY:-dde8c8bf4f6edbc168c2e6bab077f439}"

echo "=== Beam Sitemap Ping ==="
echo "Sitemap: $SITEMAP_URL"
echo ""

# ── 1. Google sitemap ping ──────────────────────────────────────────────────
# NOTE: Google deprecated the /ping endpoint in January 2024 (returns 404).
# Submit sitemap manually via Google Search Console:
#   https://search.google.com/search-console/sitemaps
# IndexNow (step 2) covers Bing and Yandex for automated re-crawl requests.
echo "Google ping: deprecated (404). Submit manually via Search Console."
echo "  → https://search.google.com/search-console/sitemaps"
echo ""

# ── 2. IndexNow (Bing / Yandex) ────────────────────────────────────────────
echo "Pinging Bing/Yandex via IndexNow..."

URLS_JSON=$(cat <<'URLS'
[
  "/",
  "/alternatives",
  "/vs/google-analytics",
  "/vs/vercel-analytics",
  "/vs/cloudflare-web-analytics",
  "/vs/plausible",
  "/vs/fathom",
  "/vs/umami",
  "/vs/matomo",
  "/vs/simple-analytics",
  "/vs/rybbit",
  "/signup",
  "/login",
  "/about",
  "/how-it-works",
  "/privacy",
  "/terms",
  "/blog",
  "/blog/cookie-free-analytics-guide",
  "/blog/add-analytics-in-5-minutes",
  "/blog/nextjs-privacy-analytics",
  "/blog/google-analytics-alternatives-2026",
  "/blog/beam-analytics-shutdown-migration-guide",
  "/changelog",
  "/demo",
  "/migrate",
  "/migrate/google-analytics",
  "/migrate/plausible",
  "/migrate/fathom",
  "/migrate/beam-analytics",
  "/migrate/import-history",
  "/beam-analytics-alternative",
  "/docs/api",
  "/for",
  "/wordpress-plugin",
  "/for/nextjs",
  "/for/wordpress",
  "/for/astro",
  "/for/hugo",
  "/for/remix",
  "/for/webflow",
  "/for/shopify",
  "/for/ghost",
  "/for/framer",
  "/for/carrd",
  "/tools/stack-scanner",
  "/switch",
  "/blog/plausible-alternative"
]
URLS
)
URLS_JSON=$(printf '%s\n' "$URLS_JSON" | sed "s#\"/#\"${PUBLIC_BASE_URL}/#g")

INDEXNOW_PAYLOAD=$(printf '{
  "host": "%s",
  "key": "%s",
  "keyLocation": "https://%s/%s.txt",
  "urlList": %s
}' "$HOST" "$INDEXNOW_KEY" "$HOST" "$INDEXNOW_KEY" "$URLS_JSON")

INDEXNOW_STATUS=$(curl -s -o /tmp/indexnow-response.txt -w "%{http_code}" \
  -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "$INDEXNOW_PAYLOAD")

if [[ "$INDEXNOW_STATUS" == "200" || "$INDEXNOW_STATUS" == "202" ]]; then
  echo "  ✓ IndexNow accepted (HTTP $INDEXNOW_STATUS)"
else
  echo "  ✗ IndexNow failed (HTTP $INDEXNOW_STATUS)"
  echo "  Response: $(cat /tmp/indexnow-response.txt 2>/dev/null || echo 'empty')"
  FAILED=1
fi

echo ""

# ── Result ──────────────────────────────────────────────────────────────────
if [[ "${FAILED:-0}" == "1" ]]; then
  echo "=== One or more pings FAILED ==="
  exit 1
else
  echo "=== All pings succeeded ==="
  exit 0
fi
