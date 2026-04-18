## Last completed
Self-generation cycle — audited prod, generated BEAM-247 through BEAM-256

## Next up
BEAM-247 (high) — Replace CDN Tailwind with self-hosted compiled CSS bundle
- 62 instances of `<script src="https://cdn.tailwindcss.com">` across 10+ route files
- Simplest approach: compile Tailwind to a minified CSS string, export as TS const, serve from GET /assets/tailwind.css
- Replace all script tags with `<link rel="stylesheet" href="/assets/tailwind.css">`
- Add tailwindcss compilation to build script in package.json

## Active issues
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s — wait and retry if smoke tests fail immediately
- PROD SIGNUP RATE LIMIT: 10/hour/IP — prod tests that require signup will fail if run too frequently

## Key decisions this session
- Self-generation cycle: prioritized fix > revenue > acquisition > content
- BEAM-247 (CDN Tailwind) is highest priority: every page has it, 62 instances, external HTTP + console warning
- BEAM-248 (activation drip) and BEAM-249 (upgrade nudge) are next — direct revenue/activation impact
- Annual pricing (BEAM-251) requires creating a Stripe Price via API — store result in STRIPE_ANNUAL_PRICE_ID env
- Badge (BEAM-250) needs new migration: `hide_beam_badge INTEGER DEFAULT 0` on sites table
- PRD key: userStories (not stories)
- Scope form locators by action attr: `page.locator('form[action="/path"]').locator('button[type="submit"]')`
- Each route file has its own nav()/footer() helper — no shared component, changes must be applied per file
- Blog POSTS array: new posts go at beginning (newest first)
- Empty state uses early return before content variable
