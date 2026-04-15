## Last completed
BEAM-242 - Dashboard empty state: add setup guide CTA when user has no sites

## Next up
BEAM-244 - Add /pricing to nav and footer
- The /pricing page exists but is not linked from nav or footer
- Add it to the main nav (header) and footer links on landing pages and dashboard
- Look at nav/footer helpers in src/routes/*.ts and src/landing.ts

## Active issues
- BEAM-216 (auto-blocked): superseded by BEAM-239 (complete)
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s — wait and retry if smoke tests fail immediately
- PROD SIGNUP RATE LIMIT: hit 429 today — if running many stories in same session, prod tests that require signup will fail. Wait for the hour to reset between smoke batches, or note as known infra limitation.

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
