## Last completed
BEAM-230 - /for/gatsby integration guide (local 6/6; prod 6/6)

## Next up
BEAM-232 (medium) — Blog: GDPR analytics without a cookie banner
- Legal angle (what GDPR actually requires), different from existing technical cookie-free guide
- Slug: gdpr-analytics-no-cookie-banner

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
