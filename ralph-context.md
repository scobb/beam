## Last completed
BEAM-239 - Add /for/svelte and /for/sveltekit integration guides

## Next up
BEAM-240 - Add Open Graph and Twitter Card meta tags to all public pages
- Many public pages already have OG/Twitter meta tags (about, for/*, blog, vs/*)
- Need to audit which pages are MISSING them and add
- Key pages to check: /, /pricing, /how-it-works, /changelog, /demo, /migrate, /for hub, /for/* guides, /legal pages, /tools/stack-scanner
- Pattern from about.ts: og:title, og:description, og:type, og:url, og:image, twitter:card, twitter:title, twitter:description

## Active issues
- BEAM-216 (auto-blocked): superseded by BEAM-239 (complete)
- BEAM-219 (blocked): HN Show HN, BetaList, Indie Hackers, AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s after deploy — if smoke tests fail immediately, wait and retry before blocking

## Key decisions this session
- Adding a /for/* guide: (1) GUIDES entry, (2) GUIDE_SECTIONS.slugs, (3) sitemap paths+meta in index.ts
- GUIDE_SECTIONS uses `as const` — TypeScript errors if slug not in GUIDES
- Pricing: Free = 1 site, 50K/mo; Pro = $5/mo, unlimited sites, 500K/mo
- Sitemap is in src/index.ts (both paths array AND meta object must be updated)
- Resend sender: keylightdigital.dev (not .com)
- PRD key is userStories
