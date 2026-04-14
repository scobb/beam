## Last completed
BEAM-215 - Add /vs/posthog, /vs/pirsch, /vs/cabin comparison pages

## Next up
BEAM-216 - Add /for/sveltekit, /for/vue, /for/nuxt framework setup guides — follow existing /for/ route pattern in for.ts

## Active issues
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Use `npx wrangler deploy -c wrangler.deploy.toml` for prod deploys.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache.
- ux-audit Journey 1 flaky on prod due to signup rate limit (10/hr/IP). Not a regression — skip if hit.
- 8 tests "did not run" on prod smoke suite = pre-existing UX audit rate limit issue, not failures.

## Key decisions this session
- /vs/ pages require updates in 4 places: route handler in vs.ts, footer() in vs.ts, alternativesCards() in /alternatives route, sitemap in index.ts
- BEAM-215: new /vs/ routes go after /vs/rybbit and before /switch in vs.ts
