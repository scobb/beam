/**
 * Beam smoke tests — desktop and mobile
 *
 * Run locally:
 *   cd beam && npm run test:smoke
 *
 * Prerequisites:
 *   - Local D1 migrations applied: npm run migrations:local
 *   - wrangler dev will be started automatically by playwright.config.ts webServer
 *
 * Screenshots are saved to screenshots/smoke/ on failure; baselines taken explicitly
 * within certain tests are always written.
 *
 * These tests are NOT exhaustive E2E coverage — they are a cheap guardrail that
 * catches obvious regressions, especially on mobile.
 */

import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const PASSWORD = 'smoketest123'

function uniqueEmail(): string {
  return `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
}

/** Sign up via the API from within the browser context so the session cookie is set. */
async function signupAndGetSession(page: Page, email: string): Promise<void> {
  // Navigate to root first to establish the page context on the right origin
  await page.goto('/')
  const result = await page.evaluate(
    async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      return { ok: res.ok, status: res.status }
    },
    { email, password: PASSWORD }
  )
  if (!result.ok) {
    throw new Error(`Signup API returned ${result.status} for ${email}`)
  }
}

/** Check that the page does not overflow horizontally. */
async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(hasOverflow, `${label}: page must not overflow horizontally`).toBe(false)
}

// ── Desktop smoke ─────────────────────────────────────────────────────────────

test.describe('Desktop smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    // Headline and key copy must be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Privacy-first web analytics')).toBeVisible()
    // CTA button links to signup
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
    // Setup guide links include React and Astro (BEAM-235)
    await expect(page.locator('a[href="/for/react"]')).toBeVisible()
    await expect(page.locator('a[href="/for/astro"]')).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-landing.png' })
  })

  test('how it works page loads with architecture details and is linked from landing/about', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'How it works' }).first()).toBeVisible()

    await page.goto('/how-it-works')
    await expect(page.getByRole('heading', { level: 1, name: /how beam works on cloudflare's edge/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Data flow diagram' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Privacy model' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Performance characteristics' })).toBeVisible()

    await page.goto('/about')
    await expect(page.getByRole('link', { name: 'How Beam works' })).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-how-it-works.png' })
  })

  test('integration hub and selected guide pages load', async ({ page }) => {
    await page.goto('/for')
    await expect(page.getByRole('heading', { name: /integration guides/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /beam for hugo/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /beam for webflow/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /beam for ghost/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /open wordpress plugin page/i })).toBeVisible()

    await page.goto('/for/hugo')
    await expect(page.getByRole('heading', { name: 'Beam for Hugo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /verify your hugo integration/i })).toBeVisible()

    await page.goto('/for/webflow')
    await expect(page.getByRole('heading', { name: 'Beam for Webflow' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /verify your webflow integration/i })).toBeVisible()

    await page.goto('/for/ghost')
    await expect(page.getByRole('heading', { name: 'Beam for Ghost' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /verify your ghost integration/i })).toBeVisible()

    await page.goto('/for/astro')
    await expect(page.getByRole('heading', { name: 'Beam for Astro' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /verify your astro integration/i })).toBeVisible()

    await page.goto('/for/remix')
    await expect(page.getByRole('heading', { name: 'Beam for Remix' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /verify your remix integration/i })).toBeVisible()
  })

  test('wordpress guide includes official plugin install path', async ({ page }) => {
    await page.goto('/for/wordpress')
    await expect(page.getByRole('heading', { name: 'Beam for WordPress' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Option A - Install the official Beam plugin package/i })).toBeVisible()
    await expect(page.getByText(/beam-wordpress-plugin\/beam-analytics/)).toBeVisible()
    await expect(page.getByRole('link', { name: /open plugin page/i })).toBeVisible()
  })

  test('wordpress plugin landing page explains hosted vs plugin workflows', async ({ page }) => {
    await page.goto('/wordpress-plugin')
    await expect(page.getByRole('heading', { name: 'Beam WordPress Plugin' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Hosted Beam account vs WordPress plugin installer/i })).toBeVisible()
    await expect(page.getByText('./build-plugin-zip.sh', { exact: true })).toBeVisible()
  })

  test('stack scanner page loads and blocks localhost targets', async ({ page }) => {
    await page.goto('/tools/stack-scanner')
    await expect(page.getByRole('heading', { name: /analytics stack scanner/i })).toBeVisible()

    await page.fill('input[name="url"]', 'http://localhost:3000')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: 'Scan failed' })).toBeVisible()
    await expect(page.getByText(/Private-network or localhost targets are blocked for safety/i)).toBeVisible()
  })

  test('migration hub page loads with decision paths', async ({ page }) => {
    await page.goto('/migrate')
    await expect(page.getByRole('heading', { name: /choose the fastest path to switch analytics tools/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /scan my current stack/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /google analytics migration checklist/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /plausible migration guide/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /fathom migration guide/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /import historical traffic guide/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /setup guides hub/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /create free account/i }).first()).toBeVisible()
  })

  test('google analytics migration guide page loads with checklist content', async ({ page }) => {
    await page.goto('/migrate/google-analytics')
    await expect(page.getByRole('heading', { name: /google analytics to beam/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Migration checklist' })).toBeVisible()
    await expect(page.getByRole('link', { name: /create beam account/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /open installation guides/i })).toBeVisible()
  })

  test('plausible migration guide page loads with checklist content', async ({ page }) => {
    await page.goto('/migrate/plausible')
    await expect(page.getByRole('heading', { name: /plausible to beam/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Migration checklist' })).toBeVisible()
    await expect(page.getByRole('link', { name: /review beam vs plausible/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /open setup guides/i })).toBeVisible()
  })

  test('fathom migration guide page loads with checklist content', async ({ page }) => {
    await page.goto('/migrate/fathom')
    await expect(page.getByRole('heading', { name: /fathom to beam/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Migration checklist' })).toBeVisible()
    await expect(page.getByRole('link', { name: /review beam vs fathom/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /open setup guides/i })).toBeVisible()
  })

  test('import history guide page loads with key content', async ({ page }) => {
    await page.goto('/migrate/import-history')
    await expect(page.getByRole('heading', { name: /import historical traffic into beam/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /step-by-step import guide/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /plausible migration guide/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /fathom migration guide/i }).first()).toBeVisible()
  })

  test('beamanalytics.io migration guide page loads with checklist content', async ({ page }) => {
    await page.goto('/migrate/beam-analytics')
    await expect(page.getByRole('heading', { name: /beamanalytics\.io to beam migration guide/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /migration checklist/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /create beam account/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /open setup guides/i })).toBeVisible()
  })

  test('live demo page renders with interactive filters', async ({ page }) => {
    await page.goto('/demo')
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await expect(page.getByText('This is a live demo with sample data')).toBeVisible()
    await expect(page.getByRole('link', { name: '30 Days' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible()

    await page.getByRole('link', { name: '30 Days' }).click()
    await expect(page).toHaveURL(/range=30d/)

    const firstFilter = page.locator('a[title^="Filter by"]').first()
    await firstFilter.click()
    await expect(page).toHaveURL(/(page|referrer|country|browser|device)=/)

    await page.locator('a[title="Remove filter"]').first().click()
    await expect(page).not.toHaveURL(/(page|referrer|country|browser|device)=/)

    await page.screenshot({ path: 'screenshots/smoke/desktop-demo.png' })
  })

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign up|create account/i })).toBeVisible()
  })

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible()
  })

  test('first-session setup flow keeps offer intent through site creation', async ({ page }) => {
    const email = uniqueEmail()
    await page.goto('/signup?intent=pro&offer=launch-2026')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: 'Create Account' }).click()

    await page.waitForURL(/\/dashboard\/setup/)
    await expect(page.getByRole('heading', { name: 'Set up your first site' })).toBeVisible()
    const setupUrl = new URL(page.url())
    expect(setupUrl.searchParams.get('intent')).toBe('pro')
    expect(setupUrl.searchParams.get('offer')).toBe('launch-2026')

    await page.fill('input[name="name"]', 'Guided Setup Site')
    await page.fill('input[name="domain"]', 'guided-setup.example.com')
    await page.getByRole('button', { name: 'Create site and continue' }).click()

    await page.waitForURL(/\/dashboard\/setup\?/)
    const continuedUrl = new URL(page.url())
    const siteId = continuedUrl.searchParams.get('site')
    expect(siteId).toMatch(/^[0-9a-f-]+$/)
    expect(continuedUrl.searchParams.get('intent')).toBe('pro')
    expect(continuedUrl.searchParams.get('offer')).toBe('launch-2026')

    await expect(page.getByRole('heading', { name: 'Step 2: Copy your snippet' })).toBeVisible()
    await expect(page.locator('#setup-snippet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Pro checkout →' })).toHaveAttribute('href', '/dashboard/billing?offer=launch-2026')
    await expect(page.getByRole('link', { name: 'Verify installation →' })).toHaveAttribute('href', `/dashboard/sites/${siteId}#verify-installation`)
    await page.screenshot({ path: 'screenshots/smoke/desktop-first-session-setup.png' })
  })

  test('dashboard shell renders after signup', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard')
    // Should not redirect to login
    await expect(page).toHaveURL(/\/dashboard/)
    // Sidebar navigation must be visible on desktop
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    // Overview link present in sidebar
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-dashboard.png' })
  })

  test('acquisition dashboard route renders with filters and internal toggle', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard')
    const sidebar = page.locator('aside')
    const acquisitionLink = sidebar.getByRole('link', { name: 'Acquisition' })
    await expect(acquisitionLink).toBeVisible()
    await page.goto('/dashboard/acquisition')
    await expect(page.getByRole('heading', { name: 'Acquisition' })).toBeVisible()
    await expect(page.getByText('Showing external customer traffic only by default.')).toBeVisible()
    await expect(page.getByRole('link', { name: '90 Days' })).toBeVisible()

    await page.getByRole('link', { name: 'Include Internal/Verification', exact: true }).click()
    await expect(page).toHaveURL(/include_internal=1/)
    await expect(page.getByText('Showing external plus internal/verification traffic for debugging.')).toBeVisible()
  })

  test('launch control room route renders with 1h/24h/7d windows and refresh controls', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard')
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('link', { name: 'Launch' })).toBeVisible()

    await page.goto('/dashboard/launch')
    await expect(page.getByRole('heading', { name: 'Launch Control Room' })).toBeVisible()
    await expect(page.getByRole('link', { name: '1 Hour' })).toBeVisible()
    await expect(page.getByRole('link', { name: '24 Hours' })).toBeVisible()
    await expect(page.getByRole('link', { name: '7 Days' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Refresh now' })).toBeVisible()
    await expect(page.getByText('Showing external customer activity only by default.')).toBeVisible()

    await page.getByRole('link', { name: 'Include Internal/Verification', exact: true }).click()
    await expect(page).toHaveURL(/include_internal=1/)
    await expect(page.getByText('Showing external plus internal/verification activity for debugging.')).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-launch-control-room.png' })
  })

  test('analytics page renders for a new site', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Smoke Test Site')
    await page.fill('input[name="domain"]', 'smoketest.example.com')
    await page.click('button[type="submit"]')

    // Should redirect to the site detail page after creation
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteUrl = page.url()
    const siteId = siteUrl.split('/dashboard/sites/')[1]

    // Navigate to analytics
    await page.goto(`/dashboard/sites/${siteId}/analytics`)
    await expect(page).toHaveURL(/\/analytics/)
    // Main content area must be present (empty state or chart)
    await expect(page.locator('main')).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-analytics.png' })
  })

  test('site detail shows installation verification flow', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Verify Flow Site')
    await page.fill('input[name="domain"]', 'verify-flow.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    await expect(page.getByRole('heading', { name: 'Verify installation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Verify installation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scan snippet URL' })).toBeVisible()
    await expect(page.locator('#snippet-check-url')).toBeVisible()

    await page.getByRole('button', { name: 'Verify installation' }).click()
    await expect(page.getByText('Still waiting for a fresh tracking hit.')).toBeVisible()

    await page.fill('#snippet-check-url', 'http://localhost:3000')
    await page.getByRole('button', { name: 'Scan snippet URL' }).click()
    await expect(page.getByText('Snippet scan failed')).toBeVisible()
    await expect(page.getByText(/Private-network or localhost targets are blocked for safety/i)).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-site-verification.png' })
  })

  test('migration assistant page renders for a site', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Migration Smoke Site')
    await page.fill('input[name="domain"]', 'migration-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    await page.goto(`/dashboard/sites/${siteId}/migrate`)
    await expect(page.getByRole('heading', { name: 'Migration Assistant' })).toBeVisible()
    await expect(page.getByText(/Read-only workflow/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Scan migration-smoke\.example\.com/i })).toBeVisible()
    // Coverage section should always render — empty state for a fresh site
    await expect(page.locator('[data-testid="migrate-coverage-section"]')).toBeVisible()
    await expect(page.getByText(/Import coverage status/i)).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-migration-assistant.png' })
  })

  test('import coverage API endpoint returns structured JSON for a site', async ({ page, request }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Coverage API Site')
    await page.fill('input[name="domain"]', 'coverage-api.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // Use page.evaluate to make an authenticated fetch using the existing session cookie
    const responseData = await page.evaluate(async (id) => {
      const res = await fetch(`/dashboard/sites/${id}/import-coverage`)
      return res.json()
    }, siteId)

    expect(responseData.siteId).toBe(siteId)
    expect(responseData.mode).toBe('empty')
    expect(responseData.cutoverDate).toBeNull()
    expect(responseData.checkedAt).toBeTruthy()
  })

  test('goals page supports create and delete for a site', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Goal Smoke Site')
    await page.fill('input[name="domain"]', 'goal-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    await page.goto(`/dashboard/sites/${siteId}/goals`)
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
    await page.fill('input[name="name"]', 'Signup Complete')
    await page.fill('input[name="match_pattern"]', '/thank-you')
    await page.click('button[type="submit"]')

    await expect(page.getByText('Signup Complete')).toBeVisible()
    await expect(page.getByText('/thank-you')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Signup Complete')).toHaveCount(0)
    await page.screenshot({ path: 'screenshots/smoke/desktop-goals.png' })
  })

  test('switch calculator page loads and shows results', async ({ page }) => {
    await page.goto('/switch')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/savings calculator/i)).toBeVisible()

    // Results should be populated after page load (JS runs update() on init)
    await expect(page.locator('#beam-cost')).not.toHaveText('—')
    await expect(page.locator('#current-cost')).not.toHaveText('—')
    await expect(page.locator('#annual-savings')).not.toHaveText('—')

    // Comparison table should be rendered
    await expect(page.locator('#comparison-table table')).toBeVisible()

    // CTA links present
    await expect(page.getByRole('link', { name: /try the live demo/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /get started free/i }).first()).toBeVisible()

    await page.screenshot({ path: 'screenshots/smoke/desktop-switch-calculator.png' })
  })

  test('cloudflare web analytics comparison page loads with honest trade-offs', async ({ page }) => {
    await page.goto('/alternatives')
    await expect(page.getByRole('link', { name: 'Beam vs Cloudflare Web Analytics' })).toBeVisible()

    await page.goto('/vs/cloudflare-web-analytics')
    await expect(page.getByRole('heading', { name: 'Beam vs Cloudflare Web Analytics' })).toBeVisible()

    await expect(page.getByText(/Goals and custom events/i)).toBeVisible()
    await expect(page.getByText(/Traffic channels/i)).toBeVisible()
    await expect(page.getByText(/Change alerts and insights/i)).toBeVisible()
    await expect(page.getByText(/API access/i)).toBeVisible()
    await expect(page.getByText(/Embeddable badges/i)).toBeVisible()
    await expect(page.getByText(/Toggle in Cloudflare dashboard/i)).toBeVisible()
    await expect(page.getByText(/Included with Cloudflare/i)).toBeVisible()

    await page.screenshot({ path: 'screenshots/smoke/desktop-vs-cloudflare-web-analytics.png' })
  })

  test('product hunt launch page loads with campaign-tagged CTAs and stays out of sitemap', async ({ page }) => {
    await page.goto('/product-hunt')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy-first analytics')
    await expect(page.getByText('Product Hunt Launch')).toBeVisible()
    await expect(page.getByText('Why this is different from another counter')).toBeVisible()

    const signupHref = await page.locator('a[data-launch-cta="ph_hero_signup"]').getAttribute('href')
    expect(signupHref ?? '').toContain('/signup?')
    expect(signupHref ?? '').toContain('utm_source=producthunt')
    expect(signupHref ?? '').toContain('utm_medium=launch')
    expect(signupHref ?? '').toContain('utm_campaign=ph_launch_apr_2026')
    expect(signupHref ?? '').toContain('ref=product-hunt')

    const proLoginHref = await page.locator('a[data-launch-cta="ph_footer_login_pro"]').getAttribute('href')
    expect(proLoginHref ?? '').toContain('/login?')
    expect(proLoginHref ?? '').toContain('intent=pro')
    expect(proLoginHref ?? '').toContain('utm_source=producthunt')

    const sitemapRes = await page.request.get('/sitemap.xml')
    expect(sitemapRes.status()).toBe(200)
    const sitemapXml = await sitemapRes.text()
    expect(sitemapXml).not.toContain('/product-hunt')

    await page.screenshot({ path: 'screenshots/smoke/desktop-product-hunt-launch.png' })
  })

  test('show hn launch page loads with technical content and campaign-tagged CTAs', async ({ page }) => {
    await page.goto('/show-hn')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cookie-free analytics')
    await expect(page.getByText('Show HN Launch')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Technical snapshot' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'What Beam does not do (yet)' })).toBeVisible()
    await expect(page.getByRole('link', { name: /How it works/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Live Demo/i }).first()).toBeVisible()

    const signupHref = await page.locator('a[data-launch-cta="hn_hero_signup"]').getAttribute('href')
    expect(signupHref ?? '').toContain('/signup?')
    expect(signupHref ?? '').toContain('utm_source=hackernews')
    expect(signupHref ?? '').toContain('utm_medium=launch')
    expect(signupHref ?? '').toContain('utm_campaign=show_hn_apr_2026')
    expect(signupHref ?? '').toContain('ref=show-hn')

    const proLoginHref = await page.locator('a[data-launch-cta="hn_footer_login_pro"]').getAttribute('href')
    expect(proLoginHref ?? '').toContain('/login?')
    expect(proLoginHref ?? '').toContain('intent=pro')
    expect(proLoginHref ?? '').toContain('utm_source=hackernews')

    const sitemapRes = await page.request.get('/sitemap.xml')
    expect(sitemapRes.status()).toBe(200)
    const sitemapXml = await sitemapRes.text()
    expect(sitemapXml).not.toContain('/show-hn')

    await page.screenshot({ path: 'screenshots/smoke/desktop-show-hn-launch.png' })
  })

  test('embed widget returns 404 for unknown site', async ({ page }) => {
    const res = await page.request.get('/embed/00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(404)
  })

  test('embed widget is accessible for a public site', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Embed Smoke Site')
    await page.fill('input[name="domain"]', 'embed-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // Enable public dashboard
    await page.click('button[type="submit"]:has-text("Public: Off")')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    // Embed iframe snippet should now be visible
    await expect(page.getByRole('heading', { name: 'Embeddable Widget' })).toBeVisible()
    await expect(page.locator('#embed-iframe')).toBeVisible()

    // Embed route itself should return 200
    const res = await page.request.get(`/embed/${siteId}`)
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('Powered by Beam')
    expect(body).toContain('pageviews')

    await page.screenshot({ path: 'screenshots/smoke/desktop-embed-widget.png' })
  })

  test('CSV export page renders and download returns valid CSV (BEAM-213)', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Export CSV Site')
    await page.fill('input[name="domain"]', 'export-csv-test.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // Analytics page: Export CSV button must be visible and link to export page with date params
    await page.goto(`/dashboard/sites/${siteId}/analytics`)
    const exportLink = page.getByRole('link', { name: 'Export CSV', exact: true })
    await expect(exportLink).toBeVisible()
    const href = await exportLink.getAttribute('href')
    expect(href).toMatch(/\/export\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/)

    // Export form page: accessible without Pro gate
    await page.goto(`/dashboard/sites/${siteId}/export`)
    await expect(page.getByRole('heading', { name: 'Export Data' })).toBeVisible()
    await expect(page.locator('input[name="start_date"]')).toBeVisible()
    await expect(page.locator('input[name="end_date"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible()
    // No Pro gate paywall
    await expect(page.getByText('Pro Feature')).not.toBeVisible()

    // POST export: must return CSV with correct headers and column row
    const today = new Date().toISOString().slice(0, 10)
    const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const res = await page.request.post(`/dashboard/sites/${siteId}/export`, {
      form: { start_date: thirtyDaysAgo, end_date: today },
    })
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
    expect(res.headers()['content-disposition']).toContain('attachment')
    const body = await res.text()
    expect(body).toContain('date,path,referrer,country,device_type,browser,screen_width')

    await page.screenshot({ path: 'screenshots/smoke/desktop-export-csv.png' })
  })

  test('sendBeacon CORS blog post loads with correct content, OG tags, sitemap entry, and blog index link (BEAM-214)', async ({ page }) => {
    const slug = 'senbeacon-cors-analytics-fix'

    // Blog post page loads with correct heading and technical content
    await page.goto(`/blog/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('sendBeacon')
    await expect(page.getByText(/credentials:include/i).first()).toBeVisible()
    await expect(page.getByText(/credentials: 'omit'/i).first()).toBeVisible()
    await expect(page.getByText(/keepalive/i).first()).toBeVisible()

    // OG meta tags
    const ogTitle = await page.$eval('meta[property="og:title"]', (el) => el.getAttribute('content'))
    expect(ogTitle).toContain('sendBeacon')
    const ogType = await page.$eval('meta[property="og:type"]', (el) => el.getAttribute('content'))
    expect(ogType).toBe('article')
    const articlePublished = await page.$eval('meta[property="article:published_time"]', (el) => el.getAttribute('content'))
    expect(articlePublished).toBe('2026-04-13')

    // Blog index includes the post
    await page.goto('/blog')
    await expect(page.getByRole('link', { name: /sendBeacon/i })).toBeVisible()

    // Sitemap includes the post
    const sitemapRes = await page.request.get('/sitemap.xml')
    expect(sitemapRes.status()).toBe(200)
    const sitemapXml = await sitemapRes.text()
    expect(sitemapXml).toContain(`/blog/${slug}`)

    await page.goto(`/blog/${slug}`)
    await page.screenshot({ path: 'screenshots/smoke/desktop-blog-senbeacon-cors.png' })
  })

  test('/vs/posthog, /vs/pirsch, /vs/cabin comparison pages load with correct content and sitemap entries (BEAM-215)', async ({ page }) => {
    const pages = [
      { path: '/vs/posthog', heading: 'Beam vs PostHog', bodyText: 'session replay', sitemap: '/vs/posthog' },
      { path: '/vs/pirsch', heading: 'Beam vs Pirsch', bodyText: 'EU data residency', sitemap: '/vs/pirsch' },
      { path: '/vs/cabin', heading: 'Beam vs Cabin', bodyText: 'carbon-neutral', sitemap: '/vs/cabin' },
    ]

    const sitemapRes = await page.request.get('/sitemap.xml')
    expect(sitemapRes.status()).toBe(200)
    const sitemapXml = await sitemapRes.text()

    for (const { path, heading, bodyText, sitemap } of pages) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect(page.getByText(bodyText).first()).toBeVisible()

      // beam.js tracking snippet present
      const beamScript = page.locator('script[data-site-id]')
      await expect(beamScript).toHaveCount(1)

      // CTA present
      await expect(page.getByRole('link', { name: /Get Started Free/i }).first()).toBeVisible()

      // Sitemap entry
      expect(sitemapXml).toContain(sitemap)
    }

    // Alternatives hub links to all three
    await page.goto('/alternatives')
    await expect(page.getByRole('link', { name: 'Beam vs PostHog' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Beam vs Pirsch' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Beam vs Cabin' })).toBeVisible()

    await page.screenshot({ path: 'screenshots/smoke/desktop-vs-posthog-pirsch-cabin.png' })
  })

  test('public dashboard shows Share button for owner and Beam footer for all (BEAM-218)', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Share Dashboard Test Site')
    await page.fill('input[name="domain"]', 'share-dash-test.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // Enable public dashboard
    await page.click('button[type="submit"]:has-text("Public: Off")')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    // Visit the public dashboard as the logged-in owner
    await page.goto(`/public/${siteId}`)

    // Share button is visible for the owner
    const shareBtn = page.getByRole('button', { name: /Share/i })
    await expect(shareBtn).toBeVisible()

    // Clicking Share opens the dropdown
    await shareBtn.click()
    await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Share on X/i })).toBeVisible()

    // Footer visible to all visitors — "Analytics by Beam — Privacy-first, cookie-free"
    await expect(page.getByText(/Analytics by Beam/i)).toBeVisible()
    await expect(page.getByText(/Privacy-first, cookie-free/i)).toBeVisible()

    await page.screenshot({ path: 'screenshots/smoke/desktop-share-dashboard.png' })

    // Mobile check: Share button still reachable at 375px
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/public/${siteId}`)
    await expect(page.getByRole('button', { name: /Share/i })).toBeVisible()
    await expect(page.getByText(/Analytics by Beam/i)).toBeVisible()
    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasOverflow, 'Public dashboard must not overflow at 375px').toBe(false)

    await page.screenshot({ path: 'screenshots/smoke/mobile-share-dashboard.png' })
  })
})

// ── Mobile smoke ──────────────────────────────────────────────────────────────

test.describe('Mobile smoke', () => {
  // Force a mobile viewport for this entire describe block regardless of which
  // Playwright project runs it (desktop project uses 1280px which hides the
  // sm:hidden mobile top bar — we always want mobile behaviour here).
  // isMobile + hasTouch ensure the viewport meta tag is respected the same way
  // as a real mobile browser (without them, Desktop Chrome at 375px doesn't
  // honour the viewport meta and produces false horizontal-overflow failures).
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
  test('landing page loads without horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Privacy-first web analytics')).toBeVisible()
    await assertNoHorizontalOverflow(page, 'landing page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-landing.png' })
  })

  test('how it works page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/how-it-works')
    await expect(page.getByRole('heading', { level: 1, name: /how beam works on cloudflare's edge/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'how it works page')
  })

  test('integration guides are mobile-safe at 375px', async ({ page }) => {
    await page.goto('/for')
    await expect(page.getByRole('heading', { name: /integration guides/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'integration hub page')

    await page.goto('/for/hugo')
    await expect(page.getByRole('heading', { name: 'Beam for Hugo' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'hugo guide page')

    await page.goto('/for/webflow')
    await expect(page.getByRole('heading', { name: 'Beam for Webflow' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'webflow guide page')

    await page.goto('/for/shopify')
    await expect(page.getByRole('heading', { name: 'Beam for Shopify' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'shopify guide page')

    await page.goto('/for/ghost')
    await expect(page.getByRole('heading', { name: 'Beam for Ghost' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'ghost guide page')

    await page.goto('/for/astro')
    await expect(page.getByRole('heading', { name: 'Beam for Astro' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'astro guide page')

    await page.goto('/for/remix')
    await expect(page.getByRole('heading', { name: 'Beam for Remix' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'remix guide page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-for-remix.png' })
  })

  test('wordpress guide is mobile-safe with plugin install instructions', async ({ page }) => {
    await page.goto('/for/wordpress')
    await expect(page.getByRole('heading', { name: 'Beam for WordPress' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Option A - Install the official Beam plugin package/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'wordpress guide page')
  })

  test('wordpress plugin landing page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/wordpress-plugin')
    await expect(page.getByRole('heading', { name: 'Beam WordPress Plugin' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Hosted Beam account vs WordPress plugin installer/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'wordpress plugin landing page')
  })

  test('stack scanner page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/tools/stack-scanner')
    await expect(page.getByRole('heading', { name: /analytics stack scanner/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'stack scanner page')
  })

  test('migration hub page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/migrate')
    await expect(page.getByRole('heading', { name: /choose the fastest path to switch analytics tools/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'migration hub page')
  })

  test('google analytics migration guide is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/migrate/google-analytics')
    await expect(page.getByRole('heading', { name: /google analytics to beam/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'google analytics migration guide page')
  })

  test('plausible migration guide is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/migrate/plausible')
    await expect(page.getByRole('heading', { name: /plausible to beam/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'plausible migration guide page')
  })

  test('fathom migration guide is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/migrate/fathom')
    await expect(page.getByRole('heading', { name: /fathom to beam/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'fathom migration guide page')
  })

  test('import history guide is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/migrate/import-history')
    await expect(page.getByRole('heading', { name: /import historical traffic into beam/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'import history guide page')
  })

  test('beamanalytics.io migration guide is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/migrate/beam-analytics')
    await expect(page.getByRole('heading', { name: /beamanalytics\.io to beam migration guide/i })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'beamanalytics.io migration guide page')
  })

  test('cloudflare comparison page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/vs/cloudflare-web-analytics')
    await expect(page.getByRole('heading', { name: 'Beam vs Cloudflare Web Analytics' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'cloudflare web analytics comparison page')
  })

  test('product hunt launch page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/product-hunt')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy-first analytics')
    await assertNoHorizontalOverflow(page, 'product hunt launch page')
  })

  test('show hn launch page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/show-hn')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cookie-free analytics')
    await assertNoHorizontalOverflow(page, 'show hn launch page')
  })

  test('demo page loads without horizontal overflow', async ({ page }) => {
    await page.goto('/demo')
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'demo page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-demo.png' })
  })

  test('dashboard shell renders on mobile with hamburger menu', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)

    // Mobile top bar should be visible (the sm:hidden bar that contains the hamburger)
    const menuButton = page.getByRole('button', { name: /open navigation/i })
    await expect(menuButton).toBeVisible()

    // Tapping the hamburger opens the sidebar
    await menuButton.click()
    const sidebar = page.locator('#sidebar')
    await expect(sidebar).toBeVisible()

    // Overview link must be interactable once open
    const overviewLink = sidebar.getByRole('link', { name: 'Overview' })
    await expect(overviewLink).toBeVisible()

    await page.screenshot({ path: 'screenshots/smoke/mobile-dashboard.png' })
  })

  test('first-session setup flow is mobile-safe at 375px', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/setup?intent=pro&offer=launch-2026')
    await expect(page.getByRole('heading', { name: 'Set up your first site' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create site and continue' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'first-session setup page')

    await page.fill('input[name="name"]', 'Mobile Setup Site')
    await page.fill('input[name="domain"]', 'mobile-guided-setup.example.com')
    await page.getByRole('button', { name: 'Create site and continue' }).click()
    await page.waitForURL(/\/dashboard\/setup\?/)
    await expect(page.getByRole('heading', { name: 'Step 2: Copy your snippet' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'first-session setup continuation page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-first-session-setup.png' })
  })

  test('acquisition dashboard is mobile-safe at 375px', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/acquisition')
    await expect(page).toHaveURL(/\/dashboard\/acquisition/)
    await expect(page.getByRole('heading', { name: 'Acquisition' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'acquisition dashboard page')
  })

  test('launch control room dashboard is mobile-safe at 375px', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/launch')
    await expect(page).toHaveURL(/\/dashboard\/launch/)
    await expect(page.getByRole('heading', { name: 'Launch Control Room' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'launch control room page')
  })

  test('dashboard overview shows site cards above fold with no horizontal overflow', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site so the overview has something to show
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Mobile Overview Site')
    await page.fill('input[name="domain"]', 'mobile-overview.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    // Site card with direct action links must be visible in the overview
    await expect(page.getByRole('link', { name: 'Analytics' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Manage/ }).first()).toBeVisible()

    await assertNoHorizontalOverflow(page, 'overview page with site')
    await page.screenshot({ path: 'screenshots/smoke/mobile-overview-site.png' })
  })

  test('analytics page renders on mobile without horizontal overflow', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Mobile Smoke Site')
    await page.fill('input[name="domain"]', 'mobile-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    await page.goto(`/dashboard/sites/${siteId}/analytics`)
    await expect(page.locator('main')).toBeVisible()
    await assertNoHorizontalOverflow(page, 'analytics page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-analytics.png' })
  })

  test('site detail verification card is mobile-safe at 375px', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Mobile Verify Site')
    await page.fill('input[name="domain"]', 'mobile-verify.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    await expect(page.getByRole('heading', { name: 'Verify installation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Verify installation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scan snippet URL' })).toBeVisible()
    await page.getByRole('button', { name: 'Verify installation' }).click()
    await expect(page.getByText('Still waiting for a fresh tracking hit.')).toBeVisible()
    await page.fill('#snippet-check-url', 'http://localhost:3000')
    await page.getByRole('button', { name: 'Scan snippet URL' }).click()
    await expect(page.getByText('Snippet scan failed')).toBeVisible()
    await expect(page.getByText(/Private-network or localhost targets are blocked for safety/i)).toBeVisible()

    await assertNoHorizontalOverflow(page, 'site detail verification card')
    await page.screenshot({ path: 'screenshots/smoke/mobile-site-verification.png' })
  })

  test('migration assistant page is mobile-safe at 375px', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Mobile Migration Site')
    await page.fill('input[name="domain"]', 'mobile-migration.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    await page.goto(`/dashboard/sites/${siteId}/migrate`)
    await expect(page.getByRole('heading', { name: 'Migration Assistant' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'migration assistant page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-migration-assistant.png' })
  })

  test('switch calculator page is mobile-safe at 375px', async ({ page }) => {
    await page.goto('/switch')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'switch calculator page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-switch-calculator.png' })
  })

  test('export CSV page is mobile-safe and button is reachable at 375px (BEAM-213)', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Mobile Export Site')
    await page.fill('input[name="domain"]', 'mobile-export.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // Analytics page: Export CSV button must be reachable on mobile
    await page.goto(`/dashboard/sites/${siteId}/analytics`)
    await expect(page.getByRole('link', { name: 'Export CSV', exact: true })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'analytics page (mobile)')

    // Export form must be usable on mobile
    await page.goto(`/dashboard/sites/${siteId}/export`)
    await expect(page.getByRole('heading', { name: 'Export Data' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible()
    await assertNoHorizontalOverflow(page, 'export page (mobile)')
    await page.screenshot({ path: 'screenshots/smoke/mobile-export-csv.png' })
  })

  test('sendBeacon CORS blog post is mobile-safe at 375px (BEAM-214)', async ({ page }) => {
    await page.goto('/blog/senbeacon-cors-analytics-fix')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('sendBeacon')
    await assertNoHorizontalOverflow(page, 'sendBeacon blog post page')
    await page.screenshot({ path: 'screenshots/smoke/mobile-blog-senbeacon-cors.png' })
  })

  test('/vs/posthog, /vs/pirsch, /vs/cabin pages are mobile-safe at 375px (BEAM-215)', async ({ page }) => {
    for (const path of ['/vs/posthog', '/vs/pirsch', '/vs/cabin']) {
      await page.goto(path)
      await assertNoHorizontalOverflow(page, `${path} mobile`)
    }
    await page.screenshot({ path: 'screenshots/smoke/mobile-vs-posthog-pirsch-cabin.png' })
  })
})

// ── OG image smoke ─────────────────────────────────────────────────────────────

test.describe('OG image route', () => {
  const ogPages = [
    'landing',
    'demo',
    'alternatives',
    'vs-google-analytics',
    'vs-cloudflare-web-analytics',
    'vs-vercel-analytics',
    'vs-plausible',
    'vs-fathom',
    'vs-umami',
    'vs-matomo',
    'vs-simple-analytics',
    'vs-rybbit',
    'migrate',
    'migrate-google-analytics',
    'migrate-plausible',
    'migrate-fathom',
    'migrate-beam-analytics',
    'migrate-import-history',
    'scanner',
    'how-it-works',
    'product-hunt',
    'show-hn',
  ]

  test('OG image route returns SVG for known pages', async ({ request }) => {
    for (const slug of ogPages) {
      const res = await request.get(`/og/${slug}`)
      expect(res.status(), `GET /og/${slug} should return 200`).toBe(200)
      const contentType = res.headers()['content-type'] ?? ''
      expect(contentType, `GET /og/${slug} should be SVG`).toContain('image/svg+xml')
      const body = await res.text()
      expect(body, `GET /og/${slug} should include SVG root element`).toContain('<svg')
      expect(body, `GET /og/${slug} should include BEAM brand`).toContain('BEAM')
    }
  })

  test('OG image route returns SVG for unknown slug (fallback)', async ({ request }) => {
    const res = await request.get('/og/unknown-page-slug')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<svg')
  })

  test('landing page has og:image pointing to /og/landing', async ({ page }) => {
    await page.goto('/')
    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content') ?? ''
    )
    expect(ogImage).toContain('/og/landing')
  })
})

// ── Tracking script smoke ──────────────────────────────────────────────────────

test.describe('Tracking script', () => {
  test('GET /js/beam.js returns JS with correct content-type and is under 2KB', async ({ request }) => {
    const res = await request.get('/js/beam.js')
    expect(res.status()).toBe(200)
    const contentType = res.headers()['content-type'] ?? ''
    expect(contentType).toContain('application/javascript')
    const body = await res.text()
    // Must be under 2KB raw (uncompressed)
    expect(body.length, 'beam.js must be under 2048 bytes raw').toBeLessThan(2048)
    // Core functionality must be present
    expect(body).toContain('api/collect')
    expect(body).toContain('data-site-id')
    // Must use fetch with credentials:omit (not sendBeacon) to avoid CORS issues
    // when the script is loaded cross-origin (e.g. cards.keylightdigital.dev)
    expect(body).toContain("credentials:'omit'")
    expect(body).not.toContain('sendBeacon')
  })

  test('GET /js/beam.js has Cache-Control max-age=3600 (1 hour, not 24h) (BEAM-212)', async ({ request }) => {
    // Use Cache-Control: no-cache to bypass Cloudflare edge cache and hit the Worker directly
    const res = await request.get('/js/beam.js', {
      headers: { 'Cache-Control': 'no-cache' },
    })
    expect(res.status()).toBe(200)
    const cacheControl = res.headers()['cache-control'] ?? ''
    // Must be 1-hour TTL so bug fixes propagate quickly to users
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=3600')
    expect(cacheControl).not.toContain('max-age=86400')
  })
})

// ── Collect endpoint smoke ──────────────────────────────────────────────────────

test.describe('Collect endpoint', () => {
  test('OPTIONS /api/collect returns 204 CORS preflight', async ({ request }) => {
    const res = await request.fetch('/api/collect', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(res.status()).toBe(204)
    const acao = res.headers()['access-control-allow-origin'] ?? ''
    expect(acao).toBe('*')
  })

  test('POST /api/collect with missing site_id returns 400', async ({ request }) => {
    const res = await request.post('/api/collect', {
      data: { path: '/', referrer: '' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('site_id')
  })

  test('POST /api/collect with unknown site_id returns 400', async ({ request }) => {
    const res = await request.post('/api/collect', {
      data: {
        site_id: '00000000-0000-0000-0000-000000000000',
        path: '/',
        referrer: '',
        screen_width: 1280,
        language: 'en',
        timezone: 'UTC',
      },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unknown site_id')
  })

  test('POST /api/collect accepts a valid pageview for a real site', async ({ page, request }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site so we have a real site_id
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Collect Smoke Site')
    await page.fill('input[name="domain"]', 'collect-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // POST without Origin header (no domain mismatch check applies when header is absent)
    const res = await request.post('/api/collect', {
      data: {
        site_id: siteId,
        path: '/',
        referrer: '',
        screen_width: 1280,
        language: 'en',
        timezone: 'UTC',
      },
      headers: { 'Content-Type': 'application/json' },
    })
    // 200 = recorded, 204 = ignored (e.g., bot), both are acceptable non-error responses
    expect([200, 204], `Expected 200 or 204 from collect but got ${res.status()}`).toContain(res.status())
  })

  test('POST /api/collect returns 204 for free user (limit warning fires async, does not block response) (BEAM-217)', async ({ page, request }) => {
    // Verifies that the 80%-limit warning email logic is fire-and-forget:
    // the collect endpoint must still return 204 regardless of warning state.
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Limit Warning Test Site')
    await page.fill('input[name="domain"]', 'limit-warn.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    const res = await request.post('/api/collect', {
      data: {
        site_id: siteId,
        path: '/test-limit-warning',
        referrer: '',
        screen_width: 1280,
        language: 'en',
        timezone: 'UTC',
      },
      headers: { 'Content-Type': 'application/json' },
    })
    // Must return 204 — warning email fires asynchronously and must not block
    expect(res.status(), 'Collect must return 204 even with limit warning logic present').toBe(204)
  })

  test('CORS preflight allows cross-origin requests without credentials requirement (BEAM-211)', async ({ request }) => {
    // Regression test: beam.js uses fetch with credentials:'omit', so the server
    // MUST allow * in Access-Control-Allow-Origin. If this breaks, cross-origin
    // sites like cards.keylightdigital.dev will silently drop all pageviews.
    const res = await request.fetch('/api/collect', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://cards.keylightdigital.dev',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })
    expect(res.status()).toBe(204)
    const headers = res.headers()
    // Must allow * (or explicit origin) — not restrict to same-origin only
    const acao = headers['access-control-allow-origin'] ?? ''
    expect(
      acao === '*' || acao === 'https://cards.keylightdigital.dev',
      `ACAO header "${acao}" must be * or the requesting origin`
    ).toBe(true)
    // Must allow POST
    const acam = headers['access-control-allow-methods'] ?? ''
    expect(acam).toContain('POST')
  })
})

// ── Billing page smoke ─────────────────────────────────────────────────────────

test.describe('Billing page', () => {
  test('billing page renders for free user with upgrade CTA and usage', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/billing')
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()
    // Free user should see upgrade CTA
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible()
    // Monthly usage section should render
    await expect(page.getByText(/pageviews this month/i)).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-billing-free.png' })
  })

  test('API key generate redirects free user back to billing (no key shown)', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Free user attempts to generate API key — server redirects back without generating one.
    // page.request shares the browser context cookies, follows redirects, exposes final URL.
    const response = await page.request.post('/dashboard/billing/api-key/generate')
    expect(response.url()).toContain('/dashboard/billing')
    // No api_key_flash param — key was NOT generated for a free user
    expect(response.url()).not.toContain('api_key_flash')
  })

  test('API key revoke redirects back with api_key_revoked=1', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Revoke always succeeds (sets api_key to NULL), redirects with confirmation param.
    const response = await page.request.post('/dashboard/billing/api-key/revoke')
    expect(response.url()).toContain('/dashboard/billing')
    expect(response.url()).toContain('api_key_revoked=1')
  })

  test.describe('mobile', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    test('billing page is mobile-safe at 375px', async ({ page }) => {
      const email = uniqueEmail()
      await signupAndGetSession(page, email)

      await page.goto('/dashboard/billing')
      await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()
      await assertNoHorizontalOverflow(page, 'billing page')
      await page.screenshot({ path: 'screenshots/smoke/mobile-billing.png' })
    })
  })
})

// ── Alerts smoke ───────────────────────────────────────────────────────────────

test.describe('Alerts toggle', () => {
  test('alerts toggle flips enabled/disabled for a site', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Alerts Smoke Site')
    await page.fill('input[name="domain"]', 'alerts-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1]

    // The site detail page shows a Traffic Alerts toggle button ("Alerts: On" or "Alerts: Off")
    const alertsBtn = page.getByRole('button', { name: /Alerts: (On|Off)/i })
    await expect(alertsBtn).toBeVisible()
    const initialLabel = await alertsBtn.textContent()

    // Click the toggle — form POSTs to /dashboard/sites/:id/alerts and redirects back
    await alertsBtn.click()
    await page.waitForURL(new RegExp(`/dashboard/sites/${siteId}$`))

    // Button should now show the opposite state
    await expect(alertsBtn).toBeVisible()
    const newLabel = await alertsBtn.textContent()
    expect(newLabel).not.toBe(initialLabel)
  })
})

// ── Settings page smoke ────────────────────────────────────────────────────────

test.describe('Settings page', () => {
  test('settings page renders with account email and plan', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    // Email should appear on the page
    await expect(page.getByText(email)).toBeVisible()
    // Plan label should appear
    await expect(page.getByText(/free|pro/i)).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-settings.png' })
  })

  test.describe('mobile', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    test('settings page is mobile-safe at 375px', async ({ page }) => {
      const email = uniqueEmail()
      await signupAndGetSession(page, email)

      await page.goto('/dashboard/settings')
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      await assertNoHorizontalOverflow(page, 'settings page')
    })
  })
})

// ── API v1 authentication smoke ────────────────────────────────────────────────

test.describe('API v1 authentication', () => {
  test('GET /api/v1/sites returns 401 when no API key is provided', async ({ request }) => {
    const res = await request.get('/api/v1/sites')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('GET /api/v1/sites returns 401 for an invalid API key', async ({ request }) => {
    const res = await request.get('/api/v1/sites', {
      headers: { Authorization: 'Bearer invalid_key_that_is_at_least_32_characters_long' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('GET /docs/api renders the API documentation page', async ({ page }) => {
    await page.goto('/docs/api')
    await expect(page.getByRole('heading', { name: /Beam Stats API/i })).toBeVisible()
    // Check authentication section heading (more specific than matching text in code samples)
    await expect(page.getByRole('heading', { name: 'Authentication' })).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-api-docs.png' })
  })

  // ── BEAM-220: Site health indicators ────────────────────────────────────────

  test('BEAM-220: sites overview shows health indicator for a new site (red — no data)', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Health Smoke Site')
    await page.fill('input[name="domain"]', 'health-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1].split(/[?#]/)[0]

    // Go to sites overview
    await page.goto('/dashboard/sites')

    // Health indicator must be present for this site
    const indicator = page.locator(`[data-testid="health-indicator-${siteId}"]`)
    await expect(indicator).toBeVisible()

    // New site with no pageviews should be red (gray-400 dot)
    const dot = indicator.locator('span.rounded-full')
    await expect(dot).toHaveClass(/bg-gray-400/)

    // Red indicator should be a link to the verify-installation page
    await expect(indicator).toHaveAttribute('href', `/dashboard/sites/${siteId}#verify-installation`)

    // No horizontal overflow on desktop
    await assertNoHorizontalOverflow(page, 'sites overview desktop')
  })

  test('BEAM-220: sites overview is mobile-safe at 375px with health indicators', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Health Mobile Site')
    await page.fill('input[name="domain"]', 'health-mobile.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1].split(/[?#]/)[0]

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard/sites')

    const indicator = page.locator(`[data-testid="health-indicator-${siteId}"]`)
    await expect(indicator).toBeVisible()

    // No horizontal overflow at 375px
    await assertNoHorizontalOverflow(page, 'sites overview mobile 375px')
    await page.screenshot({ path: 'screenshots/smoke/mobile-health-indicators.png' })
  })

  // ── BEAM-222: Blog link in main navigation ────────────────────────────────

  test('BEAM-222: landing page nav includes Blog link pointing to /blog', async ({ page }) => {
    await page.goto('/')
    // Blog link must be visible in the nav
    const blogLink = page.locator('nav a[href="/blog"]').first()
    await expect(blogLink).toBeVisible()
    await expect(blogLink).toHaveText('Blog')
    await page.screenshot({ path: 'screenshots/smoke/desktop-demo.png' })
  })

  test('BEAM-222: landing page nav Blog link accessible at mobile 375px with no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const blogLink = page.locator('nav a[href="/blog"]').first()
    await expect(blogLink).toBeVisible()
    await assertNoHorizontalOverflow(page, 'landing page mobile nav')
    await page.screenshot({ path: 'screenshots/smoke/mobile-demo.png' })
  })

  // ── BEAM-225: Upgrade nudge banner ────────────────────────────────────────
  // Threshold tests (60%/80% of 50K) require injecting 30K+ pageviews which is
  // impractical in smoke tests. We verify: (a) no banner for fresh free user,
  // (b) no overflow at mobile, and (c) banner HTML structure via data-testid.

  test('BEAM-225: fresh free user with 0 pageviews sees no nudge banner on /dashboard', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard')

    // No upgrade nudge banners should be visible for a fresh user (0% usage)
    await expect(page.locator('[data-testid="upgrade-nudge-warn"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="upgrade-nudge-urgent"]')).not.toBeVisible()

    // Upgrade to Pro link is NOT present in the nudge area (no false urgency)
    // The page should still render the usage bar
    await expect(page.getByText(/pageviews this month/i)).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-demo.png' })
  })

  test('BEAM-225: dashboard is mobile-safe at 375px with no nudge banner overflow', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')

    await assertNoHorizontalOverflow(page, 'dashboard mobile 375px')
    await page.screenshot({ path: 'screenshots/smoke/mobile-demo.png' })
  })

  // ── BEAM-228: Per-site monthly usage on sites overview ──────────────────────

  test('BEAM-228: /dashboard/sites shows per-site usage for a new site (0 pageviews)', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create a site
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Usage Smoke Site')
    await page.fill('input[name="domain"]', 'usage-smoke.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1].split(/[?#]/)[0]

    await page.goto('/dashboard/sites')

    // Usage widget must be present with 0 / 50K for a free user
    const usageWidget = page.locator(`[data-testid="site-usage-${siteId}"]`)
    await expect(usageWidget).toBeVisible()
    await expect(usageWidget).toContainText('0')
    await expect(usageWidget).toContainText('50K')

    await assertNoHorizontalOverflow(page, 'sites overview with usage desktop')
    await page.screenshot({ path: 'screenshots/smoke/desktop-demo.png' })
  })

  test('BEAM-228: /dashboard/sites is mobile-safe at 375px with usage indicators', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Usage Mobile Site')
    await page.fill('input[name="domain"]', 'usage-mobile.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard/sites')

    await assertNoHorizontalOverflow(page, 'sites overview mobile 375px with usage')
    await page.screenshot({ path: 'screenshots/smoke/mobile-demo.png' })
  })

  // ── BEAM-223: /for/react integration guide ─────────────────────────────────

  test('BEAM-223: /for/react returns 200 with React setup content and useBeam hook', async ({ page }) => {
    await page.goto('/for/react')
    await expect(page).toHaveURL(/\/for\/react/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('React')
    // Script tag step
    await expect(page.getByText(/public\/index\.html/i).first()).toBeVisible()
    // useBeam hook step
    await expect(page.getByText(/useBeam/i).first()).toBeVisible()
    await expect(page.getByText(/useEffect/i).first()).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-demo.png' })
  })

  test('BEAM-223: /for/react is in the /for hub and sitemap', async ({ page, request }) => {
    // Hub page includes React card
    await page.goto('/for')
    await expect(page.getByRole('link', { name: /Beam for React/i })).toBeVisible()

    // Sitemap includes /for/react
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain('/for/react')
  })

  test('BEAM-223: /for/react is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/for/react')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('React')
    await assertNoHorizontalOverflow(page, '/for/react mobile 375px')
    await page.screenshot({ path: 'screenshots/smoke/mobile-demo.png' })
  })

  // ── BEAM-224: /vs/mixpanel comparison page ──────────────────────────────────

  test('BEAM-224: /vs/mixpanel returns 200 with structured comparison content', async ({ page }) => {
    await page.goto('/vs/mixpanel')
    await expect(page).toHaveURL(/\/vs\/mixpanel/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mixpanel')
    // Comparison table
    await expect(page.getByText(/cookies used/i).first()).toBeVisible()
    await expect(page.getByText(/GDPR/i).first()).toBeVisible()
    // Pricing info
    await expect(page.getByText(/\$5\/mo/i).first()).toBeVisible()
    // Related comparisons section
    await expect(page.getByRole('link', { name: /Beam vs PostHog/i })).toBeVisible()
    await page.screenshot({ path: 'screenshots/smoke/desktop-demo.png' })
  })

  test('BEAM-224: /vs/mixpanel is in the sitemap', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    expect(await sitemap.text()).toContain('/vs/mixpanel')
  })

  test('BEAM-224: /vs/mixpanel is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/vs/mixpanel')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mixpanel')
    await assertNoHorizontalOverflow(page, '/vs/mixpanel mobile 375px')
    await page.screenshot({ path: 'screenshots/smoke/mobile-demo.png' })
  })

  // ── BEAM-226: UTM attribution on share links ──────────────────────────────

  test('BEAM-226: Copy link on public dashboard includes utm_source=beam-share', async ({ page, context }) => {
    // Grant clipboard permissions so we can read what was copied
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    // Create and enable public dashboard
    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'UTM Share Test Site')
    await page.fill('input[name="domain"]', 'utm-share-test.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
    const siteId = page.url().split('/dashboard/sites/')[1].split(/[?#]/)[0]

    await page.click('button[type="submit"]:has-text("Public: Off")')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    await page.goto(`/public/${siteId}`)

    // Open share dropdown
    await page.getByRole('button', { name: /Share/i }).click()
    await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible()

    // Click Copy link and read clipboard
    await page.getByRole('button', { name: /Copy link/i }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())

    expect(copied).toContain(`/public/${siteId}`)
    expect(copied).toContain('utm_source=beam-share')
    expect(copied).toContain('utm_medium=referral')

    // Share on X tweet URL must also use UTM-tagged link
    const tweetLink = page.getByRole('link', { name: /Share on X/i })
    await expect(tweetLink).toBeVisible()
    const tweetHref = await tweetLink.getAttribute('href') ?? ''
    expect(decodeURIComponent(tweetHref)).toContain('utm_source=beam-share')
  })

  // ── BEAM-234: /for/vue integration guide ─────────────────────────────────

  test('BEAM-234: /for/vue returns 200 with Vue.js content', async ({ page }) => {
    const res = await page.goto('/for/vue')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vue')
    await expect(page.locator('body')).toContainText('afterEach')
    await expect(page.locator('body')).toContainText('Vue Router')
  })

  test('BEAM-234: /for/vue appears in /for hub and sitemap', async ({ page }) => {
    await page.goto('/for')
    await expect(page.getByRole('link', { name: /Vue/i }).first()).toBeVisible()
    const res2 = await page.goto('/sitemap.xml')
    expect(res2?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('/for/vue')
  })

  test('BEAM-234: /for/vue is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/for/vue')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vue')
    await assertNoHorizontalOverflow(page, '/for/vue mobile 375px')
  })

  // ── BEAM-233: /migrate/umami migration guide ─────────────────────────────

  test('BEAM-233: /migrate/umami returns 200 with Umami migration content', async ({ page }) => {
    const res = await page.goto('/migrate/umami')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Umami')
    await expect(page.locator('body')).toContainText('umami.track')
    await expect(page.locator('body')).toContainText('window.beam')
  })

  test('BEAM-233: /migrate/umami is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/migrate/umami')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Umami')
    await assertNoHorizontalOverflow(page, '/migrate/umami mobile 375px')
  })

  // ── BEAM-232: Blog post GDPR analytics ───────────────────────────────────

  test('BEAM-232: /blog/gdpr-analytics-no-cookie-banner returns 200 with correct content', async ({ page }) => {
    const res = await page.goto('/blog/gdpr-analytics-no-cookie-banner')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('GDPR')
    await expect(page.locator('body')).toContainText('ePrivacy')
    await expect(page.locator('body')).toContainText('cookie banner')
  })

  test('BEAM-232: /blog/gdpr post appears in blog index and RSS', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('link', { name: /GDPR-Compliant Analytics/i }).first()).toBeVisible()
    const res2 = await page.goto('/blog/rss.xml')
    expect(res2?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('gdpr-analytics-no-cookie-banner')
  })

  // ── BEAM-230: /for/gatsby integration guide ──────────────────────────────

  test('BEAM-230: /for/gatsby returns 200 with Gatsby content', async ({ page }) => {
    const res = await page.goto('/for/gatsby')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Gatsby')
    await expect(page.locator('body')).toContainText('gatsby-browser.js')
    await expect(page.locator('body')).toContainText('onRouteUpdate')
  })

  test('BEAM-230: /for/gatsby appears in /for hub and sitemap', async ({ page }) => {
    await page.goto('/for')
    await expect(page.getByRole('link', { name: /Gatsby/i }).first()).toBeVisible()
    const res2 = await page.goto('/sitemap.xml')
    expect(res2?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('/for/gatsby')
  })

  test('BEAM-230: /for/gatsby is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/for/gatsby')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Gatsby')
    await assertNoHorizontalOverflow(page, '/for/gatsby mobile 375px')
  })

  // ── BEAM-229: /vs/amplitude comparison page ──────────────────────────────

  test('BEAM-229: /vs/amplitude returns 200 with comparison content', async ({ page }) => {
    const res = await page.goto('/vs/amplitude')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Amplitude')
    await expect(page.locator('body')).toContainText('Beam vs Amplitude')
  })

  test('BEAM-229: /vs/amplitude is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/vs/amplitude')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Amplitude')
    await assertNoHorizontalOverflow(page, '/vs/amplitude mobile 375px')
  })

  // ── BEAM-231: Dashboard settings digest toggle ───────────────────────────

  test('BEAM-231: /dashboard/settings shows digest subscription toggle', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    // Page loads
    await expect(page.locator('h1')).toContainText('Settings')
    // Shows account email
    await expect(page.locator('body')).toContainText(email)
    // Shows weekly digest section
    await expect(page.locator('h2').filter({ hasText: /Weekly digest/i })).toBeVisible()
    // Default: subscribed — shows unsubscribe button
    await expect(page.getByRole('button', { name: /Unsubscribe from digest/i })).toBeVisible()
  })

  test('BEAM-231: Toggling digest opt-out persists and shows confirmation', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    // Click unsubscribe
    await page.getByRole('button', { name: /Unsubscribe from digest/i }).click()
    await page.waitForURL(/status=digest-off/)
    await expect(page.locator('body')).toContainText('Weekly digest emails disabled')
    // Now shows re-enable button
    await expect(page.getByRole('button', { name: /Re-enable weekly digest/i })).toBeVisible()
    // Re-enable
    await page.getByRole('button', { name: /Re-enable weekly digest/i }).click()
    await page.waitForURL(/status=digest-on/)
    await expect(page.locator('body')).toContainText('Weekly digest emails re-enabled')
    await expect(page.getByRole('button', { name: /Unsubscribe from digest/i })).toBeVisible()
  })

  // ── BEAM-236: Dashboard settings — change password + delete account ──────

  test('BEAM-236: /dashboard/settings shows change password and delete account sections', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    await expect(page.locator('h2').filter({ hasText: /Change password/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /Current password/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /New password/i }).first()).toBeVisible()
    await expect(page.getByRole('textbox', { name: /Confirm new password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Update password/i })).toBeVisible()
    await expect(page.locator('h2').filter({ hasText: /Delete account/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Delete my account/i })).toBeVisible()
  })

  test('BEAM-236: Change password — wrong current password shows error', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    await page.getByRole('textbox', { name: /Current password/i }).fill('wrongpassword')
    await page.getByRole('textbox', { name: /New password/i }).first().fill('newpass456')
    await page.getByRole('textbox', { name: /Confirm new password/i }).fill('newpass456')
    await page.getByRole('button', { name: /Update password/i }).click()
    await page.waitForURL(/status=pw-wrong/)
    await expect(page.locator('body')).toContainText('Current password is incorrect')
  })

  test('BEAM-236: Change password — mismatch shows error', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    await page.getByRole('textbox', { name: /Current password/i }).fill(PASSWORD)
    await page.getByRole('textbox', { name: /New password/i }).first().fill('newpass456')
    await page.getByRole('textbox', { name: /Confirm new password/i }).fill('different789')
    await page.getByRole('button', { name: /Update password/i }).click()
    await page.waitForURL(/status=pw-mismatch/)
    await expect(page.locator('body')).toContainText('do not match')
  })

  test('BEAM-236: Change password — success updates password', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    await page.getByRole('textbox', { name: /Current password/i }).fill(PASSWORD)
    await page.getByRole('textbox', { name: /New password/i }).first().fill('newpass456')
    await page.getByRole('textbox', { name: /Confirm new password/i }).fill('newpass456')
    await page.getByRole('button', { name: /Update password/i }).click()
    await page.waitForURL(/status=pw-changed/)
    await expect(page.locator('body')).toContainText('Password updated successfully')
  })

  test('BEAM-236: Delete account — wrong password shows error', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    await page.getByRole('textbox', { name: /Enter your password to confirm/i }).fill('wrongpassword')
    // Submit without the confirm dialog by evaluating directly
    await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>('form[action="/dashboard/settings/delete"]')
      form?.removeAttribute('onsubmit')
    })
    await page.getByRole('button', { name: /Delete my account/i }).click()
    await page.waitForURL(/status=del-wrong/)
    await expect(page.locator('body')).toContainText('Password is incorrect')
  })

  // ── BEAM-227: April 2026 product update blog post ─────────────────────────

  test('BEAM-227: /blog/april-2026-updates returns 200 with correct content', async ({ page }) => {
    const res = await page.goto('/blog/april-2026-updates')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('April 2026')
    // All three features covered
    await expect(page.locator('h2').filter({ hasText: /Usage Warning/i })).toBeVisible()
    await expect(page.locator('h2').filter({ hasText: /Share Button/i })).toBeVisible()
    await expect(page.locator('h2').filter({ hasText: /Per-Site Usage/i })).toBeVisible()
  })

  test('BEAM-227: /blog/april-2026-updates appears in blog index', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('link', { name: /April 2026 Product Updates/i }).first()).toBeVisible()
  })

  test('BEAM-227: /blog/april-2026-updates appears in RSS feed', async ({ page }) => {
    const res = await page.goto('/blog/rss.xml')
    expect(res?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('april-2026-updates')
    expect(text).toContain('April 2026 Product Updates')
  })

  // ── BEAM-237: /pricing page ───────────────────────────────────────────────

  test('BEAM-237: /pricing returns 200 with plan and price content', async ({ page }) => {
    const res = await page.goto('/pricing')
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toContainText('Pro')
    await expect(page.locator('body')).toContainText('$5')
    await expect(page.locator('body')).toContainText('Free')
  })

  test('BEAM-237: /pricing shows plan details and FAQ', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Check both plans
    await expect(page.locator('body')).toContainText('50,000 pageviews')
    await expect(page.locator('body')).toContainText('500,000 pageviews')
    // Check FAQ questions
    await expect(page.locator('body')).toContainText('Is there a free trial?')
    await expect(page.locator('body')).toContainText('What happens when I hit the pageview limit?')
    await expect(page.locator('body')).toContainText('Can I cancel anytime?')
    await expect(page.locator('body')).toContainText('Is a credit card required')
    // Check CTAs
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible()
  })

  test('BEAM-237: /pricing appears in sitemap', async ({ page }) => {
    const res = await page.goto('/sitemap.xml')
    expect(res?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('/pricing')
  })

  test('BEAM-237: /pricing is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/pricing')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(hasOverflow, '/pricing must not overflow horizontally at 375px').toBe(false)
    // Plan cards and CTA should be visible
    await expect(page.locator('body')).toContainText('Pro')
    await expect(page.locator('body')).toContainText('$5')
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible()
  })

  // ── BEAM-238: /for/nuxt integration guide ─────────────────────────────────

  test('BEAM-238: /for/nuxt returns 200 and heading contains Nuxt', async ({ page }) => {
    const res = await page.goto('/for/nuxt')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nuxt')
  })

  test('BEAM-238: /for/nuxt shows Nuxt 3 plugin and router content', async ({ page }) => {
    await page.goto('/for/nuxt')
    // Plugin file pattern
    await expect(page.locator('body')).toContainText('plugins/beam.client.ts')
    // SPA navigation tracking
    await expect(page.locator('body')).toContainText('afterEach')
    // npm alternative
    await expect(page.locator('body')).toContainText('@keylightdigital/beam')
    // Verification section
    await expect(page.locator('body')).toContainText('Verify')
  })

  test('BEAM-238: /for/nuxt linked from /for hub', async ({ page }) => {
    await page.goto('/for')
    await expect(page.locator('a[href="/for/nuxt"]')).toBeVisible()
  })

  test('BEAM-238: /for/nuxt linked from landing page step 1', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="/for/nuxt"]')).toBeVisible()
  })

  test('BEAM-238: /for/nuxt appears in sitemap', async ({ page }) => {
    const res = await page.goto('/sitemap.xml')
    expect(res?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('/for/nuxt')
  })

  test('BEAM-238: /for/nuxt is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/for/nuxt')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(hasOverflow, '/for/nuxt must not overflow horizontally at 375px').toBe(false)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nuxt')
  })

  // ── BEAM-239: /for/svelte and /for/sveltekit integration guides ───────────

  test('BEAM-239: /for/svelte returns 200 and heading contains Svelte', async ({ page }) => {
    const res = await page.goto('/for/svelte')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Svelte')
  })

  test('BEAM-239: /for/svelte shows onMount pattern and key content', async ({ page }) => {
    await page.goto('/for/svelte')
    await expect(page.locator('body')).toContainText('onMount')
    await expect(page.locator('body')).toContainText('YOUR_SITE_ID')
    await expect(page.locator('body')).toContainText('Verify')
  })

  test('BEAM-239: /for/sveltekit returns 200 and heading contains SvelteKit', async ({ page }) => {
    const res = await page.goto('/for/sveltekit')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SvelteKit')
  })

  test('BEAM-239: /for/sveltekit shows afterNavigate and +layout.svelte content', async ({ page }) => {
    await page.goto('/for/sveltekit')
    await expect(page.locator('body')).toContainText('afterNavigate')
    await expect(page.locator('body')).toContainText('+layout.svelte')
    await expect(page.locator('body')).toContainText('YOUR_SITE_ID')
  })

  test('BEAM-239: both guides linked from /for hub', async ({ page }) => {
    await page.goto('/for')
    await expect(page.locator('a[href="/for/svelte"]')).toBeVisible()
    await expect(page.locator('a[href="/for/sveltekit"]')).toBeVisible()
  })

  test('BEAM-239: both guides appear in sitemap', async ({ page }) => {
    const res = await page.goto('/sitemap.xml')
    expect(res?.status()).toBe(200)
    const text = await page.content()
    expect(text).toContain('/for/svelte')
    expect(text).toContain('/for/sveltekit')
  })

  test('BEAM-239: /for/svelte is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/for/svelte')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(hasOverflow, '/for/svelte must not overflow horizontally at 375px').toBe(false)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Svelte')
  })

  test('BEAM-239: /for/sveltekit is mobile-safe at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/for/sveltekit')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(hasOverflow, '/for/sveltekit must not overflow horizontally at 375px').toBe(false)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SvelteKit')
  })

  // ── BEAM-240: Open Graph and Twitter Card meta tags ───────────────────────

  test('BEAM-240: landing page has og:title and og:description', async ({ page }) => {
    await page.goto('/')
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content')
    expect(ogTitle).toBeTruthy()
    expect(ogDesc).toBeTruthy()
    // Landing page should use summary_large_image
    const twCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    expect(twCard).toBe('summary_large_image')
  })

  test('BEAM-240: blog posts have og:image and twitter:card=summary_large_image', async ({ page }) => {
    await page.goto('/blog/cookie-free-analytics-guide')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    const twTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content')
    const twDesc = await page.locator('meta[name="twitter:description"]').getAttribute('content')
    expect(ogImage).toBeTruthy()
    expect(twCard).toBe('summary_large_image')
    expect(twTitle).toBeTruthy()
    expect(twDesc).toBeTruthy()
  })

  test('BEAM-240: /about has og:image and twitter tags', async ({ page }) => {
    await page.goto('/about')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content')
    expect(ogImage).toBeTruthy()
    expect(twTitle).toBeTruthy()
  })

  test('BEAM-240: /pricing has og:image and twitter tags', async ({ page }) => {
    await page.goto('/pricing')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content')
    expect(ogImage).toBeTruthy()
    expect(twTitle).toBeTruthy()
  })

  test('BEAM-240: /changelog has twitter:card and og:image', async ({ page }) => {
    await page.goto('/changelog')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    expect(ogImage).toBeTruthy()
    expect(twCard).toBe('summary')
  })

  test('BEAM-240: /privacy and /terms have twitter:card and og:image', async ({ page }) => {
    await page.goto('/privacy')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    expect(ogImage).toBeTruthy()
    expect(twCard).toBe('summary')

    await page.goto('/terms')
    const ogImage2 = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twCard2 = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    expect(ogImage2).toBeTruthy()
    expect(twCard2).toBe('summary')
  })

  // ── BEAM-241: Security email on password change ───────────────────────────
  // NOTE: The email notification is fire-and-forget via Resend and cannot be
  // verified in the smoke suite. The test below verifies the password change
  // itself still completes successfully.

  test('BEAM-241: password change completes and shows success confirmation', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    // Scope to the password change form specifically
    const pwForm = page.locator('form[action="/dashboard/settings/password"]')
    await pwForm.locator('input[name="current_password"]').fill('smoketest123')
    await pwForm.locator('input[name="new_password"]').fill('newsmokepass456')
    await pwForm.locator('input[name="confirm_password"]').fill('newsmokepass456')
    await pwForm.locator('button[type="submit"]').click()
    // After redirect, should land on settings page with pw-changed status
    await page.waitForURL(/status=pw-changed/)
    await expect(page.locator('body')).toContainText('Password updated successfully')
    // UNVERIFIED: security email delivery cannot be checked in smoke suite
  })

  // ── BEAM-242: Dashboard empty state ──────────────────────────────────────

  test('BEAM-242: newly signed up user sees empty state on /dashboard', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard')
    // Should show empty state, not the analytics layout
    await expect(page.locator('[data-testid="empty-state-add-site"]')).toBeVisible()
    await expect(page.locator('body')).toContainText('Welcome to Beam')
    await expect(page.locator('body')).toContainText('Add your first site')
  })

  test('BEAM-242: empty state CTA links to /dashboard/sites/new', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard')
    const cta = page.locator('[data-testid="empty-state-add-site"]')
    await expect(cta).toHaveAttribute('href', '/dashboard/sites/new')
  })

  test('BEAM-242: mobile — empty state at 375px has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard')
    await expect(page.locator('[data-testid="empty-state-add-site"]')).toBeVisible()
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  // ── BEAM-244: /pricing in nav and footer ─────────────────────────────────

  test('BEAM-244: landing page nav contains a link to /pricing', async ({ page }) => {
    await page.goto('/')
    const navPricingLink = page.locator('nav a[href="/pricing"]')
    await expect(navPricingLink).toBeVisible()
  })

  test('BEAM-244: landing page footer contains a link to /pricing', async ({ page }) => {
    await page.goto('/')
    const footerPricingLink = page.locator('footer a[href="/pricing"]')
    await expect(footerPricingLink).toBeVisible()
  })

  test('BEAM-244: /blog footer contains a link to /pricing', async ({ page }) => {
    await page.goto('/blog')
    const footerPricingLink = page.locator('footer a[href="/pricing"]')
    await expect(footerPricingLink).toBeVisible()
  })

  test('BEAM-244: /about footer contains a link to /pricing', async ({ page }) => {
    await page.goto('/about')
    const footerPricingLink = page.locator('footer a[href="/pricing"]')
    await expect(footerPricingLink).toBeVisible()
  })

  // ── BEAM-246: GDPR data export ────────────────────────────────────────────

  test('BEAM-246: GET /dashboard/settings/export returns 200 with Content-Disposition attachment', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    // Use fetch with credentials (cookies are set on the page context)
    const response = await page.evaluate(async () => {
      const res = await fetch('/dashboard/settings/export', { credentials: 'include' })
      return {
        status: res.status,
        contentDisposition: res.headers.get('content-disposition'),
        contentType: res.headers.get('content-type'),
      }
    })
    expect(response.status).toBe(200)
    expect(response.contentDisposition).toMatch(/attachment/)
    expect(response.contentDisposition).toMatch(/beam-export-.+\.json/)
    expect(response.contentType).toContain('application/json')
  })

  test('BEAM-246: export JSON includes account email and sites array', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    const data = await page.evaluate(async () => {
      const res = await fetch('/dashboard/settings/export', { credentials: 'include' })
      return res.json()
    })
    expect(data.account).toBeDefined()
    expect(data.account.email).toBeTruthy()
    expect(Array.isArray(data.sites)).toBe(true)
  })

  test('BEAM-246: /dashboard/settings shows "Export my data" button', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)
    await page.goto('/dashboard/settings')
    await expect(page.locator('[data-testid="export-my-data"]')).toBeVisible()
  })

  // ── BEAM-243: Blog post — Nuxt 3 privacy analytics ───────────────────────

  test('BEAM-243: /blog/nuxt-privacy-analytics returns 200 with correct heading', async ({ page }) => {
    await page.goto('/blog/nuxt-privacy-analytics')
    await expect(page).toHaveTitle(/Nuxt/)
    await expect(page.locator('h1')).toContainText('Nuxt')
    await expect(page.locator('body')).toContainText('useRouter')
  })

  test('BEAM-243: /blog/nuxt-privacy-analytics appears in /blog listing', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('body')).toContainText('Nuxt')
  })

  // ── BEAM-245: Blog post — Beam vs Matomo ─────────────────────────────────

  test('BEAM-245: /blog/matomo-alternative returns 200 with correct heading', async ({ page }) => {
    await page.goto('/blog/matomo-alternative')
    await expect(page).toHaveTitle(/Matomo/)
    await expect(page.locator('h1')).toContainText('Matomo')
    await expect(page.locator('body')).toContainText('comparison')
  })

  test('BEAM-245: /blog/matomo-alternative appears in /blog listing', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('body')).toContainText('Matomo')
  })

  test('BEAM-247: GET /assets/tailwind.css returns 200 with Content-Type text/css', async ({ request }) => {
    const res = await request.get('/assets/tailwind.css')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/css')
  })

  test('BEAM-247: landing page has no CDN tailwindcss script tag', async ({ page }) => {
    const res = await page.goto('/')
    const html = await res!.text()
    expect(html).not.toContain('cdn.tailwindcss.com')
    expect(html).toContain('/assets/tailwind.css')
  })

  test('BEAM-247: dashboard login page has no CDN tailwindcss script tag', async ({ page }) => {
    const res = await page.goto('/login')
    const html = await res!.text()
    expect(html).not.toContain('cdn.tailwindcss.com')
    expect(html).toContain('/assets/tailwind.css')
  })

  test('BEAM-248: /health endpoint returns ok after activation drip migration', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('BEAM-248: login page loads after activation drip migration (DB health check)', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res!.status()).toBe(200)
    await expect(page.locator('body')).toContainText('Log In')
  })
})
