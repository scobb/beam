## Last completed
BEAM-237 - Add dedicated /pricing page

## Next up
BEAM-238 - Add /for/nuxt integration guide
- Same pattern as other /for/* pages (see /for/react, /for/astro for reference)
- Note: BEAM-238 and BEAM-239 cover the blocked BEAM-216 functionality — these are unblocked stories

## Active issues
- BEAM-216 (auto-blocked): /for/sveltekit, /for/vue, /for/nuxt — blocked after 3 consecutive failures (BEAM-238/239 supersede these)
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo — manual auth required. Steve emailed.
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — routes exist, worker upload succeeds)
- Prod signup rate limit (10/hour/IP) gets exhausted from running multiple smoke runs in same session — space out prod test runs

## Key decisions this session
- Pricing numbers: Free = 1 site, 50K pageviews/mo; Pro = $5/mo, unlimited sites, 500K pageviews/mo (PRD story had stale 5K/100K)
- Changelog is hardcoded in src/routes/changelog.ts (not DB-driven) — add entries directly to CHANGELOG array
- New date groups go at TOP of array (most recent first)
- Resend sender must use keylightdigital.dev (not .com)
- PRD key is userStories (not stories)
- Delete cascade order: pageviews/goals/custom_events → sites → user (import_jobs CASCADE automatically)
- `hashPassword`/`verifyPassword` live in src/auth.ts; `deleteCookie` from hono/cookie
- Sitemap is in src/index.ts (not a separate route file) — both paths array and meta object must be updated
