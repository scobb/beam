## Last completed
BEAM-212 - Reduce beam.js Cache-Control TTL from 24h to 1h

## Next up
BEAM-213 - CSV export of pageview data for a site (medium priority)

## Active issues
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Use `npx wrangler deploy -c wrangler.deploy.toml` for prod deploys.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache. Use `curl -H "Cache-Control: no-cache"` to bypass in manual checks; add the header to smoke test requests that check response headers.
- ux-audit Journey 1 flaky on prod due to signup rate limit (10/hr/IP). Not a regression — skip if hit.

## Key decisions this session
- beam.js TTL: 86400 → 3600 in src/routes/tracking.ts line 13
- CF edge caches Worker responses; CF-side cache will expire within 1h (the new TTL). Direct Worker verified correct.
- Smoke test for Cache-Control uses `headers: { 'Cache-Control': 'no-cache' }` to bypass CF edge cache and hit Worker directly.
