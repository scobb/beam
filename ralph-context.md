## Last completed
BEAM-216 (retrospective close) — All framework guides verified complete via BEAM-238/239

## Status
ALL STORIES COMPLETE except BEAM-219 (blocked — requires manual auth).

Remaining:
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — Steve needs to create accounts and provide credentials or do these submissions manually

## Active issues
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s — wait and retry if smoke tests fail immediately
- PROD SIGNUP RATE LIMIT: 10/hour/IP — prod tests that require signup will fail if run too frequently

## Key decisions this session
- Security email: fire-and-forget (no await), gated on RESEND_API_KEY presence, catch swallows errors
- Email from: 'Beam Security <ralph@keylightdigital.dev>'
- Scope form locators by action attr: `page.locator('form[action="/path"]').locator('button[type="submit"]')`
- fetch with redirect:manual returns status 0 in browser — use page navigation for redirect tests
- og:image uses /og-image.svg; blog posts use twitter:card=summary_large_image; others use summary
- Sitemap in src/index.ts (both paths array AND meta object)
- Resend sender: ralph@keylightdigital.dev
- PRD key: userStories
- Empty state uses early return before content variable — cleaner than conditional within content block
- Each route file has its own nav()/footer() helper — no shared component, changes must be applied per file
- Blog POSTS array: new posts go at beginning (newest first). Use .find(slug) not numeric index in handlers.
- page.evaluate(() => fetch(..., {credentials: 'include'})) to test fetch endpoints with session cookies in Playwright
