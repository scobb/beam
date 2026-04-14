## Last completed
BEAM-225 - Upgrade nudge banner (60%=yellow, 80%=orange/red; deployed prod; local tests pass)

## Next up
BEAM-228 (medium) — Show per-site monthly pageview usage on sites overview
- After that: BEAM-223 (/for/react), BEAM-224 (/vs/mixpanel), BEAM-226 (UTM share), BEAM-227 (blog post)

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
