# Beam — Agent Guide

## Sitemap Ping (Post-Deploy SEO)

After every production deploy, run the sitemap ping to notify search engines:

```bash
cd beam && npm run ping
# or explicitly:
cd beam && bash ping-sitemap.sh
```

This script:
- **Bing/Yandex (IndexNow)**: `POST https://api.indexnow.org/indexnow` — submits the full sitemap URL set in one request (HTTP 202 expected)
- **Google**: The `https://www.google.com/ping` endpoint was deprecated in January 2024 (returns 404). Submit the sitemap manually via [Google Search Console](https://search.google.com/search-console/sitemaps) when new pages are added.
- Keep IndexNow host/key aligned with the active production domain. If `HOST`/`SITEMAP_URL` point to a different domain than the deployed key file route (`/{INDEXNOW_KEY}.txt`), IndexNow returns HTTP 403 `UserForbiddedToAccessSite`.
- `ping-sitemap.sh` should derive URL host + sitemap from `PUBLIC_BASE_URL` (with `HOST`/`SITEMAP_URL` override support) so domain migrations do not break IndexNow submissions.

Expected response from IndexNow: HTTP 202.

### Combined deploy + ping:
```bash
cd beam && npm run deploy:ping
```

### IndexNow Key

The IndexNow key is `dde8c8bf4f6edbc168c2e6bab077f439`. It must be:
1. Set as wrangler secret: `echo "dde8c8bf4f6edbc168c2e6bab077f439" | npx wrangler secret put INDEXNOW_KEY`
2. Available in `.env` as `INDEXNOW_KEY=dde8c8bf4f6edbc168c2e6bab077f439`

The worker serves the key verification file at `https://beam-privacy.com/dde8c8bf4f6edbc168c2e6bab077f439.txt`.

### When to add new URLs to the ping script

When adding a new route to the sitemap in `src/index.ts`, also add the full URL to the `URLS_JSON` array in `ping-sitemap.sh`.

## Deploy Workflow

```bash
cd beam
npm run typecheck     # must be zero errors
npm run test:smoke    # must pass
npm run deploy        # deploys to Cloudflare Workers
npm run ping          # notifies search engines
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main router — sitemap, robots.txt, IndexNow key route |
| `src/types.ts` | `Env` interface (add new wrangler secrets here) |
| `src/middleware/attribution.ts` | First-touch attribution capture middleware (`beam_first_touch` cookie) |
| `src/lib/attribution.ts` | Attribution parsing/classification helpers used at signup |
| `ping-sitemap.sh` | Post-deploy sitemap ping script |
| `wrangler.toml` | Cloudflare bindings and config |
| `migrations/` | D1 SQL migration files |

## Acquisition Attribution Guardrail

- Keep first-touch capture in `src/middleware/attribution.ts` as no-overwrite behavior: once `beam_first_touch` is set, later visits should not replace the original source/campaign/landing context.
- `firstTouchAttributionMiddleware` captures only on `GET` requests that advertise `Accept: text/html`; include that header in curl-based production verification or `beam_first_touch` will not be set.
- Signup persistence should flow through `src/lib/attribution.ts` (`buildSignupAttributionColumns`) so internal/test traffic classification logic stays centralized.
- Keep verification-account classification centralized in `src/lib/internalTraffic.ts`; use `isInternalOrTestEmail()` for write-time signup tagging and `buildInternalOrTestEmailSql()` for external-only acquisition queries so filtering stays consistent for historical and new rows.
- Keep activation milestone notifications centralized in `src/lib/activationAlerts.ts`; both first-site-created and first-site-first-activity alerts should reuse `isInternalOrTestEmail()` plus `users.first_touch_is_internal`, and dedupe with write-once `users.first_site_alert_sent_at` / `users.first_activity_alert_sent_at`.
- Keep test-traffic filtering stricter than just `@example.com`: verification inboxes like `@testmail.dev` and explicit alias patterns such as `ralph+...` or `phase...` should not be counted as real external traction in launch reporting unless intentionally overridden.
- Keep launch-offer definitions in `src/lib/launchOffers.ts`; campaign links should pass `offer=<code>`, signup should persist `users.first_touch_offer_code`, and billing checkout should write `users.checkout_offer_code/status/applied_at` for source-vs-offer conversion analysis.
- Preserve the activation linkage in `users.first_site_id` + `users.first_site_created_at` by setting them only when null (first site creation), not on every new site.
- For `/dashboard/acquisition`, treat `users.created_at` as the cohort window, group funnel rows by first-touch source/campaign (`users.first_touch_*`), default to external-only filtering, and expose `include_internal=1` as an explicit debug mode.
- For `/dashboard/launch`, build stage metrics from one SQL stage-event CTE (signup, first-site, first pageview/event, checkout started/completed) and apply `buildAcquisitionUserScopeClause(...)` inside each stage branch so external-only behavior matches acquisition views.
- For campaign CTAs that carry paid intent, pass `intent=pro` (and optional `offer=`) through `/signup` or `/login`; successful signup now lands on `/dashboard/setup` while preserving those params, and login keeps direct billing routing (`/dashboard/billing`) for returning users.

## Launch Campaign Pages Guardrail

- Campaign landing pages (for example Product Hunt / Show HN) should live in `src/routes/launch.ts`, carry explicit campaign-tagged CTA URLs (`ref` + `utm_*`) via a shared helper, and mark major links with stable `data-launch-cta` attributes for smoke assertions.
- Treat campaign pages as distribution surfaces, not evergreen SEO pages: include social metadata, but keep them out of sitemap entries and set `robots` to noindex/nofollow.
- Add both desktop route/content checks and 375px mobile overflow checks in `test/smoke/smoke.spec.ts` whenever a new campaign page is introduced.
- If a campaign page sets `og:image` to an `/og/*` slug, add the same slug to `src/routes/og.ts` and include it in the smoke `ogPages` list so social-preview routes stay regression-covered.

## Structured Data Guardrail

- For JSON-LD blocks, build URLs in variables first (for example with `publicUrl(baseUrl, '/...')`) and then pass those variables into `JSON.stringify(...)`.
- Do not write placeholder-like values such as `"url": "${publicBaseUrl}/"` inside object literals; that ships literal `${...}` text to production and breaks structured data parsing.

## Scanner Coverage Guardrail

- When adding or removing supported analytics vendors, update the full scanner chain in one pass: `src/lib/stackScanner.ts` (`VENDOR_LABELS` + detection markers), `src/lib/migrationAssistant.ts` (`MIGRATION_STEPS`), scanner empty-state copy in `src/routes/tools.ts` and `src/routes/dashboard.ts`, plus `test/tools.test.ts` and `test/migration-assistant.test.ts`.
- Keep snippet-verification fetch/parsing logic in `src/lib/stackScanner.ts` and reuse it from all scanner surfaces (`/tools/stack-scanner`, `/dashboard/sites/:id/migrate`, and `/dashboard/sites/:id/installation-status/snippet-check`) so SSRF guardrails and detection behavior do not drift.

## Integration Guides Guardrail

- When adding a new `/for/*` guide, update all linked surfaces in the same change: `src/routes/for.ts` (GUIDES + hub sections), `src/landing.ts` (public guide links), `src/index.ts` (`/sitemap.xml` paths/meta), and `ping-sitemap.sh` (`URLS_JSON` list).
- For guide-page layout changes, extend `test/smoke/smoke.spec.ts` coverage in `integration guides are mobile-safe at 375px` so new guide routes are checked for horizontal overflow.
- Keep desktop coverage in sync too: add the new route to `integration hub and selected guide pages load` so each new guide path is smoke-tested for route availability and key headings.

## Comparison Pages Guardrail

- When adding a new `/vs/*` page, update the full discoverability chain in one pass: `src/routes/vs.ts` (route + alternatives card list + shared comparison footer links), `src/index.ts` (`/sitemap.xml` paths/meta), and `ping-sitemap.sh` (`URLS_JSON` list).
- Add at least one additional crawlable internal link outside `vs.ts` (for example `src/landing.ts` footer links or relevant `src/routes/blog.ts` comparison lists) so the new page is not orphaned for SEO.
- Add smoke coverage in `test/smoke/smoke.spec.ts` for both route availability/content on desktop and 375px overflow safety on mobile whenever a new `/vs/*` page ships.

## Technical Trust Pages Guardrail

- For technical architecture/trust routes (for example `/how-it-works`), update the full chain in one pass: new route module + canonical/OG metadata, `src/routes/og.ts` slug mapping, `src/index.ts` sitemap paths/meta, and `ping-sitemap.sh` `URLS_JSON`.
- Link those routes from both `src/landing.ts` and `src/routes/about.ts` so high-intent evaluators can reach them from top-level marketing and trust surfaces.
- Add smoke coverage for route availability/content on desktop and 375px overflow safety on mobile when shipping new technical trust pages.

## Migration Hub Guardrail

- When adding or expanding public migration hubs (for example `/migrate`), update the full chain in one iteration: route content + structured data in `src/routes/migrate.ts`, `src/index.ts` sitemap paths/meta, and `ping-sitemap.sh` `URLS_JSON`.
- Keep migration hubs connected to at least two existing crawlable surfaces outside the route module itself (for example `src/landing.ts`, `src/routes/for.ts`, or `src/routes/vs.ts`) so the page is discoverable without relying only on sitemap submission.
- Add smoke coverage for new public migration surfaces in `test/smoke/smoke.spec.ts` for both route availability and 375px mobile overflow safety.
- For vendor-specific guides under `/migrate/*`, add a matching cross-link from at least one existing relevant `/vs/*` or `/blog/*` surface, and include an explicit "what Beam does not replace" section to avoid overstating enterprise-reporting parity.

## Historical Import Guardrail

- Keep import-source/status enums plus CSV-row parsing, coverage-window logic, and native-vs-imported merge behavior in `src/lib/historicalImports.ts`; downstream importers and analytics surfaces should reuse those helpers instead of re-implementing overlap rules.
- Historical import D1 storage is split between `import_jobs` (status, row counts, coverage, errors) and `imported_daily_traffic` (daily visitors/pageviews keyed by `site_id + source + date`); preserve this split so imports remain diagnosable without raw-event backfills.
- Implement vendor CSV upload handlers as site-scoped dashboard routes (`/dashboard/sites/:id/imports/<vendor>`), validate/parse before writing daily rows, and always persist failed attempts in `import_jobs` so migration UI can show actionable error history.
- For multi-vendor import cards on `/dashboard/sites/:id/migrate`, include an explicit `import_source` query param in redirect flash state so success/failure banners render only on the relevant vendor section.

## Local Dev / Wrangler Dev Gotchas

- The `routes` block in `wrangler.toml` causes wrangler dev to rewrite all request URLs to the route host (`beam.keylightdigital.dev`), which triggers the legacy-domain redirect middleware. The redirect middleware correctly skips when `c.req.url` starts with `http://` (local dev) vs `https://` (production via Cloudflare).
- KV data persists across wrangler dev restarts via blob files in `.wrangler/state/v3/kv/`. Expired blobs are NOT evicted on restart — wrangler reloads them as active. Delete expired blobs manually before starting a fresh session if rate-limit tests are failing unexpectedly.
- Playwright smoke tests with `reuseExistingServer: true` share KV state across test runs. The signup rate limit (5/IP/hour) accumulates in-session. If `signupAndGetSession` returns 429, kill wrangler dev, delete expired blobs, and restart.
- UX audit tests live in `beam/test/smoke/ux-audit.spec.ts` — run with `npx playwright test test/smoke/ux-audit.spec.ts --project=desktop`.

## Public Pricing Copy Guardrail

- Keep current Beam plan copy aligned to `Free: 1 site / 50,000 pageviews` and `Pro: unlimited sites / 500,000 pageviews` across sitemap-backed public routes.
- Protect this with `test/public-pricing-copy.test.ts`, which crawls sitemap URLs and fails on stale Beam-specific `5K/100K` phrases while allowing intentional historical references (currently `/changelog`).
- For trust-alignment release stories, run both the local stale-copy regression test and a live production sitemap HTML sweep (excluding intentional historical pages like `/changelog`) before closing copy-fix work.

## Future: Repo Split

Beam code should eventually be extracted into its own standalone repo (e.g. `scobb/beam` or `keylightdigital/beam`). Currently lives in `ralph-bootstrap/beam/` as a subdirectory. When splitting:
- Use `git subtree split` or `git filter-repo` to preserve history
- The standalone repo should have its own `CLAUDE.md`, `prd.json`, `progress.txt`
- Update Cloudflare Workers deployment to point to the new repo
- Archive the `ralph/beam` branch in this repo once extracted
