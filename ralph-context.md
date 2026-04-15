## Last completed
BEAM-241 - Send security email on password change

## Next up
BEAM-242 - Dashboard empty state: add setup guide CTA when user has no sites
- When a user logs in and has no sites registered, the dashboard shows nothing useful
- Add a clear empty state with a CTA to add their first site
- Look at /dashboard route in dashboard.ts for where sites are listed
- The empty state should link to /dashboard/sites/new or show setup instructions

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
