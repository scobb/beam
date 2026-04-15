## Last completed
BEAM-238 - Add /for/nuxt integration guide

## Next up
BEAM-239 - Add /for/svelte and /for/sveltekit integration guides
- Same pattern as /for/nuxt (see GUIDES object in src/routes/for.ts)
- Add both slugs to GUIDE_SECTIONS developer frameworks list
- Add both to sitemap paths+meta in src/index.ts
- Add to landing page step 1 inline list if appropriate
- Note: BEAM-216 was the old blocked story for sveltekit; BEAM-239 supersedes it

## Active issues
- BEAM-216 (auto-blocked): superseded by BEAM-239
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo — manual auth required. Steve emailed.
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — routes exist, worker upload succeeds)
- Prod signup rate limit (10/hour/IP) — space out prod test runs

## Key decisions this session
- Adding a /for/* guide requires: (1) entry in GUIDES object, (2) slug in GUIDE_SECTIONS.slugs, (3) sitemap paths+meta in index.ts, (4) optionally landing.ts step 1 list
- GUIDE_SECTIONS uses `as const` — TypeScript will error if slug doesn't exist in GUIDES
- Pricing numbers: Free = 1 site, 50K/mo; Pro = $5/mo, unlimited sites, 500K/mo
- Sitemap is in src/index.ts (both paths array and meta object must be updated)
- Resend sender must use keylightdigital.dev (not .com)
- PRD key is userStories (not stories)
