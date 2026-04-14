## Last completed
BEAM-214 - Blog post: why sendBeacon breaks cross-origin analytics (and how to fix it)

## Next up
BEAM-215 - Add /vs/posthog, /vs/pirsch, /vs/cabin comparison pages

## Active issues
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Use `npx wrangler deploy -c wrangler.deploy.toml` for prod deploys.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache.
- ux-audit Journey 1 flaky on prod due to signup rate limit (10/hr/IP). Not a regression — skip if hit.

## Key decisions this session
- Blog slug matches AC exactly: `senbeacon-cors-analytics-fix` (missing 'd' — intentional per AC)
- `page.getByText(/pattern/i)` strict mode fails when pattern matches multiple elements — use `.first()` in smoke tests
- BEAM-215: /vs/ pages follow the existing vs.ts pattern — look at an existing /vs/ route for structure
