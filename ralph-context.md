## Last completed
BEAM-247 — Replace CDN Tailwind with self-hosted compiled CSS bundle

## Next up
BEAM-248 (high) — Activation drip email for signups who haven't installed the snippet within 24 hours
- Adds `activation_email_sent_at TEXT` column to users table (new migration file)
- Scheduled job in scheduled.ts: query users where created_at 20–28h ago, no pageviews, email not yet sent
- Email from ralph@keylightdigital.dev with snippet + link to /dashboard/sites/{siteId}/setup
- Follow nexusTrace pattern in scheduled.ts for a third job alongside digests and alerts
- Add unit test in test/*.test.ts verifying activation query logic
- Test endpoint: POST /api/test/activation-drip gated on env.DEV_MODE

## Active issues
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s — wait and retry if smoke tests fail immediately
- PROD SIGNUP RATE LIMIT: 10/hour/IP — prod tests that require signup will fail if run too frequently
- BEAM-225 local smoke tests fail when run in isolation (miniflare signup rate limiting) — pre-existing

## Key decisions this session
- Tailwind v4 uses `@import "tailwindcss"` (not the old directive syntax)
- Tailwind v4 CLI is `@tailwindcss/cli` — separate package from `tailwindcss`
- Compiled CSS embedded as TypeScript const (src/tailwindCss.ts) — avoids Workers static asset routing complexity
- dist/ is gitignored — only src/tailwindCss.ts gets committed
- PRD key: userStories
- Each route file has its own nav()/footer() helper — no shared component
- Blog POSTS array: new posts go at beginning (newest first)
- Migration files: use IF NOT EXISTS, numbered sequentially in migrations/
