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
