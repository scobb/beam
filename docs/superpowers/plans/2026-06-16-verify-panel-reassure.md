# Verify Panel "Always Reassure" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a site has ever recorded tracking data, the "Verify installation" panel shows a reassuring "Installation verified" state instead of the alarming amber "Still waiting" box, with the troubleshooting checklist demoted into a collapsed expander.

**Architecture:** Pure front-end change to a single client-side render function (`renderInstallStatus`) embedded as a string in the server-rendered dashboard template. No endpoint, schema, or polling changes — the installation-status endpoint already returns the `hasActivity` / `hasRecentActivity` flags this needs. Verified deterministically via a Playwright smoke test that intercepts the installation-status fetch.

**Tech Stack:** Hono + Cloudflare Workers (TypeScript), server-rendered HTML with inline client JS, Playwright smoke tests against local `wrangler dev` + local D1.

**Spec:** `docs/superpowers/specs/2026-06-16-verify-panel-reassure-design.md`

---

## File Structure

- **Modify:** `src/routes/dashboard.ts` — the `renderInstallStatus()` function (~lines 1716–1747), inside the inline client script template literal. Add a new "older data" reassuring branch and simplify the amber branch to the never-installed case only.
- **Modify:** `test/smoke/smoke.spec.ts` — add one Desktop smoke test exercising the new reassuring state via network interception.

No new files. The change is small and follows existing patterns in both files.

---

## Prerequisite (one-time, run once before Task 1)

Apply local D1 migrations so `wrangler dev` (auto-started by Playwright) has a schema:

Run: `npm run migrations:local`
Expected: migrations apply cleanly to the local database (or "No migrations to apply" if already applied).

---

### Task 1: Add the failing smoke test (RED)

**Files:**
- Modify: `test/smoke/smoke.spec.ts` — add a new test inside the `test.describe('Desktop smoke', ...)` block, immediately after the existing `'site detail shows installation verification flow'` test (after its closing `})` near line 357).

- [ ] **Step 1: Add the new test**

Insert this test:

```ts
  test('verify panel reassures low-traffic sites with older data', async ({ page }) => {
    const email = uniqueEmail()
    await signupAndGetSession(page, email)

    await page.goto('/dashboard/sites/new')
    await page.fill('input[name="name"]', 'Low Traffic Site')
    await page.fill('input[name="domain"]', 'low-traffic.example.com')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/sites\/[0-9a-f-]+$/)

    // Simulate a low-traffic site: data exists historically, but nothing in the
    // last 15 minutes. Intercept the installation-status fetch with a synthetic
    // "older data" payload so the render branch is exercised deterministically.
    await page.route('**/installation-status', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          hasActivity: true,
          hasRecentActivity: false,
          firstSeenAt: '2026-05-25T14:15:54.000Z',
          lastSeenAt: '2026-06-15T07:38:31.000Z',
          recentWindowMinutes: 15,
        }),
      })
    })

    await page.getByRole('button', { name: 'Verify installation' }).click()

    // Reassuring green state — not the alarming amber state.
    await expect(page.getByText('Installation verified.')).toBeVisible()
    await expect(page.getByText(/normal for sites with low or occasional traffic/i)).toBeVisible()
    await expect(page.getByText('Still waiting for a fresh tracking hit.')).toHaveCount(0)

    // Troubleshooting checklist is demoted into a collapsed <details>.
    const checklistItem = page.getByText(/Place the Beam script inside your site/i)
    await expect(checklistItem).toBeHidden()
    await page.getByText('Expected recent traffic but seeing nothing?').click()
    await expect(checklistItem).toBeVisible()

    await page.screenshot({ path: 'screenshots/smoke/desktop-verify-low-traffic.png' })
  })
```

- [ ] **Step 2: Run the test and verify it FAILS**

Run: `npx playwright test --project=desktop -g "verify panel reassures"`
Expected: FAIL. With the current code, a `hasActivity: true` / `hasRecentActivity: false` payload renders the amber "Still waiting for a fresh tracking hit." box, so `getByText('Installation verified.')` is not visible and the `toHaveCount(0)` assertion on "Still waiting…" fails.

---

### Task 2: Implement the reassuring state (GREEN)

**Files:**
- Modify: `src/routes/dashboard.ts:1733-1746` — replace the `staleNote` ternary and the amber `innerHTML` block.

- [ ] **Step 1: Replace the staleNote + amber block**

Find this block (starts right after the `hasRecentActivity` branch's closing `}`):

```js
        const staleNote = status && status.hasActivity
          ? 'Beam found older data (last hit ' + escapeHtml(formatTimestamp(status.lastSeenAt)) + '), but nothing in the last ' + escapeHtml(status.recentWindowMinutes || 15) + ' minutes.'
          : 'No pageview or custom event has arrived yet.';

        verifyStatusEl.innerHTML = '<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">'
          + '<p class="text-sm font-semibold text-amber-900">Still waiting for a fresh tracking hit.</p>'
          + '<p class="text-sm text-amber-800 mt-1">' + staleNote + '</p>'
          + '<ul class="mt-2 space-y-1 text-xs text-amber-900 list-disc pl-5">'
          + '<li>Place the Beam script inside your site <code>&lt;head&gt;</code> section.</li>'
          + '<li>Confirm <code>data-site-id="' + escapeHtml('${site.id}') + '"</code> matches this site.</li>'
          + '<li>Hard refresh after publishing in case a cached script/version is still loading.</li>'
          + '<li>Use browser DevTools Network + manual page refresh to trigger and confirm a <code>POST /api/collect</code> test hit.</li>'
          + '</ul>'
          + '</div>';
```

Replace it with (adds the reassuring "older data" branch before a simplified never-installed amber block):

```js
        if (status && status.hasActivity) {
          var recentWindow = status.recentWindowMinutes || 15;
          verifyStatusEl.innerHTML = '<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">'
            + '<p class="text-sm font-semibold text-emerald-900">Installation verified.</p>'
            + '<p class="text-sm text-emerald-800 mt-1">Beam has recorded tracking data from this site — your install is working.</p>'
            + '<p class="text-xs text-emerald-700 mt-1">First seen: <strong>' + escapeHtml(formatTimestamp(status.firstSeenAt)) + '</strong> · Most recent hit: ' + escapeHtml(formatTimestamp(status.lastSeenAt)) + '</p>'
            + '<p class="text-sm text-emerald-800 mt-2">No new hits in the last ' + escapeHtml(recentWindow) + ' minutes. That is normal for sites with low or occasional traffic — reload your own site and a new hit will appear here within a moment.</p>'
            + '<a href="' + analyticsRoute + '" class="inline-block mt-2 text-sm font-medium text-emerald-900 underline">Open analytics →</a>'
            + '<details class="mt-3">'
            + '<summary class="text-xs font-medium text-emerald-900 cursor-pointer">Expected recent traffic but seeing nothing?</summary>'
            + '<ul class="mt-2 space-y-1 text-xs text-emerald-900 list-disc pl-5">'
            + '<li>Place the Beam script inside your site <code>&lt;head&gt;</code> section.</li>'
            + '<li>Confirm <code>data-site-id="' + escapeHtml('${site.id}') + '"</code> matches this site.</li>'
            + '<li>Hard refresh after publishing in case a cached script/version is still loading.</li>'
            + '<li>Use browser DevTools Network + manual page refresh to trigger and confirm a <code>POST /api/collect</code> test hit.</li>'
            + '</ul>'
            + '</details>'
            + '</div>';
          return;
        }

        verifyStatusEl.innerHTML = '<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">'
          + '<p class="text-sm font-semibold text-amber-900">Still waiting for a fresh tracking hit.</p>'
          + '<p class="text-sm text-amber-800 mt-1">No pageview or custom event has arrived yet.</p>'
          + '<ul class="mt-2 space-y-1 text-xs text-amber-900 list-disc pl-5">'
          + '<li>Place the Beam script inside your site <code>&lt;head&gt;</code> section.</li>'
          + '<li>Confirm <code>data-site-id="' + escapeHtml('${site.id}') + '"</code> matches this site.</li>'
          + '<li>Hard refresh after publishing in case a cached script/version is still loading.</li>'
          + '<li>Use browser DevTools Network + manual page refresh to trigger and confirm a <code>POST /api/collect</code> test hit.</li>'
          + '</ul>'
          + '</div>';
```

Notes:
- The copy deliberately avoids apostrophes ("That is", "a new hit will appear") because this string lives inside a backtick template literal; an unescaped `'` would break the generated client JS.
- `${site.id}` is interpolated server-side (it is inside the outer template literal) — keep it exactly as written; it is unchanged from the original.

- [ ] **Step 2: Run the new test and verify it PASSES**

Run: `npx playwright test --project=desktop -g "verify panel reassures"`
Expected: PASS.

- [ ] **Step 3: Run the existing verify tests and verify NO regression**

Run: `npx playwright test -g "verification"`
Expected: PASS for both `site detail shows installation verification flow` (desktop) and `site detail verification card is mobile-safe at 375px` (mobile). These use fresh, data-less sites, which still hit the unchanged amber "Still waiting for a fresh tracking hit." branch.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no output / exit 0). Note: the changed code is inside a string literal, so this only confirms the surrounding TypeScript still compiles.

- [ ] **Step 5: Commit**

```bash
git add src/routes/dashboard.ts test/smoke/smoke.spec.ts
git commit -m "feat: verify panel reassures low-traffic sites instead of warning

When a site has older tracking data but nothing in the last 15 minutes,
show a green 'Installation verified' state with the troubleshooting checklist
demoted into a collapsed <details>, instead of the alarming amber 'Still
waiting' box. The amber state now appears only when no data has ever arrived.

Surfaced by first paying customer support ticket (low-traffic site).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Staging visual review (manual — preview URL)

No code changes. Confirm the visuals on an isolated Cloudflare preview before promoting to production, per the spec.

- [ ] **Step 1: Authenticate (local Cloudflare auth is expired as of 2026-06-16)**

Run (in the user's interactive shell): `npx wrangler login`
Expected: browser OAuth completes; `wrangler whoami` shows the account.

- [ ] **Step 2: Upload an isolated preview version**

Run: `npx wrangler versions upload --config wrangler-noroutesdeploy.toml`
Expected: a new version is created and wrangler prints a `*.workers.dev` preview URL. This uses the real production D1/KV bindings but does NOT take production traffic.

- [ ] **Step 3: Review the new states on the preview URL**

- Log into the preview URL.
- Open the verify panel for a low-traffic site whose last hit is **>15 minutes old** (an existing low-traffic test site, or send one test hit and wait 15 minutes), click "Verify installation", and confirm the new **green "Installation verified"** reassuring state renders, with the troubleshooting checklist collapsed under "Expected recent traffic but seeing nothing?".
- Open the verify panel for a brand-new site with no data and confirm it still shows the amber "Still waiting for a fresh tracking hit." state with the visible checklist.

- [ ] **Step 4: Promote to production once approved**

Run: `npx wrangler versions deploy`
Expected: the reviewed version becomes the active production version. (If not approved, discard by simply not promoting; the live version is unchanged.)

---

## Self-Review

**Spec coverage:**
- "Three-state model / reassuring middle state" → Task 2, Step 1 (new `hasActivity` branch). ✓
- "Amber only when never installed" → Task 2, Step 1 (simplified amber block; dead `staleNote` ternary removed). ✓
- "Checklist demoted into collapsed `<details>`" → Task 2, Step 1 (`<details><summary>…`); asserted in Task 1 test. ✓
- "No server/schema/polling change" → only `renderInstallStatus` and the smoke test are touched. ✓
- "Testing: Playwright smoke for new state + never-installed regression" → Task 1 (new state) + Task 2 Step 3 (regression). ✓
- "Staging via versions upload preview URL" → Task 3. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — all steps contain exact code and commands. ✓

**Type/name consistency:** Status fields used in the test payload (`hasActivity`, `hasRecentActivity`, `firstSeenAt`, `lastSeenAt`, `recentWindowMinutes`) match those returned by `getSiteInstallationSignal` and consumed in `renderInstallStatus`. The render branch reuses existing in-scope identifiers (`verifyStatusEl`, `escapeHtml`, `formatTimestamp`, `analyticsRoute`). ✓
