## Last completed
BEAM-220 - Dashboard site health indicators — show data freshness on sites overview

## Next up
No unblocked stories with passes: false remain in the current PRD.
- BEAM-216: blocked (auto-blocked after 3 consecutive failures on /for/sveltekit etc.)
- BEAM-219: blocked (external directory submissions need manual auth — emailed Steve)
- All other stories pass: true

Self-generation mode: audit the product and write new stories.

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures.
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo submissions need manual auth. Steve emailed 2026-04-14.
- Staging deploy route registration fails (CF auth error on zone routes API) — pre-existing.
- CF API token lacks cache_purge permission — cannot programmatically purge Cloudflare edge cache.
- Staging domain beam-staging.keylightdigital.dev does not resolve via DNS — run smoke tests locally or against prod.

## Key decisions this session
- BEAM-220: Two-pass query strategy — LEFT JOIN with 7d filter for recent data; second query only for sites with null result to check historical data (avoids full scan for active sites)
- BEAM-219: Set emailSent: false initially, then updated to true after Resend confirmed delivery
- Resend sender must use keylightdigital.dev domain (not .com — not verified)
