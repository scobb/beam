## Last completed
BEAM-218 - Add 'Share dashboard' button to public analytics pages

## Next up
BEAM-219 - Add Hacker News 'Show HN' post and submit to indie directories — check blocked-stories.json first; may require manual submission (captcha/auth)

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures.
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Worker upload on prod succeeds despite route error; routes already exist from prior deploys.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache.
- ux-audit Journey 1 flaky on prod due to signup rate limit (10/hr/IP). Not a regression.
- Staging domain beam-staging.keylightdigital.dev does not resolve via DNS — run smoke tests locally or against prod instead.

## Key decisions this session
- BEAM-218: Owner detection on public pages uses getCookie + verifyJWT + DB check, no middleware
- PRD userStories key is `userStories` (not `stories`) — important for scripting
- Local smoke tests (wrangler dev) pass even when clipboard API unavailable; prod tests pass on HTTPS
