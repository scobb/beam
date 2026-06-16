# Verify Panel — "Always Reassure" for Low-Traffic Sites

**Date:** 2026-06-16
**Status:** Design approved, pending spec review
**Author:** Steve Cobb (with Claude)

## Problem

The "Verify installation" panel on the site dashboard collapses two very different
situations into the same alarming amber "Still waiting for a fresh tracking hit"
box with a full troubleshooting checklist:

1. **Never installed** — no pageview or custom event has ever arrived. The
   troubleshooting checklist is appropriate here.
2. **Installed and working, just quiet** — data has arrived historically, but
   nothing in the last 15 minutes. Common for low-traffic sites.

This surfaced as a real support ticket from our first paying customer
(`endorphin.tours`, `guidokroeger@me.com`). Their tracking was working perfectly
— roughly one visit per day — but the verify panel said "Still waiting…", which
read as a malfunction and prompted a worried support email. Low-traffic sites are
exactly the customers most likely to hit this and most likely to churn over a
false alarm.

## Goal

When any tracking data has ever been recorded for a site, the verify panel should
**reassure** the user that installation is working, regardless of whether a hit
landed in the last 15 minutes. The alarming amber state and troubleshooting
checklist should appear **only** when no data has ever arrived.

## Non-Goals

- No ongoing uptime/breakage monitoring. The verify panel is an install-time
  check, not a monitor. If a once-working site's tracking later breaks, this
  panel will still say "verified" — detecting silent breakage is a separate
  future feature (uptime alerts).
- No server-side or schema changes.
- No change to the polling cadence or the snippet-scan feature.

## Design

### Scope

A single front-end function: `renderInstallStatus()` in
`src/routes/dashboard.ts` (~lines 1716–1747). The installation-status endpoint,
`getSiteInstallationSignal()`, the polling loop, and the snippet-check feature are
unchanged.

This is possible with no server work because `getSiteInstallationSignal()`
(`src/routes/dashboard.ts:168`) already returns everything needed:
`hasActivity`, `hasRecentActivity`, `firstSeenAt`, `lastSeenAt`,
`recentWindowMinutes`.

### State model

Three render outcomes instead of two:

| Condition | Today | New |
|---|---|---|
| `hasRecentActivity` (hit in last 15 min) | Green "Installation verified" | **Unchanged** |
| `hasActivity && !hasRecentActivity` (older data, quiet now) | Amber "Still waiting" + full checklist | **Green "Installation verified" — reassuring variant** |
| `!hasActivity` (never any data) | Amber "Still waiting" + checklist | **Unchanged** |

### New reassuring (green) middle state

Rendered when `status.hasActivity && !status.hasRecentActivity`:

- Header: **Installation verified.**
- "Beam has recorded tracking data from this site — your install is working."
- "First seen: *{firstSeenAt}* · Most recent hit: *{lastSeenAt}*"
- "No new hits in the last {recentWindowMinutes} minutes. That's normal for sites
  with low or occasional traffic — reload your own site and it'll appear here
  within a moment."
- `[Open analytics →]` link.
- A collapsed `<details>` element: *"Expected recent traffic but seeing nothing?"*
  that, when expanded, reveals the existing troubleshooting checklist (head
  placement, `data-site-id` match, hard refresh, DevTools Network check).

Uses the same emerald/green styling as the existing `hasRecentActivity` state for
visual consistency.

### Amber state (never installed)

Rendered only when `!status.hasActivity`. Body simplifies to the single
"No pageview or custom event has arrived yet." message plus the always-visible
troubleshooting checklist. The current `staleNote` ternary
(`status.hasActivity ? 'Beam found older data…' : 'No pageview…'`) has its first
branch removed as dead code, since `hasActivity` now routes to the green state.

### Polling

Unchanged. After the initial check, the panel still polls ~9× at 4s intervals
looking for a live hit. For the new middle state this means: the panel shows
reassuring green immediately, and if the user reloads their own site during the
poll window, it **upgrades** to the recent-hit green state ("Most recent hit:
just now"). After the poll window exhausts, it remains reassuring green with the
button reset to "Check again".

## Testing

- `getSiteInstallationSignal()` already returns the correct flags; its existing
  unit tests cover the data layer and need no change.
- Add a Playwright smoke assertion (matching the existing `screenshots/smoke`
  suite) that a site with older-but-not-recent data renders the **green verified**
  state — asserting the "Installation verified" copy is present and the amber
  "Still waiting" copy is absent — and that the troubleshooting checklist is
  present but inside a collapsed `<details>`.
- A site with no data still renders the amber "Still waiting" state with the
  visible checklist (regression guard).

## Staging Verification

Reviewed via an isolated Cloudflare preview URL before promoting to production:

1. `wrangler login` (current local Cloudflare auth is expired as of 2026-06-16).
2. `wrangler versions upload` — publishes the new version to an isolated
   `*.workers.dev` preview URL using the real production D1/KV bindings, without
   taking production traffic.
3. Log into the preview URL and open the verify panel for a low-traffic test site
   whose last hit is **>15 minutes old** (use an existing low-traffic test site,
   or send one test hit and wait 15 minutes) to exercise the new middle state.
   Confirm a never-installed site still shows the amber state.
4. Promote with `wrangler versions deploy` once the visuals are approved.

## Rollback

Pure front-end render change in a single function. Revert the commit (or
`wrangler rollback`) to restore prior behavior. No data migration to unwind.
