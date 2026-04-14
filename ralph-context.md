## Last completed
BEAM-222 - Add Blog link to main navigation (deployed prod, 4/4 smoke tests pass)

## Next up
BEAM-225 (medium) — Upgrade nudge banner for free users at 60%+ usage
- After that: BEAM-228 (per-site usage), BEAM-223 (/for/react), BEAM-224 (/vs/mixpanel), BEAM-226 (UTM share), BEAM-227 (blog post)

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo — manual auth required. Steve emailed.
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — routes exist, worker upload succeeds)

## Key decisions this session
- Changelog is hardcoded in src/routes/changelog.ts (not DB-driven) — add entries directly to CHANGELOG array
- New date groups go at TOP of array (most recent first)
- Resend sender must use keylightdigital.dev (not .com)
- PRD key is userStories (not stories)
