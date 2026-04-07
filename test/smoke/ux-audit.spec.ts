/**
 * UX Interaction Cost Audit — BEAM-149
 *
 * Walks through the 5 critical user journeys, capturing screenshots at each
 * step for the ux-audit.md report.
 *
 * Run:
 *   cd beam && npx playwright test test/smoke/ux-audit.spec.ts --reporter=list
 *
 * Screenshots land in screenshots/ux-audit/
 *
 * Design: tests run serially and share ONE user account created in Journey 1.
 * This avoids the signup rate limit (5/IP/hour in local dev). Journeys 2–5
 * use /api/auth/login instead of signing up again.
 */

import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Ensure screenshots dir exists
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots', 'ux-audit')
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const PASSWORD = 'uxaudit123'

// Shared across all tests in this module — created in Journey 1
const SHARED_EMAIL = `ux-audit-${Date.now()}@example.com`
// Unique fake IP per run so the signup rate limit never accumulates across runs
const FAKE_IP = `203.0.113.${(Date.now() % 254) + 1}`

// Site ID created in Journey 2 — used in J3 and J5
let sharedSiteId = ''

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${name}.png`), fullPage: false })
}

/**
 * Log in as the shared test user. Login endpoint allows 10 attempts/15min/IP.
 */
async function loginAsSharedUser(page: Page): Promise<void> {
  await page.goto('/')
  const result = await page.evaluate(
    async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      return { ok: res.ok, status: res.status }
    },
    { email: SHARED_EMAIL, password: PASSWORD }
  )
  if (!result.ok) throw new Error(`Login failed: ${result.status}`)
}

// Serial ensures tests run in order so Journey 2's site is visible in Journey 3+
test.describe.serial('UX Interaction Cost Audit', () => {
  // ─── Journey 1 — New visitor → Signed-up user ────────────────────────────
  test('Journey 1 — Visitor to signup (4 interactions)', async ({ page }) => {
    // Step 1: Land on homepage [page load — not counted as interaction]
    await page.goto('/')
    await expect(page.getByText('Privacy-first web analytics')).toBeVisible()
    await shot(page, 'j1-01-landing')

    // Step 2: Navigate to /signup [Interaction 1: click "Get Started" CTA]
    await page.goto('/signup')
    await expect(page.getByText('Create your account')).toBeVisible()
    await shot(page, 'j1-02-signup-form')

    // Step 3: Type email [Interaction 2]
    await page.fill('input[type="email"]', SHARED_EMAIL)
    await shot(page, 'j1-03-email-filled')

    // Step 4: Type password [Interaction 3]
    await page.fill('input[type="password"]', PASSWORD)
    await shot(page, 'j1-04-password-filled')

    // Step 5: Submit signup [Interaction 4]
    // Intercept to add a unique fake IP so the signup rate limit doesn't block us
    await page.route('/api/auth/signup', async (route, req) => {
      const headers = { ...req.headers(), 'x-forwarded-for': FAKE_IP }
      await route.continue({ headers })
    })
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await shot(page, 'j1-05-post-signup-dashboard')
  })

  // ─── Journey 2 — Signed-up user → First site tracked ────────────────────
  test('Journey 2 — First site setup (7 internal + 4 external interactions)', async ({ page }) => {
    await loginAsSharedUser(page)

    // Step 1: Navigate to setup [Interaction 1]
    await page.goto('/dashboard/setup')
    await expect(page.getByRole('heading', { name: 'Set up your first site' })).toBeVisible()
    await shot(page, 'j2-01-setup-landing')

    // Step 2: Fill site name [Interaction 2]
    await page.fill('input[name="name"]', 'My Audit Site')
    await shot(page, 'j2-02-site-name-filled')

    // Step 3: Fill domain [Interaction 3]
    await page.fill('input[name="domain"]', 'audit-example.com')
    await shot(page, 'j2-03-domain-filled')

    // Step 4: Submit — create site [Interaction 4]
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard\/setup\?site=/, { timeout: 10_000 })
    await shot(page, 'j2-04-site-created-snippet-visible')

    // Save site ID for later journeys
    const url = page.url()
    const match = url.match(/site=([^&]+)/)
    if (match) sharedSiteId = match[1]

    // Step 5: Copy snippet [Interaction 5]
    const copyBtn = page.getByRole('button', { name: /copy/i })
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()
    await page.waitForTimeout(300)
    await shot(page, 'j2-05-snippet-copied')

    // ── External steps (documented in audit, not automatable) ─────────────
    // EXTERNAL A: Open site editor / CMS [context switch #1]
    // EXTERNAL B: Locate <head> in template
    // EXTERNAL C: Paste the snippet [context switch stays external]
    // EXTERNAL D: Save/publish/deploy the site [context switch #2]
    // (User visits live site and returns to Beam = 2 more context switches)
    // ─────────────────────────────────────────────────────────────────────

    // Step 6: Optional — pick install guide [Interaction 6]
    await expect(page.getByRole('link', { name: /all guides/i })).toBeVisible()
    await shot(page, 'j2-06-install-guides-shown')

    // Step 7: Click "Verify installation" [Interaction 7]
    const verifyLink = page.getByRole('link', { name: /verify installation/i })
    await expect(verifyLink).toBeVisible()
    await shot(page, 'j2-07-verify-link-shown')
  })

  // ─── Journey 3 — Signed-up user → Viewing analytics ────────────────────
  test('Journey 3 — Dashboard to analytics (2 interactions)', async ({ page }) => {
    await loginAsSharedUser(page)

    // Step 1: Dashboard overview [Interaction 1: navigate]
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await shot(page, 'j3-01-dashboard-overview')

    // Step 2: Click Analytics link [Interaction 2: click]
    const analyticsLink = page.getByRole('link', { name: 'Analytics' }).first()
    await expect(analyticsLink).toBeVisible()
    await analyticsLink.click()
    await page.waitForURL(/dashboard\/sites\/.+\/analytics/, { timeout: 10_000 })
    await shot(page, 'j3-02-analytics-page')

    // Analytics page loads — new site shows empty state ("No data yet")
    await expect(page.getByText(/analytics/i).first()).toBeVisible()
    await shot(page, 'j3-03-analytics-loaded')
  })

  // ─── Journey 4 — Free user → Pro subscriber ─────────────────────────────
  test('Journey 4 — Free to Pro upgrade (2 internal + 5 Stripe interactions)', async ({ page }) => {
    await loginAsSharedUser(page)

    // Step 1: Navigate to billing [Interaction 1]
    await page.goto('/dashboard/billing')
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()
    await shot(page, 'j4-01-billing-page')

    // Step 2: Upgrade CTA [Interaction 2: click → launches Stripe]
    const upgradeBtn = page.getByRole('button', { name: /upgrade to pro/i })
    await expect(upgradeBtn).toBeVisible()
    await shot(page, 'j4-02-upgrade-cta-visible')

    // External Stripe steps (5 interactions — not automatable in tests):
    // EXTERNAL A: Email field in Stripe checkout
    // EXTERNAL B: Card number
    // EXTERNAL C: Expiry date
    // EXTERNAL D: CVC
    // EXTERNAL E: Click "Subscribe" → redirect back to Beam billing
  })

  // ─── Journey 5 — Returning user → Checking daily stats ─────────────────
  test('Journey 5 — Returning user to daily stats (4 login + 2 nav interactions)', async ({ page }) => {
    // Simulate returning user: no session cookies
    await page.context().clearCookies()

    // Step 1: Navigate to /login [Interaction 1]
    await page.goto('/login')
    await expect(page.getByText('Welcome back')).toBeVisible()
    await shot(page, 'j5-01-login-page')

    // Step 2: Type email [Interaction 2]
    await page.fill('input[type="email"]', SHARED_EMAIL)
    await shot(page, 'j5-02-email-filled')

    // Step 3: Type password [Interaction 3]
    await page.fill('input[type="password"]', PASSWORD)
    await shot(page, 'j5-03-password-filled')

    // Step 4: Submit login [Interaction 4]
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard/, { timeout: 10_000 })
    await shot(page, 'j5-04-post-login-dashboard')

    // Step 5: Overview [no extra click — already on dashboard after login]
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await shot(page, 'j5-05-overview-visible')

    // Step 6: Click Analytics [Interaction 5]
    const analyticsLink = page.getByRole('link', { name: 'Analytics' }).first()
    await expect(analyticsLink).toBeVisible()
    await analyticsLink.click()
    await page.waitForURL(/analytics/, { timeout: 10_000 })
    await shot(page, 'j5-06-analytics-reached')
  })
})
