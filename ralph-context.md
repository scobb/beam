## Last completed
BEAM-227 - Blog post: April 2026 product update (deployed prod; local 6/6 pass; prod 6/6 pass)

## Next up
BEAM-231 (high) — Dashboard settings: weekly digest opt-in/out toggle
- digest_opt_out column already in DB; unsubscribe page tells users to "re-enable in settings" but no such UI exists
- Need: POST /dashboard/settings/digest + toggle in GET /dashboard/settings

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo — manual auth required. Steve emailed.
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — routes exist, worker upload succeeds)
- Prod signup rate limit (10/hour/IP) gets exhausted from running multiple smoke runs in same session — space out prod test runs

## Key decisions this session
- Changelog is hardcoded in src/routes/changelog.ts (not DB-driven) — add entries directly to CHANGELOG array
- New date groups go at TOP of array (most recent first)
- Resend sender must use keylightdigital.dev (not .com)
- PRD key is userStories (not stories)
