## Last completed
BEAM-211 - Debug missing pageview data for cards.keylightdigital.dev

## Next up
No stories remain with `passes: false`. All 211 stories in prd.json are complete.

## Active issues
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Use `npx wrangler deploy -c wrangler.deploy.toml` for prod deploys.
- Signup rate limit hit during prod smoke run (429s for auth-dependent tests). Not a regression — the 10/hr limit was reached from manual testing + smoke run in same session.

## Key decisions this session
- Root cause of BEAM-211: sendBeacon sends with credentials:include, breaking CORS against wildcard Access-Control-Allow-Origin: *
- Fix: fetch(keepalive:true, credentials:'omit') replaces sendBeacon in tracking.ts and beam-js/beam.js
- Production deployed via `npx wrangler deploy -c wrangler.deploy.toml` (bypasses zone route auth requirement)
- Self-generation mode should activate: all stories complete, audit the product and generate new stories
