## Last completed
BEAM-240 - Add Open Graph and Twitter Card meta tags to all public pages

## Next up
BEAM-241 - Send security email on password change
- When user changes password in dashboard settings, send an email notification via Resend API
- Email should say "Your Beam password was just changed. If this wasn't you, contact us."
- Check dashboard.ts and auth.ts for the password change endpoint
- Use Resend API with sender ralph@keylightdigital.dev
- Priority: low

## Active issues
- BEAM-216 (auto-blocked): superseded by BEAM-239 (complete)
- BEAM-219 (blocked): HN/BetaList/Indie Hackers/AlternativeTo — manual auth required
- Staging DNS does not resolve — run smoke tests locally or against prod only
- Prod CF route registration errors on deploy (pre-existing — worker upload succeeds)
- Prod propagation delay ~10-30s — wait and retry if smoke tests fail immediately

## Key decisions this session
- og:image uses /og-image.svg (already served) — no need to create /og-image.png
- Blog posts use twitter:card=summary_large_image; static/utility pages use summary
- blog.ts has 9 posts with identical template literal patterns — replace_all covers all at once
- vs.ts, migrate.ts, for.ts, howItWorks.ts, tools.ts, wordpressPlugin.ts were already complete for OG tags
- Sitemap is in src/index.ts (both paths array and meta object must be updated)
- Resend sender: ralph@keylightdigital.dev (not .com)
- PRD key is userStories
- hashPassword/verifyPassword live in src/auth.ts
