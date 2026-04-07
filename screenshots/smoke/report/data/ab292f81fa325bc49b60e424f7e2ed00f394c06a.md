# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Desktop smoke >> import coverage API endpoint returns structured JSON for a site
- Location: test/smoke/smoke.spec.ts:380:7

# Error details

```
Error: Signup API returned 500 for smoke-1775543352522-9pilv@example.com
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]: Beam
      - generic [ref=e5]:
        - link "Live Demo" [ref=e6] [cursor=pointer]:
          - /url: /demo
        - link "How it works" [ref=e7] [cursor=pointer]:
          - /url: /how-it-works
        - link "Migration Hub" [ref=e8] [cursor=pointer]:
          - /url: /migrate
        - link "Stack Scanner" [ref=e9] [cursor=pointer]:
          - /url: /tools/stack-scanner
        - link "Changelog" [ref=e10] [cursor=pointer]:
          - /url: /changelog
        - link "Log in" [ref=e11] [cursor=pointer]:
          - /url: /login
        - link "Get Started" [ref=e12] [cursor=pointer]:
          - /url: /signup
  - generic [ref=e13]:
    - heading "Privacy-first web analytics" [level=1] [ref=e14]
    - paragraph [ref=e15]: Simple, fast, and GDPR-compliant analytics for your website. No cookies, no tracking, no consent banners. Just the metrics you need.
    - generic [ref=e16]:
      - link "Start tracking in 60 seconds — free" [ref=e17] [cursor=pointer]:
        - /url: /signup
      - link "Try the live demo" [ref=e18] [cursor=pointer]:
        - /url: /demo
    - paragraph [ref=e19]: No credit card required · Cancel anytime
  - generic [ref=e22]:
    - paragraph [ref=e24]: 65+ features
    - paragraph [ref=e26]: Sub-2KB script
    - paragraph [ref=e28]: $0 infrastructure cost
    - paragraph [ref=e30]: GDPR compliant
  - generic [ref=e32]:
    - heading "How it works" [level=2] [ref=e33]
    - paragraph [ref=e34]: Set up in minutes. No configuration required.
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]: "1"
        - heading "Add our script tag" [level=3] [ref=e38]
        - paragraph [ref=e39]:
          - text: Paste one line of HTML into your site's
          - code [ref=e40]: <head>
          - text: . That's it — or install via
          - link "npm" [ref=e41] [cursor=pointer]:
            - /url: https://www.npmjs.com/package/beam-analytics
          - text: for build-tool workflows.
        - paragraph [ref=e42]:
          - text: Browse all setup guides at
          - link "/for" [ref=e43] [cursor=pointer]:
            - /url: /for
          - text: ", including"
          - link "Next.js" [ref=e44] [cursor=pointer]:
            - /url: /for/nextjs
          - text: ","
          - link "WordPress" [ref=e45] [cursor=pointer]:
            - /url: /for/wordpress
          - text: ","
          - link "Hugo" [ref=e46] [cursor=pointer]:
            - /url: /for/hugo
          - text: ","
          - link "Webflow" [ref=e47] [cursor=pointer]:
            - /url: /for/webflow
          - text: ","
          - link "Shopify" [ref=e48] [cursor=pointer]:
            - /url: /for/shopify
          - text: ","
          - link "Ghost" [ref=e49] [cursor=pointer]:
            - /url: /for/ghost
          - text: ","
          - link "Framer" [ref=e50] [cursor=pointer]:
            - /url: /for/framer
          - text: ", and"
          - link "Carrd" [ref=e51] [cursor=pointer]:
            - /url: /for/carrd
          - text: .
      - generic [ref=e52]:
        - generic [ref=e53]: "2"
        - heading "Data flows to your dashboard" [level=3] [ref=e54]
        - paragraph [ref=e55]: Pageviews, referrers, devices, and countries are captured instantly — with no cookies and no personal data stored.
      - generic [ref=e56]:
        - generic [ref=e57]: "3"
        - heading "Make decisions with clarity" [level=3] [ref=e58]
        - paragraph [ref=e59]: A clean, fast dashboard shows you what's working. No overwhelming reports, no dark patterns — just the data you need.
  - generic [ref=e61]:
    - generic [ref=e62]:
      - paragraph [ref=e63]: See it in action
      - heading "Watch real analytics data come to life" [level=2] [ref=e64]
      - paragraph [ref=e65]: Beam's strongest conversion asset is the product itself. Open the live demo to explore realistic traffic, filters, channels, events, and trends before you sign up.
    - generic [ref=e66]:
      - generic [ref=e68]:
        - generic [ref=e69]:
          - generic [ref=e70]: beam-privacy.com/demo
          - generic [ref=e71]: Live sample data
        - generic [ref=e73]:
          - generic [ref=e74]:
            - paragraph [ref=e75]: Pageviews
            - paragraph [ref=e76]: 24.8K
          - generic [ref=e77]:
            - paragraph [ref=e78]: Visitors
            - paragraph [ref=e79]: 18.2K
      - generic [ref=e89]:
        - generic [ref=e90]:
          - heading "Interactive Demo Preview" [level=3] [ref=e91]
          - paragraph [ref=e92]: Filter by range, drill into top pages and referrers, and test segmentation controls exactly like a real customer account. No signup wall. No fake screenshots.
          - list [ref=e93]:
            - listitem [ref=e94]:
              - generic [ref=e95]: ✓
              - text: Explore today, 7-day, and 30-day ranges
            - listitem [ref=e96]:
              - generic [ref=e97]: ✓
              - text: Verify mobile and desktop dashboard behavior
            - listitem [ref=e98]:
              - generic [ref=e99]: ✓
              - text: See privacy-first analytics without cookies
        - generic [ref=e100]:
          - link "Try the live demo" [ref=e101] [cursor=pointer]:
            - /url: /demo
          - link "Create a free account" [ref=e102] [cursor=pointer]:
            - /url: /signup
  - generic [ref=e104]:
    - heading "Everything you need, nothing you don't" [level=2] [ref=e105]
    - generic [ref=e106]:
      - generic [ref=e107]:
        - generic [ref=e108]: 🍪
        - heading "No Cookies" [level=3] [ref=e109]
        - paragraph [ref=e110]: Fully cookie-free. No consent banners required. Your visitors stay private.
      - generic [ref=e111]:
        - generic [ref=e112]: 🇪🇺
        - heading "GDPR Compliant" [level=3] [ref=e113]
        - paragraph [ref=e114]: No personal data collected or stored. Fully compliant with GDPR, CCPA, and PECR.
      - generic [ref=e115]:
        - generic [ref=e116]: ⚡
        - heading "Lightweight Script" [level=3] [ref=e117]
        - paragraph [ref=e118]: Under 2KB. Loads asynchronously and never slows down your site.
      - generic [ref=e119]:
        - generic [ref=e120]: 📊
        - heading "Real-Time Dashboard" [level=3] [ref=e121]
        - paragraph [ref=e122]: See your traffic as it happens. Pageviews, referrers, countries, and more.
  - generic [ref=e124]:
    - generic [ref=e125]:
      - paragraph [ref=e126]: Built with
      - heading "Built on Cloudflare's global edge network" [level=2] [ref=e127]
      - paragraph [ref=e128]: Your analytics data is processed and stored on Cloudflare's infrastructure — the same network that powers millions of websites worldwide.
    - generic [ref=e129]:
      - paragraph [ref=e131]: Cloudflare Workers
      - paragraph [ref=e133]: TypeScript
      - paragraph [ref=e135]: Cloudflare D1
      - link "Open-source tracking script" [ref=e137] [cursor=pointer]:
        - /url: https://github.com/scobb/beam.js
    - generic [ref=e138]:
      - generic [ref=e139]:
        - generic [ref=e140]: 🌍
        - heading "Global edge network" [level=3] [ref=e141]
        - paragraph [ref=e142]: 300+ locations worldwide for ultra-low latency data collection.
      - generic [ref=e143]:
        - generic [ref=e144]: 🔒
        - heading "Encrypted storage" [level=3] [ref=e145]
        - paragraph [ref=e146]: All data encrypted at rest and in transit. Nothing personal is ever stored.
      - generic [ref=e147]:
        - generic [ref=e148]: ✅
        - heading "99.99% uptime" [level=3] [ref=e149]
        - paragraph [ref=e150]: Cloudflare's SLA-backed reliability means your analytics never go dark.
  - generic [ref=e152]:
    - heading "Simple, honest pricing" [level=2] [ref=e153]
    - paragraph [ref=e154]: No hidden fees. No data selling. Cancel anytime.
    - paragraph [ref=e155]:
      - text: Already paying for analytics?
      - link "See how much you'd save by switching →" [ref=e156] [cursor=pointer]:
        - /url: /switch
    - generic [ref=e157]:
      - generic [ref=e158]:
        - heading "Free" [level=3] [ref=e159]
        - paragraph [ref=e160]: $0/mo
        - list [ref=e161]:
          - listitem [ref=e162]:
            - generic [ref=e163]: ✓
            - text: 1 website
          - listitem [ref=e164]:
            - generic [ref=e165]: ✓
            - text: 50,000 pageviews / month
          - listitem [ref=e166]:
            - generic [ref=e167]: ✓
            - text: All core features
          - listitem [ref=e168]:
            - generic [ref=e169]: ✓
            - text: No credit card required
        - link "Start tracking in 60 seconds — free" [ref=e170] [cursor=pointer]:
          - /url: /signup
        - paragraph [ref=e171]: No credit card required
      - generic [ref=e172]:
        - generic [ref=e173]: POPULAR
        - heading "Pro" [level=3] [ref=e174]
        - paragraph [ref=e175]: $5/mo
        - list [ref=e176]:
          - listitem [ref=e177]:
            - generic [ref=e178]: ✓
            - text: Unlimited websites
          - listitem [ref=e179]:
            - generic [ref=e180]: ✓
            - text: 500,000 pageviews / month
          - listitem [ref=e181]:
            - generic [ref=e182]: ✓
            - text: All core features
          - listitem [ref=e183]:
            - generic [ref=e184]: ✓
            - text: Priority support
        - link "Start free trial" [ref=e185] [cursor=pointer]:
          - /url: /signup
  - generic [ref=e187]:
    - heading "Frequently asked questions" [level=2] [ref=e188]
    - generic [ref=e189]:
      - group [ref=e190]:
        - generic "Do I need a cookie banner? ▼" [ref=e191] [cursor=pointer]:
          - text: Do I need a cookie banner?
          - generic [ref=e192]: ▼
        - paragraph [ref=e193]: No. Beam is completely cookie-free. We don't use any cookies or persistent identifiers, so there's nothing to disclose under GDPR, CCPA, or the ePrivacy Directive. You can remove your cookie banner entirely if Beam is your only analytics tool.
      - group [ref=e194]:
        - generic "How does it count visitors without cookies? ▼" [ref=e195] [cursor=pointer]:
          - text: How does it count visitors without cookies?
          - generic [ref=e196]: ▼
      - group [ref=e197]:
        - generic "Can I switch from Google Analytics? ▼" [ref=e198] [cursor=pointer]:
          - text: Can I switch from Google Analytics?
          - generic [ref=e199]: ▼
      - group [ref=e200]:
        - generic "Is there a free plan? ▼" [ref=e201] [cursor=pointer]:
          - text: Is there a free plan?
          - generic [ref=e202]: ▼
  - contentinfo [ref=e203]:
    - generic [ref=e204]:
      - generic [ref=e205]: © 2026 Keylight Digital LLC. All rights reserved.
      - generic [ref=e206]:
        - link "About" [ref=e207] [cursor=pointer]:
          - /url: /about
        - link "How it works" [ref=e208] [cursor=pointer]:
          - /url: /how-it-works
        - link "Changelog" [ref=e209] [cursor=pointer]:
          - /url: /changelog
        - link "Privacy" [ref=e210] [cursor=pointer]:
          - /url: /privacy
        - link "Terms" [ref=e211] [cursor=pointer]:
          - /url: /terms
        - link "Savings calculator" [ref=e212] [cursor=pointer]:
          - /url: /switch
        - link "Alternatives" [ref=e213] [cursor=pointer]:
          - /url: /alternatives
        - link "Migration hub" [ref=e214] [cursor=pointer]:
          - /url: /migrate
        - link "Setup guides" [ref=e215] [cursor=pointer]:
          - /url: /for
        - link "Hugo guide" [ref=e216] [cursor=pointer]:
          - /url: /for/hugo
        - link "Shopify guide" [ref=e217] [cursor=pointer]:
          - /url: /for/shopify
        - link "Ghost guide" [ref=e218] [cursor=pointer]:
          - /url: /for/ghost
        - link "Stack scanner" [ref=e219] [cursor=pointer]:
          - /url: /tools/stack-scanner
        - link "Open source tracking script" [ref=e220] [cursor=pointer]:
          - /url: https://github.com/scobb/beam.js
        - link "npm" [ref=e221] [cursor=pointer]:
          - /url: https://www.npmjs.com/package/beam-analytics
        - link "vs Google Analytics" [ref=e222] [cursor=pointer]:
          - /url: /vs/google-analytics
        - link "vs Vercel Analytics" [ref=e223] [cursor=pointer]:
          - /url: /vs/vercel-analytics
        - link "vs Cloudflare Web Analytics" [ref=e224] [cursor=pointer]:
          - /url: /vs/cloudflare-web-analytics
        - link "vs Plausible" [ref=e225] [cursor=pointer]:
          - /url: /vs/plausible
        - link "vs Fathom" [ref=e226] [cursor=pointer]:
          - /url: /vs/fathom
        - link "Sign up" [ref=e227] [cursor=pointer]:
          - /url: /signup
        - link "Log in" [ref=e228] [cursor=pointer]:
          - /url: /login
        - link "Live stats ↗" [ref=e229] [cursor=pointer]:
          - /url: /public/dfa32f6b-0775-43df-a2c4-eb23787e5f03
```

# Test source

```ts
  1   | /**
  2   |  * Beam smoke tests — desktop and mobile
  3   |  *
  4   |  * Run locally:
  5   |  *   cd beam && npm run test:smoke
  6   |  *
  7   |  * Prerequisites:
  8   |  *   - Local D1 migrations applied: npm run migrations:local
  9   |  *   - wrangler dev will be started automatically by playwright.config.ts webServer
  10  |  *
  11  |  * Screenshots are saved to screenshots/smoke/ on failure; baselines taken explicitly
  12  |  * within certain tests are always written.
  13  |  *
  14  |  * These tests are NOT exhaustive E2E coverage — they are a cheap guardrail that
  15  |  * catches obvious regressions, especially on mobile.
  16  |  */
  17  | 
  18  | import { test, expect, type Page } from '@playwright/test'
  19  | import path from 'path'
  20  | import fs from 'fs'
  21  | 
  22  | const PASSWORD = 'smoketest123'
  23  | 
  24  | function uniqueEmail(): string {
  25  |   return `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  26  | }
  27  | 
  28  | /** Sign up via the API from within the browser context so the session cookie is set. */
  29  | async function signupAndGetSession(page: Page, email: string): Promise<void> {
  30  |   // Navigate to root first to establish the page context on the right origin
  31  |   await page.goto('/')
  32  |   const result = await page.evaluate(
  33  |     async ({ email, password }: { email: string; password: string }) => {
  34  |       const res = await fetch('/api/auth/signup', {
  35  |         method: 'POST',
  36  |         headers: { 'Content-Type': 'application/json' },
  37  |         body: JSON.stringify({ email, password }),
  38  |       })
  39  |       return { ok: res.ok, status: res.status }
  40  |     },
  41  |     { email, password: PASSWORD }
  42  |   )
  43  |   if (!result.ok) {
> 44  |     throw new Error(`Signup API returned ${result.status} for ${email}`)
      |           ^ Error: Signup API returned 500 for smoke-1775543352522-9pilv@example.com
  45  |   }
  46  | }
  47  | 
  48  | /** Check that the page does not overflow horizontally. */
  49  | async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  50  |   const hasOverflow = await page.evaluate(
  51  |     () => document.documentElement.scrollWidth > window.innerWidth
  52  |   )
  53  |   expect(hasOverflow, `${label}: page must not overflow horizontally`).toBe(false)
  54  | }
  55  | 
  56  | // ── Desktop smoke ─────────────────────────────────────────────────────────────
  57  | 
  58  | test.describe('Desktop smoke', () => {
  59  |   test('landing page loads', async ({ page }) => {
  60  |     await page.goto('/')
  61  |     // Headline and key copy must be visible
  62  |     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  63  |     await expect(page.getByText('Privacy-first web analytics')).toBeVisible()
  64  |     // CTA button links to signup
  65  |     await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
  66  |     await page.screenshot({ path: 'screenshots/smoke/desktop-landing.png' })
  67  |   })
  68  | 
  69  |   test('how it works page loads with architecture details and is linked from landing/about', async ({ page }) => {
  70  |     await page.goto('/')
  71  |     await expect(page.getByRole('link', { name: 'How it works' }).first()).toBeVisible()
  72  | 
  73  |     await page.goto('/how-it-works')
  74  |     await expect(page.getByRole('heading', { level: 1, name: /how beam works on cloudflare's edge/i })).toBeVisible()
  75  |     await expect(page.getByRole('heading', { level: 2, name: 'Data flow diagram' })).toBeVisible()
  76  |     await expect(page.getByRole('heading', { level: 2, name: 'Privacy model' })).toBeVisible()
  77  |     await expect(page.getByRole('heading', { level: 2, name: 'Performance characteristics' })).toBeVisible()
  78  | 
  79  |     await page.goto('/about')
  80  |     await expect(page.getByRole('link', { name: 'How Beam works' })).toBeVisible()
  81  |     await page.screenshot({ path: 'screenshots/smoke/desktop-how-it-works.png' })
  82  |   })
  83  | 
  84  |   test('integration hub and selected guide pages load', async ({ page }) => {
  85  |     await page.goto('/for')
  86  |     await expect(page.getByRole('heading', { name: /integration guides/i })).toBeVisible()
  87  |     await expect(page.getByRole('link', { name: /beam for hugo/i })).toBeVisible()
  88  |     await expect(page.getByRole('link', { name: /beam for webflow/i })).toBeVisible()
  89  |     await expect(page.getByRole('link', { name: /beam for ghost/i })).toBeVisible()
  90  |     await expect(page.getByRole('link', { name: /open wordpress plugin page/i })).toBeVisible()
  91  | 
  92  |     await page.goto('/for/hugo')
  93  |     await expect(page.getByRole('heading', { name: 'Beam for Hugo' })).toBeVisible()
  94  |     await expect(page.getByRole('heading', { name: /verify your hugo integration/i })).toBeVisible()
  95  | 
  96  |     await page.goto('/for/webflow')
  97  |     await expect(page.getByRole('heading', { name: 'Beam for Webflow' })).toBeVisible()
  98  |     await expect(page.getByRole('heading', { name: /verify your webflow integration/i })).toBeVisible()
  99  | 
  100 |     await page.goto('/for/ghost')
  101 |     await expect(page.getByRole('heading', { name: 'Beam for Ghost' })).toBeVisible()
  102 |     await expect(page.getByRole('heading', { name: /verify your ghost integration/i })).toBeVisible()
  103 | 
  104 |     await page.goto('/for/astro')
  105 |     await expect(page.getByRole('heading', { name: 'Beam for Astro' })).toBeVisible()
  106 |     await expect(page.getByRole('heading', { name: /verify your astro integration/i })).toBeVisible()
  107 | 
  108 |     await page.goto('/for/remix')
  109 |     await expect(page.getByRole('heading', { name: 'Beam for Remix' })).toBeVisible()
  110 |     await expect(page.getByRole('heading', { name: /verify your remix integration/i })).toBeVisible()
  111 |   })
  112 | 
  113 |   test('wordpress guide includes official plugin install path', async ({ page }) => {
  114 |     await page.goto('/for/wordpress')
  115 |     await expect(page.getByRole('heading', { name: 'Beam for WordPress' })).toBeVisible()
  116 |     await expect(page.getByRole('heading', { name: /Option A - Install the official Beam plugin package/i })).toBeVisible()
  117 |     await expect(page.getByText(/beam-wordpress-plugin\/beam-analytics/)).toBeVisible()
  118 |     await expect(page.getByRole('link', { name: /open plugin page/i })).toBeVisible()
  119 |   })
  120 | 
  121 |   test('wordpress plugin landing page explains hosted vs plugin workflows', async ({ page }) => {
  122 |     await page.goto('/wordpress-plugin')
  123 |     await expect(page.getByRole('heading', { name: 'Beam WordPress Plugin' })).toBeVisible()
  124 |     await expect(page.getByRole('heading', { name: /Hosted Beam account vs WordPress plugin installer/i })).toBeVisible()
  125 |     await expect(page.getByText('./build-plugin-zip.sh', { exact: true })).toBeVisible()
  126 |   })
  127 | 
  128 |   test('stack scanner page loads and blocks localhost targets', async ({ page }) => {
  129 |     await page.goto('/tools/stack-scanner')
  130 |     await expect(page.getByRole('heading', { name: /analytics stack scanner/i })).toBeVisible()
  131 | 
  132 |     await page.fill('input[name="url"]', 'http://localhost:3000')
  133 |     await page.click('button[type="submit"]')
  134 | 
  135 |     await expect(page.getByRole('heading', { name: 'Scan failed' })).toBeVisible()
  136 |     await expect(page.getByText(/Private-network or localhost targets are blocked for safety/i)).toBeVisible()
  137 |   })
  138 | 
  139 |   test('migration hub page loads with decision paths', async ({ page }) => {
  140 |     await page.goto('/migrate')
  141 |     await expect(page.getByRole('heading', { name: /choose the fastest path to switch analytics tools/i })).toBeVisible()
  142 |     await expect(page.getByRole('link', { name: /scan my current stack/i })).toBeVisible()
  143 |     await expect(page.getByRole('link', { name: /google analytics migration checklist/i }).first()).toBeVisible()
  144 |     await expect(page.getByRole('link', { name: /plausible migration guide/i }).first()).toBeVisible()
```