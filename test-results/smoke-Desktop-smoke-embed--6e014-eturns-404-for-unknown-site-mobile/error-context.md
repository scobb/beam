# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Desktop smoke >> embed widget returns 404 for unknown site
- Location: test/smoke/smoke.spec.ts:522:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 500
```

# Test source

```ts
  424 |     await page.getByRole('button', { name: 'Delete' }).click()
  425 |     await expect(page.getByText('Signup Complete')).toHaveCount(0)
  426 |     await page.screenshot({ path: 'screenshots/smoke/desktop-goals.png' })
  427 |   })
  428 | 
  429 |   test('switch calculator page loads and shows results', async ({ page }) => {
  430 |     await page.goto('/switch')
  431 |     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  432 |     await expect(page.getByText(/savings calculator/i)).toBeVisible()
  433 | 
  434 |     // Results should be populated after page load (JS runs update() on init)
  435 |     await expect(page.locator('#beam-cost')).not.toHaveText('—')
  436 |     await expect(page.locator('#current-cost')).not.toHaveText('—')
  437 |     await expect(page.locator('#annual-savings')).not.toHaveText('—')
  438 | 
  439 |     // Comparison table should be rendered
  440 |     await expect(page.locator('#comparison-table table')).toBeVisible()
  441 | 
  442 |     // CTA links present
  443 |     await expect(page.getByRole('link', { name: /try the live demo/i }).first()).toBeVisible()
  444 |     await expect(page.getByRole('link', { name: /get started free/i }).first()).toBeVisible()
  445 | 
  446 |     await page.screenshot({ path: 'screenshots/smoke/desktop-switch-calculator.png' })
  447 |   })
  448 | 
  449 |   test('cloudflare web analytics comparison page loads with honest trade-offs', async ({ page }) => {
  450 |     await page.goto('/alternatives')
  451 |     await expect(page.getByRole('link', { name: 'Beam vs Cloudflare Web Analytics' })).toBeVisible()
  452 | 
  453 |     await page.goto('/vs/cloudflare-web-analytics')
  454 |     await expect(page.getByRole('heading', { name: 'Beam vs Cloudflare Web Analytics' })).toBeVisible()
  455 | 
  456 |     await expect(page.getByText(/Goals and custom events/i)).toBeVisible()
  457 |     await expect(page.getByText(/Traffic channels/i)).toBeVisible()
  458 |     await expect(page.getByText(/Change alerts and insights/i)).toBeVisible()
  459 |     await expect(page.getByText(/API access/i)).toBeVisible()
  460 |     await expect(page.getByText(/Embeddable badges/i)).toBeVisible()
  461 |     await expect(page.getByText(/Toggle in Cloudflare dashboard/i)).toBeVisible()
  462 |     await expect(page.getByText(/Included with Cloudflare/i)).toBeVisible()
  463 | 
  464 |     await page.screenshot({ path: 'screenshots/smoke/desktop-vs-cloudflare-web-analytics.png' })
  465 |   })
  466 | 
  467 |   test('product hunt launch page loads with campaign-tagged CTAs and stays out of sitemap', async ({ page }) => {
  468 |     await page.goto('/product-hunt')
  469 |     await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy-first analytics')
  470 |     await expect(page.getByText('Product Hunt Launch')).toBeVisible()
  471 |     await expect(page.getByText('Why this is different from another counter')).toBeVisible()
  472 | 
  473 |     const signupHref = await page.locator('a[data-launch-cta="ph_hero_signup"]').getAttribute('href')
  474 |     expect(signupHref ?? '').toContain('/signup?')
  475 |     expect(signupHref ?? '').toContain('utm_source=producthunt')
  476 |     expect(signupHref ?? '').toContain('utm_medium=launch')
  477 |     expect(signupHref ?? '').toContain('utm_campaign=ph_launch_apr_2026')
  478 |     expect(signupHref ?? '').toContain('ref=product-hunt')
  479 | 
  480 |     const proLoginHref = await page.locator('a[data-launch-cta="ph_footer_login_pro"]').getAttribute('href')
  481 |     expect(proLoginHref ?? '').toContain('/login?')
  482 |     expect(proLoginHref ?? '').toContain('intent=pro')
  483 |     expect(proLoginHref ?? '').toContain('utm_source=producthunt')
  484 | 
  485 |     const sitemapRes = await page.request.get('/sitemap.xml')
  486 |     expect(sitemapRes.status()).toBe(200)
  487 |     const sitemapXml = await sitemapRes.text()
  488 |     expect(sitemapXml).not.toContain('/product-hunt')
  489 | 
  490 |     await page.screenshot({ path: 'screenshots/smoke/desktop-product-hunt-launch.png' })
  491 |   })
  492 | 
  493 |   test('show hn launch page loads with technical content and campaign-tagged CTAs', async ({ page }) => {
  494 |     await page.goto('/show-hn')
  495 |     await expect(page.getByRole('heading', { level: 1 })).toContainText('Cookie-free analytics')
  496 |     await expect(page.getByText('Show HN Launch')).toBeVisible()
  497 |     await expect(page.getByRole('heading', { level: 2, name: 'Technical snapshot' })).toBeVisible()
  498 |     await expect(page.getByRole('heading', { level: 2, name: 'What Beam does not do (yet)' })).toBeVisible()
  499 |     await expect(page.getByRole('link', { name: /How it works/i }).first()).toBeVisible()
  500 |     await expect(page.getByRole('link', { name: /Live Demo/i }).first()).toBeVisible()
  501 | 
  502 |     const signupHref = await page.locator('a[data-launch-cta="hn_hero_signup"]').getAttribute('href')
  503 |     expect(signupHref ?? '').toContain('/signup?')
  504 |     expect(signupHref ?? '').toContain('utm_source=hackernews')
  505 |     expect(signupHref ?? '').toContain('utm_medium=launch')
  506 |     expect(signupHref ?? '').toContain('utm_campaign=show_hn_apr_2026')
  507 |     expect(signupHref ?? '').toContain('ref=show-hn')
  508 | 
  509 |     const proLoginHref = await page.locator('a[data-launch-cta="hn_footer_login_pro"]').getAttribute('href')
  510 |     expect(proLoginHref ?? '').toContain('/login?')
  511 |     expect(proLoginHref ?? '').toContain('intent=pro')
  512 |     expect(proLoginHref ?? '').toContain('utm_source=hackernews')
  513 | 
  514 |     const sitemapRes = await page.request.get('/sitemap.xml')
  515 |     expect(sitemapRes.status()).toBe(200)
  516 |     const sitemapXml = await sitemapRes.text()
  517 |     expect(sitemapXml).not.toContain('/show-hn')
  518 | 
  519 |     await page.screenshot({ path: 'screenshots/smoke/desktop-show-hn-launch.png' })
  520 |   })
  521 | 
  522 |   test('embed widget returns 404 for unknown site', async ({ page }) => {
  523 |     const res = await page.request.get('/embed/00000000-0000-0000-0000-000000000000')
> 524 |     expect(res.status()).toBe(404)
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  525 |   })
  526 | 
  527 |   test('embed widget is accessible for a public site', async ({ page }) => {
  528 |     const email = uniqueEmail()
  529 |     await signupAndGetSession(page, email)
  530 | 
  531 |     // Create a site
  532 |     await page.goto('/dashboard/sites/new')
  533 |     await page.fill('input[name="name"]', 'Embed Smoke Site')
  534 |     await page.fill('input[name="domain"]', 'embed-smoke.example.com')
  535 |     await page.click('button[type="submit"]')
  536 |     await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
  537 |     const siteId = page.url().split('/dashboard/sites/')[1]
  538 | 
  539 |     // Enable public dashboard
  540 |     await page.click('button[type="submit"]:has-text("Public: Off")')
  541 |     await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)
  542 | 
  543 |     // Embed iframe snippet should now be visible
  544 |     await expect(page.getByRole('heading', { name: 'Embeddable Widget' })).toBeVisible()
  545 |     await expect(page.locator('#embed-iframe')).toBeVisible()
  546 | 
  547 |     // Embed route itself should return 200
  548 |     const res = await page.request.get(`/embed/${siteId}`)
  549 |     expect(res.status()).toBe(200)
  550 |     const body = await res.text()
  551 |     expect(body).toContain('Powered by Beam')
  552 |     expect(body).toContain('pageviews')
  553 | 
  554 |     await page.screenshot({ path: 'screenshots/smoke/desktop-embed-widget.png' })
  555 |   })
  556 | })
  557 | 
  558 | // ── Mobile smoke ──────────────────────────────────────────────────────────────
  559 | 
  560 | test.describe('Mobile smoke', () => {
  561 |   // Force a mobile viewport for this entire describe block regardless of which
  562 |   // Playwright project runs it (desktop project uses 1280px which hides the
  563 |   // sm:hidden mobile top bar — we always want mobile behaviour here).
  564 |   // isMobile + hasTouch ensure the viewport meta tag is respected the same way
  565 |   // as a real mobile browser (without them, Desktop Chrome at 375px doesn't
  566 |   // honour the viewport meta and produces false horizontal-overflow failures).
  567 |   test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
  568 |   test('landing page loads without horizontal overflow', async ({ page }) => {
  569 |     await page.goto('/')
  570 |     await expect(page.getByText('Privacy-first web analytics')).toBeVisible()
  571 |     await assertNoHorizontalOverflow(page, 'landing page')
  572 |     await page.screenshot({ path: 'screenshots/smoke/mobile-landing.png' })
  573 |   })
  574 | 
  575 |   test('how it works page is mobile-safe at 375px', async ({ page }) => {
  576 |     await page.goto('/how-it-works')
  577 |     await expect(page.getByRole('heading', { level: 1, name: /how beam works on cloudflare's edge/i })).toBeVisible()
  578 |     await assertNoHorizontalOverflow(page, 'how it works page')
  579 |   })
  580 | 
  581 |   test('integration guides are mobile-safe at 375px', async ({ page }) => {
  582 |     await page.goto('/for')
  583 |     await expect(page.getByRole('heading', { name: /integration guides/i })).toBeVisible()
  584 |     await assertNoHorizontalOverflow(page, 'integration hub page')
  585 | 
  586 |     await page.goto('/for/hugo')
  587 |     await expect(page.getByRole('heading', { name: 'Beam for Hugo' })).toBeVisible()
  588 |     await assertNoHorizontalOverflow(page, 'hugo guide page')
  589 | 
  590 |     await page.goto('/for/webflow')
  591 |     await expect(page.getByRole('heading', { name: 'Beam for Webflow' })).toBeVisible()
  592 |     await assertNoHorizontalOverflow(page, 'webflow guide page')
  593 | 
  594 |     await page.goto('/for/shopify')
  595 |     await expect(page.getByRole('heading', { name: 'Beam for Shopify' })).toBeVisible()
  596 |     await assertNoHorizontalOverflow(page, 'shopify guide page')
  597 | 
  598 |     await page.goto('/for/ghost')
  599 |     await expect(page.getByRole('heading', { name: 'Beam for Ghost' })).toBeVisible()
  600 |     await assertNoHorizontalOverflow(page, 'ghost guide page')
  601 | 
  602 |     await page.goto('/for/astro')
  603 |     await expect(page.getByRole('heading', { name: 'Beam for Astro' })).toBeVisible()
  604 |     await assertNoHorizontalOverflow(page, 'astro guide page')
  605 | 
  606 |     await page.goto('/for/remix')
  607 |     await expect(page.getByRole('heading', { name: 'Beam for Remix' })).toBeVisible()
  608 |     await assertNoHorizontalOverflow(page, 'remix guide page')
  609 |     await page.screenshot({ path: 'screenshots/smoke/mobile-for-remix.png' })
  610 |   })
  611 | 
  612 |   test('wordpress guide is mobile-safe with plugin install instructions', async ({ page }) => {
  613 |     await page.goto('/for/wordpress')
  614 |     await expect(page.getByRole('heading', { name: 'Beam for WordPress' })).toBeVisible()
  615 |     await expect(page.getByRole('heading', { name: /Option A - Install the official Beam plugin package/i })).toBeVisible()
  616 |     await assertNoHorizontalOverflow(page, 'wordpress guide page')
  617 |   })
  618 | 
  619 |   test('wordpress plugin landing page is mobile-safe at 375px', async ({ page }) => {
  620 |     await page.goto('/wordpress-plugin')
  621 |     await expect(page.getByRole('heading', { name: 'Beam WordPress Plugin' })).toBeVisible()
  622 |     await expect(page.getByRole('heading', { name: /Hosted Beam account vs WordPress plugin installer/i })).toBeVisible()
  623 |     await assertNoHorizontalOverflow(page, 'wordpress plugin landing page')
  624 |   })
```