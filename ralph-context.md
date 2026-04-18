## Last completed
BEAM-248 — Activation drip email for signups who haven't installed the snippet

## Next up
BEAM-249 (high) — Free plan upgrade nudge at 80% of monthly pageview limit
- On dashboard analytics page: compute current calendar-month pageviews for the site
- Free users at ≥40K pageviews: yellow banner; at ≥50K: red banner
- Pro users never see the banner
- No new DB columns needed
- Smoke test: GET /dashboard/sites/{siteId}/analytics returns 200

## Active issues
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s — wait and retry if smoke tests fail immediately
- PROD SIGNUP RATE LIMIT: 10/hour/IP — prod tests that require signup will fail if run too frequently
- BEAM-225 local smoke tests fail when run in isolation (miniflare signup issue) — pre-existing

## Key decisions this session
- page.evaluate() with relative URL fails if no page.goto() was called first
- Login page text is "Log In" (capital I)
- Tailwind compiled CSS: src/tailwindCss.ts (TypeScript const), dist/ is gitignored
- Migration files: numbered 0001-0017, use IF NOT EXISTS / ALTER TABLE pattern
- PRD key: userStories
- Each route file has its own nav()/footer() — no shared component
- Scheduled.ts jobs use nexusTrace wrapper — follow that pattern for new jobs
