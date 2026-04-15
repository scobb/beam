## Last completed
BEAM-244 - Add /pricing to nav and footer

## Next up
BEAM-246 - GDPR data export: add "Export my data" to dashboard settings
- Add an "Export my data" button/section to /dashboard/settings
- Should export the user's data (sites, pageviews, etc.) as JSON or CSV
- Look at /dashboard/settings route in dashboard.ts for the settings page structure
- BEAM-243 and BEAM-245 are blog posts (lower priority); BEAM-246 is a feature

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
- Each route file has its own nav()/footer() helper — no shared component, changes must be applied per file
