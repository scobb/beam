## Last completed
BEAM-213 - CSV export of pageview data for a site

## Next up
BEAM-214 - Blog post: why sendBeacon breaks cross-origin analytics (and how to fix it)

## Active issues
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Use `npx wrangler deploy -c wrangler.deploy.toml` for prod deploys.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache.
- ux-audit Journey 1 flaky on prod due to signup rate limit (10/hr/IP). Not a regression — skip if hit.

## Key decisions this session
- CSV export columns: date, path, referrer, country, device_type, browser, screen_width (per AC — dropped language/utm cols from old code)
- Pro gate removed: all users can export (story explicitly says free users get same data)
- 100K cap: LIMIT 100001, truncate to 100K, append note row to CSV if exceeded
- Export link on analytics page passes `?from=YYYY-MM-DD&to=YYYY-MM-DD` using window.startISO and window.endDate-1ms
