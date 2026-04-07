# Beam UX Audit

**Date:** 2026-04-06  
**Auditor:** Ralph (autonomous agent, Keylight Digital LLC)  
**Scope:** Dashboard and public pages — mobile responsiveness, empty states, loading performance, navigation, onboarding flow

---

## Summary

5 issues identified; 3 fixed in this audit cycle. 2 documented for future improvement.

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | "No data for range" empty state has no action CTA | Medium | FIXED |
| 2 | "Waiting for data" empty state link is vague | Medium | FIXED |
| 3 | No preconnect hints for CDN resources | Low | FIXED |
| 4 | Chart.js CDN load blocks chart render timing | Low | Documented (deferred) |
| 5 | Login timing oracle (user enumeration via response time) | Low | Documented (deferred) |

---

## Mobile Responsiveness — PASS

Playwright smoke suite verifies 375px no-overflow for all public pages:
- Landing, How It Works, integration hub (`/for`) and all guide pages
- All `/vs/*` comparison pages
- Migration hub and all migration guides (`/migrate/*`)
- Stack scanner, WordPress plugin page, demo page
- Product Hunt and Show HN launch pages
- Switch calculator

Dashboard mobile nav uses off-canvas sidebar with hamburger button, tested via smoke.

**All public page mobile overflow assertions pass.**

---

## Empty States

### Issue 1 — "No data for range" empty state (FIXED)

**Before:**
```
No data for Today
There are no pageviews in this time range. Try a wider range to see historical data.
```
The text advised users to try a wider range, but provided no button to do so. Users had to scroll up and click the range selector manually.

**After:**
```
No data for Today
There are no pageviews in this time range.

[View last 30 days]  [View today]
```
Added two CTA buttons (`View last 30 days` and `View today`) directly in the empty state card. Links use `dashUrl({ range: '30d' })` to preserve any active segment/channel filters.

**File:** `beam/src/routes/dashboard.ts`, `emptyState === 'no-data-in-range'` block

---

### Issue 2 — "Waiting for data" empty state link text (FIXED)

**Before:**
Single text link: "View tracking snippet →"

**After:**
Two buttons:
- `Get tracking snippet →` (primary, indigo, links to site detail)
- `Framework setup guides` (secondary, links to `/for`)

Gives new users a second option: if they're on an unfamiliar platform, they can browse framework-specific setup guides directly from the empty state.

**File:** `beam/src/routes/dashboard.ts`, `emptyState === 'no-data-ever'` block

---

### Verified empty states — PASS

| Location | Empty State | Action CTA |
|----------|-------------|------------|
| Dashboard overview, no sites | "Create your first site" with inline site-creation form | ✓ |
| Setup page, no site yet | Step 1 form (name + domain fields) | ✓ |
| Analytics, first pageview pending | "Waiting for data…" + snippet link + guides link | ✓ (fixed) |
| Analytics, no data for date range | "No data for [range]" + range CTA buttons | ✓ (fixed) |
| Goals page, no goals | "No goals yet" + "Add your first goal" button | ✓ |
| Sites list, no sites | "No sites yet" + "Add site" link | ✓ |

---

## Loading Performance

### Issue 3 — No preconnect hints for CDN resources (FIXED)

Dashboard pages load two external CDN resources:
- `https://cdn.tailwindcss.com` (Tailwind CSS play CDN, ~100KB)
- `https://cdn.jsdelivr.net` (Chart.js on analytics pages, ~200KB)

Without `preconnect` hints, the browser must perform DNS lookup + TCP handshake for each CDN
domain during HTML parse. Adding preconnect tells the browser to start these connections early.

**Fixed:** Added to `layout()` in `beam/src/routes/dashboard.ts`:
```html
<link rel="preconnect" href="https://cdn.tailwindcss.com">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
```

### Issue 4 — Chart.js blocks chart render timing (Documented, not fixed)

The analytics page loads Chart.js synchronously from CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script>
  // inline initialization — depends on chart.js being loaded
  new Chart(...)
</script>
```

Adding `defer` would break the inline chart initialization. The fix requires restructuring
chart initialization to run inside `window.addEventListener('load', ...)` or equivalent.

**Impact:** ~200KB synchronous CDN load on analytics pages. Noticeable on slow connections.

**Recommendation:** Move chart initialization into a deferred callback. Lower priority than
other items given analytics pages are authenticated (users are already engaged).

---

## Navigation — PASS

- **Sidebar active state:** Computed via `currentPath.startsWith(href)` — correctly highlights
  the "Sites" nav item when on `/dashboard/sites/:id/analytics` or any subpage
- **Mobile hamburger:** Off-canvas overlay with close-on-overlay-click — works at 375px
- **Breadcrumbs:** Analytics page shows `← Site Name` link back to site detail — navigable
- **Back to blog:** All blog posts have `← Back to blog` link above the article

---

## Onboarding Flow — PASS

Setup flow at `/dashboard/setup`:
1. New user lands on `/dashboard/setup` after signup (redirected via `return_to=setup`)
2. Step 1: Add site — name + domain form, inline in the page
3. On site creation, redirected to `/dashboard/setup?site=<id>` — Step 1 shows as complete
4. Step 2: Copy snippet — code block with copy button
5. Step 3: Verify install — polling card auto-refreshes via `/installation-status` endpoint
6. Verification polling runs for up to 5 minutes, then shows a "Verify manually" fallback link

The flow is linear, single-page, and minimizes context switches. External steps (paste snippet,
deploy, visit site) are documented but not interfered with.

**Interaction count:** 4 internal interactions (fill name, fill domain, submit, copy snippet)
plus 2–4 external steps.

---

## Issue 5 — Login Timing Oracle (Documented, not fixed)

See `SECURITY-AUDIT.md` — Login path skips `verifyPassword()` when user doesn't exist, creating
a timing difference that can identify registered email addresses.

**Risk:** Low. Better suited for a dedicated security hardening pass.

---

## Files Changed

- `beam/src/routes/dashboard.ts` — 3 UX improvements (empty states, preconnect hints)
