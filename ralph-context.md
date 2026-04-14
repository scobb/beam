## Last completed
BEAM-221 - Update changelog with April 2026 features (deployed prod, verified live)

## Next up
BEAM-222 (medium) — Add Blog link to main navigation
- Several nav components exist across files; check which ones need updating
- After that: BEAM-225 (upgrade nudge), BEAM-228 (per-site usage), BEAM-223 (/for/react), BEAM-224 (/vs/mixpanel), BEAM-226 (UTM share), BEAM-227 (blog post)

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
