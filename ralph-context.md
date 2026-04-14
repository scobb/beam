## Last completed
BEAM-217 - Email users when approaching 80% of free plan pageview limit

## Next up
BEAM-218 - Add 'Share dashboard' button to public analytics pages — add share UI to /dashboard/sites/:id/analytics

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures.
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing. Worker upload on prod succeeds despite route error; routes already exist from prior deploys.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache.
- ux-audit Journey 1 flaky on prod due to signup rate limit (10/hr/IP). Not a regression.

## Key decisions this session
- BEAM-217: capturedMonthlyCount is pre-insert count; pass +1 to warning for accurate threshold check
- KV.put before Resend fetch prevents double-send; errors are swallowed (KV key stays set)
