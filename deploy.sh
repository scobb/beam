#!/usr/bin/env bash
# deploy.sh — Safe production deploy for Beam
#
# Usage:
#   cd beam && bash deploy.sh
#   npm run deploy     (from beam/ directory)
#
# Steps (in order):
#   1. TypeScript typecheck — fail fast on type errors
#   2. D1 migrations apply --remote — never skip schema migrations
#   3. wrangler deploy — publish updated worker
#   4. (Optional) npm run ping — notify search engines (run separately)
#
# This script ensures migrations are always applied before code deploys.
# Run `npm run deploy:ping` to also ping search engines after deploying.

set -euo pipefail

echo "=== Beam Production Deploy ==="
echo ""

# ── 1. TypeScript typecheck ──────────────────────────────────────────────────
echo "Step 1/3: TypeScript typecheck..."
npm run typecheck
echo "  ✓ TypeScript clean"
echo ""

# ── 2. D1 migrations apply --remote ─────────────────────────────────────────
echo "Step 2/3: Applying D1 migrations to remote database..."
npx wrangler d1 migrations apply beam-db --remote
echo "  ✓ Migrations applied"
echo ""

# ── 3. Wrangler deploy ───────────────────────────────────────────────────────
echo "Step 3/3: Deploying Worker to Cloudflare..."
npx wrangler deploy
echo "  ✓ Worker deployed"
echo ""

echo "=== Deploy complete ==="
echo "Run 'npm run ping' to notify search engines."
