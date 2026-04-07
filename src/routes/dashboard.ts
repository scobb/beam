import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { buildAnalyticsWindow, selectAnalyticsEmptyState } from '../lib/analytics'
import { buildAcquisitionUserScopeClause, buildAcquisitionWindow } from '../lib/acquisition'
import { buildTrafficChannelSql, normalizeTrafficChannel, type TrafficChannel } from '../lib/channels'
import { maybeSendFirstSiteCreatedAlert, type ActivationAlertUserContext } from '../lib/activationAlerts'
import { generateSiteInsights } from '../lib/insights'
import { getPublicBaseUrl } from '../lib/publicUrl'
import { buildMigrationPlan } from '../lib/migrationAssistant'
import {
  buildBeamSnippetGuidance,
  buildScanGuidance,
  scanAnalyticsStack,
  scanBeamSnippetInstallation,
  type BeamSnippetScanFailure,
  type BeamSnippetScanSuccess,
  type BeamSnippetGuidance,
  type ScanResult,
} from '../lib/stackScanner'
import {
  computeGoalSummaries,
  displayReferrerSource,
  normalizeGoalPattern,
  type GoalRecord,
} from '../lib/goals'
import {
  FATHOM_DAILY_REQUIRED_COLUMNS,
  GOOGLE_ANALYTICS_DAILY_REQUIRED_COLUMNS,
  PLAUSIBLE_DAILY_REQUIRED_COLUMNS,
  type ImportSource,
  normalizeImportJobStatus,
  parseFathomDailyCsv,
  parseGoogleAnalyticsDailyCsv,
  parsePlausibleDailyCsv,
  type ImportJobStatus,
  buildImportCoverageSnapshotQuery,
  resolveImportCoverageWindow,
  type ImportCoverageWindow,
} from '../lib/historicalImports'

const dashboard = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()
const INSTALLATION_RECENT_WINDOW_MINUTES = 15

type SetupIntent = 'pro'
type SetupQueryError = 'limit'

type InstallationSignal = {
  hasActivity: boolean
  hasRecentActivity: boolean
  firstSeenAt: string | null
  lastSeenAt: string | null
  recentWindowMinutes: number
}

type SnippetCheckSuccessResponse = BeamSnippetScanSuccess & {
  checkedAt: string
  guidance: BeamSnippetGuidance
}

type SnippetCheckResponse = SnippetCheckSuccessResponse | (BeamSnippetScanFailure & { checkedAt: string })

type ImportFlashSource = 'google_analytics' | 'plausible' | 'fathom'

type ImportFlashState = {
  source: ImportFlashSource
  tone: 'success' | 'error'
  title: string
  message: string
}

function parseImportFlashState(
  rawSource: string | undefined,
  rawStatus: string | undefined,
  rawMessage: string | undefined,
): ImportFlashState | null {
  const source = rawSource === 'google_analytics' || rawSource === 'plausible' || rawSource === 'fathom' ? rawSource : null
  const status = rawStatus === 'success' || rawStatus === 'error' ? rawStatus : null
  const message = rawMessage?.trim()
  if (!source || !status || !message) return null
  return status === 'success'
    ? { source, tone: 'success', title: 'Import completed', message }
    : { source, tone: 'error', title: 'Import failed', message }
}

function importStatusLabel(status: ImportJobStatus): string {
  if (status === 'completed') return 'Completed'
  if (status === 'failed') return 'Failed'
  if (status === 'processing') return 'Processing'
  return 'Pending'
}

function renderImportCoverageBanner(coverage: ImportCoverageWindow, siteId: string): string {
  if (coverage.mode === 'empty' || coverage.mode === 'native-only') return ''

  if (coverage.mode === 'import-only') {
    return `<div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="import-coverage-banner">
      <p class="text-sm font-semibold text-amber-900">Showing imported history only</p>
      <p class="mt-1 text-sm text-amber-800">
        This data was imported from a previous analytics tool and covers
        <strong>${escHtml(coverage.importedVisibleStartDate ?? '')}</strong> to
        <strong>${escHtml(coverage.importedVisibleEndDate ?? '')}</strong>.
        Beam has not yet collected any native pageviews for this site.
        <a href="/dashboard/sites/${siteId}/migrate" class="underline hover:text-amber-900">Import history or install tracking</a>.
      </p>
    </div>`
  }

  // hybrid mode
  return `<div class="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3" data-testid="import-coverage-banner">
    <p class="text-sm font-semibold text-blue-900">Historical data combines imported and native Beam collection</p>
    <p class="mt-1 text-sm text-blue-800">
      Dates before <strong>${escHtml(coverage.cutoverDate ?? '')}</strong> come from an imported CSV export
      (${escHtml(coverage.importedVisibleStartDate ?? '')} – ${escHtml(coverage.importedVisibleEndDate ?? '')}).
      From <strong>${escHtml(coverage.cutoverDate ?? '')}</strong> onward, data is live Beam tracking.
      Native data is always used when available — imports only fill days with no Beam events.
      <a href="/dashboard/sites/${siteId}/migrate" class="underline hover:text-blue-900">View import details</a>.
    </p>
  </div>`
}

function renderMigrateCoverageSection(coverage: ImportCoverageWindow, siteId: string): string {
  const analyticsLink = `<a href="/dashboard/sites/${siteId}/analytics" class="underline hover:opacity-80">View analytics</a>`

  if (coverage.mode === 'empty') {
    return `<section class="mb-4 rounded-xl border border-gray-200 bg-white p-5" data-testid="migrate-coverage-section">
      <h2 class="text-base font-semibold text-gray-900">Import coverage status</h2>
      <p class="mt-2 text-sm text-gray-500">No native pageviews and no imported history yet. Import a CSV below to backfill trend context, or install the tracking snippet to start live collection.</p>
    </section>`
  }

  if (coverage.mode === 'native-only') {
    return `<section class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5" data-testid="migrate-coverage-section">
      <h2 class="text-base font-semibold text-emerald-900">Import coverage status</h2>
      <p class="mt-2 text-sm text-emerald-800">
        Beam has been collecting native data since <strong>${escHtml(coverage.nativeStartDate ?? '')}</strong>.
        No imported history — all analytics data comes from live Beam tracking.
        ${analyticsLink}.
      </p>
    </section>`
  }

  if (coverage.mode === 'import-only') {
    return `<section class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5" data-testid="migrate-coverage-section">
      <h2 class="text-base font-semibold text-amber-900">Import coverage status: imported history only</h2>
      <p class="mt-2 text-sm text-amber-800">
        Imported data covers <strong>${escHtml(coverage.importedVisibleStartDate ?? '')}</strong> to
        <strong>${escHtml(coverage.importedVisibleEndDate ?? '')}</strong>.
        Beam has not yet collected any native pageviews. Install the tracking snippet to start live collection —
        the switch will be complete once Beam records its first hit on your domain.
      </p>
      <p class="mt-2 text-sm font-semibold text-amber-900">The migration is not yet complete.</p>
    </section>`
  }

  // hybrid
  return `<section class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5" data-testid="migrate-coverage-section">
    <h2 class="text-base font-semibold text-emerald-900">Import coverage status: migration complete</h2>
    <p class="mt-2 text-sm text-emerald-800">
      Beam has been collecting native data since <strong>${escHtml(coverage.cutoverDate ?? '')}</strong> — the migration cutover point.
      Days before <strong>${escHtml(coverage.cutoverDate ?? '')}</strong>
      (${escHtml(coverage.importedVisibleStartDate ?? '')} – ${escHtml(coverage.importedVisibleEndDate ?? '')})
      are filled from your imported CSV history. Native Beam data takes priority wherever both exist.
    </p>
    <p class="mt-2 text-sm font-semibold text-emerald-900">The migration is complete. ${analyticsLink} to see the full trend.</p>
  </section>`
}

async function getSiteInstallationSignal(db: D1Database, siteId: string, now = new Date()): Promise<InstallationSignal> {
  const summary = await db.prepare(
    `SELECT
      MIN(timestamp) as first_seen_at,
      MAX(timestamp) as last_seen_at
     FROM (
      SELECT timestamp FROM pageviews WHERE site_id = ?
      UNION ALL
      SELECT timestamp FROM custom_events WHERE site_id = ?
     )`
  ).bind(siteId, siteId).first<{ first_seen_at: string | null; last_seen_at: string | null }>()

  const firstSeenAt = summary?.first_seen_at ?? null
  const lastSeenAt = summary?.last_seen_at ?? null
  const recentCutoffISO = new Date(now.getTime() - (INSTALLATION_RECENT_WINDOW_MINUTES * 60 * 1000)).toISOString()

  return {
    hasActivity: firstSeenAt !== null,
    hasRecentActivity: lastSeenAt !== null && lastSeenAt >= recentCutoffISO,
    firstSeenAt,
    lastSeenAt,
    recentWindowMinutes: INSTALLATION_RECENT_WINDOW_MINUTES,
  }
}

async function hasAnySiteInstallationSignal(db: D1Database, siteIds: string[]): Promise<boolean> {
  if (siteIds.length === 0) return false

  const placeholders = siteIds.map(() => '?').join(',')
  const pageviewSignal = await db.prepare(
    `SELECT 1 as hit FROM pageviews WHERE site_id IN (${placeholders}) LIMIT 1`
  ).bind(...siteIds).first<{ hit: number }>()
  if (pageviewSignal !== null) return true

  const eventSignal = await db.prepare(
    `SELECT 1 as hit FROM custom_events WHERE site_id IN (${placeholders}) LIMIT 1`
  ).bind(...siteIds).first<{ hit: number }>()

  return eventSignal !== null
}

async function recordFailedImportJob(
  db: D1Database,
  input: {
    siteId: string
    userId: string
    source: ImportSource
    inputFilename: string | null
    errorMessage: string
    nowISO?: string
  }
): Promise<void> {
  const now = input.nowISO ?? new Date().toISOString()
  await db.prepare(
    `INSERT INTO import_jobs (
      id, site_id, user_id, source, status, input_filename,
      row_count, inserted_row_count, error_message, started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'failed', ?, 0, 0, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    input.siteId,
    input.userId,
    input.source,
    input.inputFilename,
    input.errorMessage,
    now,
    now,
    now,
    now,
  ).run()
}

function normalizeSetupIntent(raw: string | undefined): SetupIntent | null {
  return raw === 'pro' ? 'pro' : null
}

function normalizeSetupOffer(raw: string | undefined): string | null {
  if (!raw) return null
  return /^[a-z0-9][a-z0-9-]{1,39}$/i.test(raw) ? raw : null
}

function buildSetupQuery(intent: SetupIntent | null, offer: string | null, siteId?: string, error?: SetupQueryError): string {
  const params = new URLSearchParams()
  if (siteId) params.set('site', siteId)
  if (intent) params.set('intent', intent)
  if (offer) params.set('offer', offer)
  if (error) params.set('error', error)
  const query = params.toString()
  return query ? `?${query}` : ''
}

// ── Layout helper ─────────────────────────────────────────────────────────────

export function layout(title: string, currentPath: string, content: string, seoCanonical?: string, ogImageUrl?: string): string {
  const navItem = (href: string, label: string) => {
    const active = currentPath === href || currentPath.startsWith(href + '/')
    return `<a href="${href}" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
      active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }">${label}</a>`
  }

  const seoTags = seoCanonical
    ? `\n  <meta name="robots" content="index, follow" />\n  <link rel="canonical" href="${seoCanonical}" />`
    : ''
  const ogImageTag = ogImageUrl
    ? `\n  <meta property="og:image" content="${ogImageUrl}" />\n  <meta name="twitter:card" content="summary_large_image" />`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Beam</title>${seoTags}${ogImageTag}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://cdn.tailwindcss.com">
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Mobile sidebar overlay -->
  <div id="mob-overlay" onclick="closeSidebar()" class="fixed inset-0 bg-black/40 z-20 hidden"></div>

  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar: off-canvas on mobile, static on sm+ -->
    <aside id="sidebar" class="fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-200 flex flex-col -translate-x-full transition-transform duration-200 sm:translate-x-0 sm:static sm:z-auto">
      <div class="p-4 border-b border-gray-200">
        <a href="/dashboard" class="text-xl font-bold text-indigo-600">Beam</a>
        <p class="text-xs text-gray-400 mt-0.5">Analytics</p>
      </div>
      <nav class="flex-1 p-3 space-y-1">
        ${navItem('/dashboard', 'Overview')}
        ${navItem('/dashboard/acquisition', 'Acquisition')}
        ${navItem('/dashboard/launch', 'Launch')}
        ${navItem('/dashboard/sites', 'Sites')}
        ${navItem('/dashboard/billing', 'Billing')}
        ${navItem('/dashboard/settings', 'Settings')}
      </nav>
      <div class="p-3 border-t border-gray-200">
        <a href="/api/auth/logout" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition">
          Logout
        </a>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto min-w-0">
      <!-- Mobile top bar -->
      <div class="sm:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <a href="/dashboard" class="text-lg font-bold text-indigo-600">Beam</a>
        <button onclick="toggleSidebar()" class="p-2 rounded-lg hover:bg-gray-100" aria-label="Open navigation">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>
      ${content}
    </main>
  </div>
  <script>
    function toggleSidebar() {
      const s = document.getElementById('sidebar');
      const o = document.getElementById('mob-overlay');
      const isOpen = !s.classList.contains('-translate-x-full');
      s.classList.toggle('-translate-x-full', isOpen);
      o.classList.toggle('hidden', isOpen);
    }
    function closeSidebar() {
      document.getElementById('sidebar').classList.add('-translate-x-full');
      document.getElementById('mob-overlay').classList.add('hidden');
    }
  </script>
</body>
</html>`
}

// ── Overview (/dashboard) ─────────────────────────────────────────────────────

dashboard.get('/dashboard', async (c) => {
  const user = c.get('user')

  // Fetch plan from DB (JWT may be stale after upgrade)
  const dbUser = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?').bind(user.sub).first<{ plan: string }>()
  const plan = dbUser?.plan ?? 'free'
  const isPro = plan === 'pro'

  const sites = await c.env.DB.prepare(
    'SELECT id, name, domain, created_at FROM sites WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.sub).all<{ id: string; name: string; domain: string; created_at: string }>()

  // Monthly usage for usage bar
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  const siteIds = (sites.results ?? []).map(s => s.id)
  let monthlyPageviews = 0
  if (siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',')
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM pageviews WHERE site_id IN (${placeholders}) AND timestamp >= ? AND timestamp < ?`
    ).bind(...siteIds, monthStart, monthEnd).first<{ count: number }>()
    monthlyPageviews = countResult?.count ?? 0
  }

  // Onboarding checklist state
  const hasSite = siteIds.length > 0
  const hasInstallationSignal = hasSite && await hasAnySiteInstallationSignal(c.env.DB, siteIds)
  const allDone = hasSite && hasInstallationSignal

  const checkItem = (done: boolean, label: string, cta: string) =>
    `<div class="flex items-center gap-3">
      ${done
        ? `<span class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">✓</span>`
        : `<span class="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0"></span>`}
      <span class="text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700'}">${label}</span>
      ${cta}
    </div>`

  const pvLimit = isPro ? 500000 : 50000
  const pvPct = Math.min(100, Math.round((monthlyPageviews / pvLimit) * 100))
  const pvBarColor = pvPct >= 95 ? 'bg-red-500' : pvPct >= 80 ? 'bg-yellow-400' : 'bg-green-500'

  const siteCards = (sites.results ?? []).map(s => `
    <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-gray-900 truncate">${escHtml(s.name)}</p>
        <p class="text-sm text-gray-500 truncate">${escHtml(s.domain)}</p>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <a href="/dashboard/sites/${s.id}/analytics" class="text-indigo-600 hover:underline text-sm">Analytics</a>
        <a href="/dashboard/sites/${s.id}/goals" class="text-indigo-600 hover:underline text-sm">Goals</a>
        <a href="/dashboard/sites/${s.id}" class="text-indigo-600 hover:underline text-sm">Manage →</a>
      </div>
    </div>`).join('')

  const content = `
    <div class="p-4 sm:p-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Overview</h1>
          <p class="text-gray-500 text-sm mt-1">${escHtml(user.email)} · ${isPro ? 'Pro' : 'Free'} plan</p>
        </div>
        <a href="/dashboard/sites/new" class="inline-block self-start bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          Add Site
        </a>
      </div>

      ${!isPro && pvPct >= 90 ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-5 flex items-start justify-between gap-3">
          <p class="text-sm text-yellow-800">You've used <strong>${pvPct}%</strong> of your monthly pageview limit.</p>
          <a href="/dashboard/billing" class="text-sm font-medium text-yellow-900 underline whitespace-nowrap shrink-0">Upgrade to Pro →</a>
        </div>
      ` : ''}

      ${(sites.results ?? []).length === 0 ? `
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p class="text-gray-400 text-lg mb-4">No sites yet</p>
          <a href="/dashboard/sites/new" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            Add your first site
          </a>
        </div>
      ` : `<div class="space-y-3 mb-5">${siteCards}</div>`}

      <!-- Usage bar -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div class="flex justify-between text-sm mb-1.5">
          <span class="text-gray-600 font-medium">Pageviews this month</span>
          <span class="font-semibold text-gray-900">${monthlyPageviews.toLocaleString()} / ${pvLimit.toLocaleString()}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
          <div class="${pvBarColor} h-2 rounded-full" style="width: ${pvPct}%"></div>
        </div>
      </div>

      ${!allDone ? `
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Getting started</h2>
          <div class="space-y-3">
            ${checkItem(hasSite, 'Add your first site', !hasSite ? '<a href="/dashboard/sites/new" class="ml-auto text-xs font-medium text-indigo-600 hover:underline">Add site →</a>' : '')}
            ${checkItem(hasInstallationSignal, 'Install the tracking snippet on your site', hasSite && !hasInstallationSignal ? '<a href="/dashboard/sites" class="ml-auto text-xs font-medium text-indigo-600 hover:underline">Get snippet →</a>' : '')}
            ${checkItem(hasInstallationSignal, 'Receive your first pageview or event', '')}
          </div>
        </div>
      ` : ''}
    </div>`

  return c.html(layout('Overview', '/dashboard', content))
})

// ── First-session setup (/dashboard/setup) ──────────────────────────────────

dashboard.get('/dashboard/setup', async (c) => {
  const user = c.get('user')
  const setupIntent = normalizeSetupIntent(c.req.query('intent'))
  const setupOffer = normalizeSetupOffer(c.req.query('offer'))
  const selectedSiteId = c.req.query('site')
  const limitError = c.req.query('error') === 'limit'

  const sitesResult = await c.env.DB.prepare(
    'SELECT id, name, domain, created_at FROM sites WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.sub).all<{ id: string; name: string; domain: string; created_at: string }>()

  const sites = sitesResult.results ?? []
  const selectedSite = selectedSiteId ? sites.find((site) => site.id === selectedSiteId) ?? null : null

  // Existing users should keep the normal post-auth destination.
  if (!selectedSite && sites.length > 0) {
    return c.redirect('/dashboard')
  }

  const baseUrl = getPublicBaseUrl(c.env)
  const snippet = selectedSite
    ? `&lt;script defer src="${baseUrl}/js/beam.js" data-site-id="${selectedSite.id}"&gt;&lt;/script&gt;`
    : ''
  const billingUrl = setupOffer
    ? `/dashboard/billing?offer=${encodeURIComponent(setupOffer)}`
    : '/dashboard/billing'

  const proIntentBanner = setupIntent === 'pro'
    ? `<div class="rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-900 mb-4">
        <p><strong>Pro intent saved.</strong> Finish installation now, then open billing to apply your launch offer${setupOffer ? ` <code class="rounded bg-fuchsia-100 px-1 py-0.5">${escHtml(setupOffer)}</code>` : ''}.</p>
        <a href="${billingUrl}" class="inline-flex items-center mt-2 text-sm font-semibold underline">Open Pro checkout →</a>
      </div>`
    : ''

  const addSiteStep = selectedSite
    ? `<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p class="text-sm font-semibold text-emerald-900">Step 1 complete: site added</p>
        <p class="text-sm text-emerald-800 mt-1">${escHtml(selectedSite.name)} · ${escHtml(selectedSite.domain)}</p>
      </div>`
    : `<div class="bg-white rounded-xl border border-gray-200 p-5">
        ${limitError ? `
          <div class="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 mb-4">
            <strong>Free plan limit reached.</strong> Upgrade to Pro to add more sites.
            <a href="${billingUrl}" class="ml-1 underline font-medium">Open billing</a>
          </div>
        ` : ''}
        <h2 class="text-base font-semibold text-gray-900">Step 1: Add your site</h2>
        <p class="text-sm text-gray-500 mt-1">Create your first site so Beam can generate your tracking snippet.</p>
        <form method="POST" action="/dashboard/sites" class="mt-4 space-y-4">
          <input type="hidden" name="return_to" value="setup" />
          ${setupIntent ? '<input type="hidden" name="intent" value="pro" />' : ''}
          ${setupOffer ? `<input type="hidden" name="offer" value="${escHtml(setupOffer)}" />` : ''}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
            <input type="text" name="name" required placeholder="My Website"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input type="text" name="domain" required placeholder="example.com"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <button type="submit" class="w-full sm:w-auto inline-flex items-center justify-center bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition">
            Create site and continue
          </button>
        </form>
      </div>`

  const installSteps = selectedSite
    ? `
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h2 class="text-base font-semibold text-gray-900">Step 2: Copy your snippet</h2>
        <p class="text-sm text-gray-500 mt-1">Add this one-line script in your website <code class="bg-gray-100 px-1 rounded">&lt;head&gt;</code>.</p>
        <div class="relative mt-3">
          <pre id="setup-snippet" class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">${snippet}</pre>
          <button onclick="copySetupSnippet()" class="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded transition">
            Copy
          </button>
        </div>
      </div>

      <div id="setup-install-status" class="bg-indigo-50 rounded-xl border border-indigo-100 p-5">
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0"></span>
          <h2 class="text-base font-semibold text-indigo-900">Waiting for your first pageview&hellip;</h2>
        </div>
        <p class="text-sm text-indigo-700 mt-1">Visit your site after adding the snippet. This card updates automatically.</p>
      </div>
      <script>
        (function() {
          var siteId = '${selectedSite.id}';
          var analyticsUrl = '/dashboard/sites/' + siteId + '/analytics';
          var statusUrl = '/dashboard/sites/' + siteId + '/installation-status';
          var maxPolls = 60;
          var polls = 0;
          var pollId = setInterval(function() {
            polls++;
            if (polls >= maxPolls) { clearInterval(pollId); return; }
            fetch(statusUrl)
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.hasActivity) {
                  clearInterval(pollId);
                  var card = document.getElementById('setup-install-status');
                  if (card) {
                    card.className = 'bg-emerald-50 rounded-xl border border-emerald-200 p-5';
                    card.innerHTML = '<div class="flex items-center gap-2"><span class="text-emerald-600 font-bold text-lg">\u2713</span><h2 class="text-base font-semibold text-emerald-900">First pageview received!</h2></div><p class="text-sm text-emerald-700 mt-1">Beam is collecting data from your site.</p><a href="' + analyticsUrl + '" class="inline-block mt-3 text-sm font-semibold text-emerald-800 underline">Open analytics \u2192</a>';
                  }
                }
              })
              .catch(function() {});
          }, 5000);
        })();
      </script>

      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h2 class="text-base font-semibold text-gray-900">Step 3: Pick your install guide</h2>
        <p class="text-sm text-gray-500 mt-1">Use the guide closest to your stack:</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a href="/for" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">All guides</a>
          <a href="/for/wordpress" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">WordPress</a>
          <a href="/for/webflow" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Webflow</a>
          <a href="/for/ghost" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Ghost</a>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h2 class="text-base font-semibold text-gray-900">Step 4: Verify installation</h2>
        <p class="text-sm text-gray-500 mt-1">Publish your site, visit it once, then run verification.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a href="/dashboard/sites/${selectedSite.id}#verify-installation" class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">Verify installation →</a>
          <a href="/dashboard/sites/${selectedSite.id}/analytics" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Open analytics</a>
        </div>
      </div>
    `
    : `
      <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        Step 2-4 unlock right after you create your first site.
      </div>
    `

  const content = `
    <div class="p-4 sm:p-8 max-w-3xl">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Set up your first site</h1>
        <p class="text-gray-500 text-sm mt-1">Follow this path once, then Beam keeps running quietly in the background.</p>
      </div>
      ${proIntentBanner}
      <div class="space-y-4">
        ${addSiteStep}
        ${installSteps}
      </div>
    </div>
    <script>
      function copySetupSnippet() {
        const el = document.getElementById('setup-snippet');
        if (!el) return;
        const raw = el.textContent
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');
        navigator.clipboard.writeText(raw).then(() => {
          const btn = document.querySelector('button[onclick="copySetupSnippet()"]');
          if (!btn) return;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      }
    </script>
  `

  return c.html(layout('Setup', '/dashboard', content))
})

type AcquisitionFunnelRow = {
  source: string
  campaign: string
  offer_code: string
  signups: number
  sites_created: number
  first_pageview_received: number
  checkout_started: number
  checkout_completed: number
}

type LaunchRange = '1h' | '24h' | '7d'
type LaunchStage = 'signup' | 'first_site' | 'first_activity' | 'checkout_started' | 'checkout_completed'

type LaunchWindow = {
  range: LaunchRange
  rangeLabel: string
  timezoneLabel: string
  startDate: Date
  endDate: Date
  startISO: string
  endISO: string
  autoRefreshMs: number
}

type LaunchSourceRow = {
  source: string
  campaign: string
  offer_code: string
  signups: number
  sites_created: number
  first_activity: number
  checkout_started: number
  checkout_completed: number
}

type LaunchActivityRow = {
  happened_at: string
  source: string
  campaign: string
  offer_code: string
  stage: string
}

function normalizeLaunchRange(range: string | undefined): LaunchRange {
  if (range === '1h' || range === '7d') return range
  return '24h'
}

function buildLaunchWindow(now: Date, requestedRange: string | undefined): LaunchWindow {
  const range = normalizeLaunchRange(requestedRange)
  const durationMs = range === '1h'
    ? 60 * 60 * 1000
    : range === '24h'
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000
  const startDate = new Date(now.getTime() - durationMs)
  const autoRefreshMs = range === '1h' ? 30_000 : 60_000

  return {
    range,
    rangeLabel: range === '1h' ? 'Last 1 Hour' : range === '24h' ? 'Last 24 Hours' : 'Last 7 Days',
    timezoneLabel: 'UTC',
    startDate,
    endDate: now,
    startISO: startDate.toISOString(),
    endISO: now.toISOString(),
    autoRefreshMs,
  }
}

function isLaunchStage(value: string): value is LaunchStage {
  return value === 'signup'
    || value === 'first_site'
    || value === 'first_activity'
    || value === 'checkout_started'
    || value === 'checkout_completed'
}

function launchStageLabel(stage: LaunchStage): string {
  switch (stage) {
    case 'signup':
      return 'Signup'
    case 'first_site':
      return 'First site'
    case 'first_activity':
      return 'First pageview/event'
    case 'checkout_started':
      return 'Checkout started'
    case 'checkout_completed':
      return 'Checkout completed'
  }
}

function launchStageBadge(stage: LaunchStage): string {
  const label = launchStageLabel(stage)
  if (stage === 'checkout_completed') {
    return `<span class="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">${label}</span>`
  }
  if (stage === 'checkout_started') {
    return `<span class="inline-flex items-center rounded-full bg-fuchsia-100 text-fuchsia-800 px-2 py-0.5 text-xs font-medium">${label}</span>`
  }
  if (stage === 'first_activity') {
    return `<span class="inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-xs font-medium">${label}</span>`
  }
  if (stage === 'first_site') {
    return `<span class="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">${label}</span>`
  }

  return `<span class="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-medium">${label}</span>`
}

function formatUtcTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return escHtml(value)
  return escHtml(date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'))
}

dashboard.get('/dashboard/acquisition', async (c) => {
  const window = buildAcquisitionWindow(new Date(), c.req.query('range'))
  const includeInternal = c.req.query('include_internal') === '1'
  const externalOnlyClause = buildAcquisitionUserScopeClause(includeInternal, 'u')

  const acquisitionRowsResult = await c.env.DB.prepare(
    `WITH first_pageview_sites AS (
      SELECT DISTINCT site_id
      FROM pageviews
    )
    SELECT
      COALESCE(NULLIF(TRIM(u.first_touch_utm_source), ''), NULLIF(TRIM(u.first_touch_ref), ''), NULLIF(TRIM(u.first_touch_referrer_host), ''), 'Direct') as source,
      COALESCE(NULLIF(TRIM(u.first_touch_utm_campaign), ''), '-') as campaign,
      COALESCE(NULLIF(TRIM(u.checkout_offer_code), ''), '-') as offer_code,
      COUNT(*) as signups,
      SUM(CASE WHEN u.first_site_id IS NOT NULL THEN 1 ELSE 0 END) as sites_created,
      SUM(CASE WHEN fps.site_id IS NOT NULL THEN 1 ELSE 0 END) as first_pageview_received,
      SUM(CASE WHEN u.stripe_customer_id IS NOT NULL THEN 1 ELSE 0 END) as checkout_started,
      SUM(CASE WHEN u.stripe_subscription_id IS NOT NULL OR u.plan = 'pro' THEN 1 ELSE 0 END) as checkout_completed
    FROM users u
    LEFT JOIN first_pageview_sites fps ON fps.site_id = u.first_site_id
    WHERE u.created_at >= ? AND u.created_at < ?
    ${externalOnlyClause}
    GROUP BY source, campaign, offer_code
    ORDER BY signups DESC, sites_created DESC, first_pageview_received DESC
    LIMIT 100`
  ).bind(window.startISO, window.endISO).all<AcquisitionFunnelRow>()

  const acquisitionRows = (acquisitionRowsResult.results ?? []).map((row) => ({
    source: row.source || 'Direct',
    campaign: row.campaign || '-',
    offer_code: row.offer_code || '-',
    signups: Number(row.signups ?? 0),
    sites_created: Number(row.sites_created ?? 0),
    first_pageview_received: Number(row.first_pageview_received ?? 0),
    checkout_started: Number(row.checkout_started ?? 0),
    checkout_completed: Number(row.checkout_completed ?? 0),
  }))

  const totals = acquisitionRows.reduce((acc, row) => {
    acc.signups += row.signups
    acc.sitesCreated += row.sites_created
    acc.firstPageviewReceived += row.first_pageview_received
    acc.checkoutStarted += row.checkout_started
    acc.checkoutCompleted += row.checkout_completed
    return acc
  }, {
    signups: 0,
    sitesCreated: 0,
    firstPageviewReceived: 0,
    checkoutStarted: 0,
    checkoutCompleted: 0,
  })

  const rangeBtnClass = (r: string) =>
    `px-3 py-1.5 text-sm rounded-lg font-medium transition ${window.range === r ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`

  function acquisitionUrl(overrides: Record<string, string | null> = {}): string {
    const params: Record<string, string> = { range: window.range }
    if (includeInternal) params['include_internal'] = '1'

    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) delete params[k]
      else params[k] = v
    }

    const queryString = new URLSearchParams(params).toString()
    return queryString ? `?${queryString}` : ''
  }

  const pct = (value: number, total: number): string => (total > 0 ? `${Math.round((value / total) * 100)}%` : '0%')
  const funnelCell = (value: number, total: number) => `${value.toLocaleString()} <span class="text-xs text-gray-400">(${pct(value, total)})</span>`

  const rowsHtml = acquisitionRows.map((row, idx) => `
    <tr class="${idx % 2 !== 0 ? 'bg-gray-50' : ''} border-b border-gray-50 last:border-0">
      <td class="py-2.5 px-4 text-sm text-gray-800 font-medium">${escHtml(row.source)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.campaign)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.offer_code)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${row.signups.toLocaleString()}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${funnelCell(row.sites_created, row.signups)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${funnelCell(row.first_pageview_received, row.signups)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${funnelCell(row.checkout_started, row.signups)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${funnelCell(row.checkout_completed, row.signups)}</td>
    </tr>
  `).join('')

  const content = `
    <div class="p-4 sm:p-8">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Acquisition</h1>
          <p class="text-gray-500 text-sm mt-1">Source-to-activation funnel for signup cohorts in ${escHtml(window.rangeLabel.toLowerCase())}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="${acquisitionUrl({ range: '7d' })}" class="${rangeBtnClass('7d')}">7 Days</a>
          <a href="${acquisitionUrl({ range: '30d' })}" class="${rangeBtnClass('30d')}">30 Days</a>
          <a href="${acquisitionUrl({ range: '90d' })}" class="${rangeBtnClass('90d')}">90 Days</a>
          <a href="${acquisitionUrl({ include_internal: includeInternal ? null : '1' })}" class="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">
            ${includeInternal ? 'External Only' : 'Include Internal/Verification'}
          </a>
        </div>
      </div>

      <div class="mb-4 rounded-xl border ${includeInternal ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50'} px-4 py-3">
        <p class="text-sm ${includeInternal ? 'text-amber-900' : 'text-blue-900'}">
          ${includeInternal
            ? 'Showing external plus internal/verification traffic for debugging.'
            : 'Showing external customer traffic only by default. Internal/test/verification signups are excluded unless you enable debug mode.'}
        </p>
      </div>

      <div class="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p class="text-sm text-gray-700">
          Signup cohorts are grouped by first-touch source, campaign, and checkout offer code, then tracked through first site creation, first pageview, and billing intent stages.
          Timezone: <strong>${window.timezoneLabel}</strong>.
        </p>
      </div>

      ${acquisitionRows.length === 0 ? `
        <div class="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p class="text-gray-500 text-lg">No attributed signups in ${escHtml(window.rangeLabel.toLowerCase())}</p>
          <p class="text-sm text-gray-400 mt-2">Once new users sign up, this funnel shows which sources activate and convert.</p>
          ${includeInternal ? '' : `<a href="${acquisitionUrl({ include_internal: '1' })}" class="inline-block mt-4 text-sm text-indigo-600 hover:underline">Include internal/verification signups for debugging</a>`}
        </div>
      ` : `
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signups</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">${totals.signups.toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sites Created</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">${totals.sitesCreated.toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">First Pageview</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">${totals.firstPageviewReceived.toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checkout Started</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">${totals.checkoutStarted.toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checkout Completed</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">${totals.checkoutCompleted.toLocaleString()}</p>
          </div>
        </div>

        ${(totals.checkoutStarted === 0 && totals.checkoutCompleted === 0) ? `
          <div class="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p class="text-sm text-gray-600">Billing-intent columns are empty for this cohort. They populate as Stripe checkout activity is recorded.</p>
          </div>
        ` : ''}

        <div class="bg-white rounded-xl border border-gray-200">
          <div class="px-5 py-4 border-b border-gray-100">
            <h2 class="text-sm font-semibold text-gray-700">Source/Campaign Funnel</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-max">
              <thead class="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Offer</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signups</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sites Created</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">First Pageview</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Checkout Started</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Checkout Completed</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `}
    </div>`

  return c.html(layout('Acquisition', '/dashboard/acquisition', content))
})

dashboard.get('/dashboard/launch', async (c) => {
  const window = buildLaunchWindow(new Date(), c.req.query('range'))
  const includeInternal = c.req.query('include_internal') === '1'
  const externalOnlyClause = buildAcquisitionUserScopeClause(includeInternal, 'u')
  const stageRangeParams = [
    window.startISO, window.endISO,
    window.startISO, window.endISO,
    window.startISO, window.endISO,
    window.startISO, window.endISO,
    window.startISO, window.endISO,
  ]

  const stageEventsCte = `
    WITH first_site_activity AS (
      SELECT site_id, MIN(timestamp) as first_activity_at
      FROM (
        SELECT site_id, timestamp FROM pageviews
        UNION ALL
        SELECT site_id, timestamp FROM custom_events
      )
      GROUP BY site_id
    ),
    stage_events AS (
      SELECT
        u.id as user_id,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_source), ''), NULLIF(TRIM(u.first_touch_ref), ''), NULLIF(TRIM(u.first_touch_referrer_host), ''), 'Direct') as source,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_campaign), ''), '-') as campaign,
        COALESCE(NULLIF(TRIM(u.checkout_offer_code), ''), NULLIF(TRIM(u.first_touch_offer_code), ''), '-') as offer_code,
        u.created_at as happened_at,
        'signup' as stage
      FROM users u
      WHERE u.created_at >= ? AND u.created_at < ?
      ${externalOnlyClause}
      UNION ALL
      SELECT
        u.id as user_id,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_source), ''), NULLIF(TRIM(u.first_touch_ref), ''), NULLIF(TRIM(u.first_touch_referrer_host), ''), 'Direct') as source,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_campaign), ''), '-') as campaign,
        COALESCE(NULLIF(TRIM(u.checkout_offer_code), ''), NULLIF(TRIM(u.first_touch_offer_code), ''), '-') as offer_code,
        u.first_site_created_at as happened_at,
        'first_site' as stage
      FROM users u
      WHERE u.first_site_created_at IS NOT NULL
        AND u.first_site_created_at >= ? AND u.first_site_created_at < ?
      ${externalOnlyClause}
      UNION ALL
      SELECT
        u.id as user_id,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_source), ''), NULLIF(TRIM(u.first_touch_ref), ''), NULLIF(TRIM(u.first_touch_referrer_host), ''), 'Direct') as source,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_campaign), ''), '-') as campaign,
        COALESCE(NULLIF(TRIM(u.checkout_offer_code), ''), NULLIF(TRIM(u.first_touch_offer_code), ''), '-') as offer_code,
        fsa.first_activity_at as happened_at,
        'first_activity' as stage
      FROM users u
      JOIN first_site_activity fsa ON fsa.site_id = u.first_site_id
      WHERE fsa.first_activity_at >= ? AND fsa.first_activity_at < ?
      ${externalOnlyClause}
      UNION ALL
      SELECT
        u.id as user_id,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_source), ''), NULLIF(TRIM(u.first_touch_ref), ''), NULLIF(TRIM(u.first_touch_referrer_host), ''), 'Direct') as source,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_campaign), ''), '-') as campaign,
        COALESCE(NULLIF(TRIM(u.checkout_offer_code), ''), NULLIF(TRIM(u.first_touch_offer_code), ''), '-') as offer_code,
        u.updated_at as happened_at,
        'checkout_started' as stage
      FROM users u
      WHERE u.stripe_customer_id IS NOT NULL
        AND u.updated_at >= ? AND u.updated_at < ?
      ${externalOnlyClause}
      UNION ALL
      SELECT
        u.id as user_id,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_source), ''), NULLIF(TRIM(u.first_touch_ref), ''), NULLIF(TRIM(u.first_touch_referrer_host), ''), 'Direct') as source,
        COALESCE(NULLIF(TRIM(u.first_touch_utm_campaign), ''), '-') as campaign,
        COALESCE(NULLIF(TRIM(u.checkout_offer_code), ''), NULLIF(TRIM(u.first_touch_offer_code), ''), '-') as offer_code,
        u.updated_at as happened_at,
        'checkout_completed' as stage
      FROM users u
      WHERE (u.stripe_subscription_id IS NOT NULL OR u.plan = 'pro')
        AND u.updated_at >= ? AND u.updated_at < ?
      ${externalOnlyClause}
    )
  `

  const sourceRowsResult = await c.env.DB.prepare(
    `${stageEventsCte}
    SELECT
      source,
      campaign,
      offer_code,
      SUM(CASE WHEN stage = 'signup' THEN 1 ELSE 0 END) as signups,
      SUM(CASE WHEN stage = 'first_site' THEN 1 ELSE 0 END) as sites_created,
      SUM(CASE WHEN stage = 'first_activity' THEN 1 ELSE 0 END) as first_activity,
      SUM(CASE WHEN stage = 'checkout_started' THEN 1 ELSE 0 END) as checkout_started,
      SUM(CASE WHEN stage = 'checkout_completed' THEN 1 ELSE 0 END) as checkout_completed
    FROM stage_events
    GROUP BY source, campaign, offer_code
    ORDER BY signups DESC, sites_created DESC, first_activity DESC
    LIMIT 100`
  ).bind(...stageRangeParams).all<LaunchSourceRow>()

  const activityRowsResult = await c.env.DB.prepare(
    `${stageEventsCte}
    SELECT happened_at, source, campaign, offer_code, stage
    FROM stage_events
    ORDER BY happened_at DESC
    LIMIT 100`
  ).bind(...stageRangeParams).all<LaunchActivityRow>()

  const sourceRows = (sourceRowsResult.results ?? []).map((row) => ({
    source: row.source || 'Direct',
    campaign: row.campaign || '-',
    offer_code: row.offer_code || '-',
    signups: Number(row.signups ?? 0),
    sites_created: Number(row.sites_created ?? 0),
    first_activity: Number(row.first_activity ?? 0),
    checkout_started: Number(row.checkout_started ?? 0),
    checkout_completed: Number(row.checkout_completed ?? 0),
  }))

  const activityRows = (activityRowsResult.results ?? []).map((row) => ({
    happened_at: row.happened_at,
    source: row.source || 'Direct',
    campaign: row.campaign || '-',
    offer_code: row.offer_code || '-',
    stage: isLaunchStage(row.stage) ? row.stage : 'signup',
  }))

  const totals = sourceRows.reduce((acc, row) => {
    acc.signups += row.signups
    acc.sitesCreated += row.sites_created
    acc.firstActivity += row.first_activity
    acc.checkoutStarted += row.checkout_started
    acc.checkoutCompleted += row.checkout_completed
    return acc
  }, {
    signups: 0,
    sitesCreated: 0,
    firstActivity: 0,
    checkoutStarted: 0,
    checkoutCompleted: 0,
  })

  const stageNames = {
    signups: launchStageLabel('signup'),
    sitesCreated: launchStageLabel('first_site'),
    firstActivity: launchStageLabel('first_activity'),
    checkoutStarted: launchStageLabel('checkout_started'),
    checkoutCompleted: launchStageLabel('checkout_completed'),
  }

  const rangeBtnClass = (r: LaunchRange) =>
    `px-3 py-1.5 text-sm rounded-lg font-medium transition ${window.range === r ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`

  function launchUrl(overrides: Record<string, string | null> = {}): string {
    const params: Record<string, string> = { range: window.range }
    if (includeInternal) params['include_internal'] = '1'

    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) delete params[key]
      else params[key] = value
    }

    const queryString = new URLSearchParams(params).toString()
    return queryString ? `?${queryString}` : ''
  }

  const sourceRowsHtml = sourceRows.map((row, idx) => `
    <tr class="${idx % 2 !== 0 ? 'bg-gray-50' : ''} border-b border-gray-50 last:border-0">
      <td class="py-2.5 px-4 text-sm text-gray-800 font-medium">${escHtml(row.source)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.campaign)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.offer_code)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${row.signups.toLocaleString()}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${row.sites_created.toLocaleString()}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${row.first_activity.toLocaleString()}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${row.checkout_started.toLocaleString()}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${row.checkout_completed.toLocaleString()}</td>
    </tr>
  `).join('')

  const activityRowsHtml = activityRows.map((row, idx) => `
    <tr class="${idx % 2 !== 0 ? 'bg-gray-50' : ''} border-b border-gray-50 last:border-0">
      <td class="py-2.5 px-4 text-sm text-gray-700 whitespace-nowrap">${formatUtcTimestamp(row.happened_at)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.source)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.campaign)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${escHtml(row.offer_code)}</td>
      <td class="py-2.5 px-4 text-sm text-gray-700">${launchStageBadge(row.stage)}</td>
    </tr>
  `).join('')

  const content = `
    <div class="p-4 sm:p-8">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Launch Control Room</h1>
          <p class="text-gray-500 text-sm mt-1">Live activation monitor for ${escHtml(window.rangeLabel.toLowerCase())}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="${launchUrl({ range: '1h' })}" class="${rangeBtnClass('1h')}">1 Hour</a>
          <a href="${launchUrl({ range: '24h' })}" class="${rangeBtnClass('24h')}">24 Hours</a>
          <a href="${launchUrl({ range: '7d' })}" class="${rangeBtnClass('7d')}">7 Days</a>
          <a href="${launchUrl({ include_internal: includeInternal ? null : '1' })}" class="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">
            ${includeInternal ? 'External Only' : 'Include Internal/Verification'}
          </a>
          <a href="${launchUrl()}" class="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">
            Refresh now
          </a>
        </div>
      </div>

      <div class="mb-4 rounded-xl border ${includeInternal ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50'} px-4 py-3">
        <p class="text-sm ${includeInternal ? 'text-amber-900' : 'text-blue-900'}">
          ${includeInternal
            ? 'Showing external plus internal/verification activity for debugging.'
            : 'Showing external customer activity only by default. Internal/test/verification accounts are excluded unless you enable debug mode.'}
        </p>
      </div>

      <div class="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p class="text-sm text-gray-700">
          Time window: <strong>${escHtml(window.rangeLabel)}</strong> (${formatUtcTimestamp(window.startISO)} to ${formatUtcTimestamp(window.endISO)}).
          Timezone: <strong>${window.timezoneLabel}</strong>. Auto-refresh runs every ${Math.floor(window.autoRefreshMs / 1000)} seconds.
        </p>
        <p class="text-xs text-gray-500 mt-2">
          Checkout stages are inferred from stored Stripe state and <code class="bg-gray-100 px-1 rounded">users.updated_at</code> because Stripe webhooks do not currently persist dedicated milestone timestamps.
        </p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.signups}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">${totals.signups.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.sitesCreated}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">${totals.sitesCreated.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.firstActivity}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">${totals.firstActivity.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.checkoutStarted}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">${totals.checkoutStarted.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.checkoutCompleted}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">${totals.checkoutCompleted.toLocaleString()}</p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 mb-6">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700">Source stage totals</h2>
        </div>
        ${sourceRows.length === 0 ? `
          <div class="p-8 text-center">
            <p class="text-gray-500 text-lg">No launch activity in ${escHtml(window.rangeLabel.toLowerCase())}</p>
            <p class="text-sm text-gray-400 mt-2">As signups and activation events come in, this view will update automatically.</p>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full min-w-max">
              <thead class="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Offer</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.signups}</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.sitesCreated}</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.firstActivity}</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.checkoutStarted}</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${stageNames.checkoutCompleted}</th>
                </tr>
              </thead>
              <tbody>${sourceRowsHtml}</tbody>
            </table>
          </div>
        `}
      </div>

      <div class="bg-white rounded-xl border border-gray-200">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700">Recent activity</h2>
          <p class="text-xs text-gray-500 mt-1">Most recent 100 stage events in this window.</p>
        </div>
        ${activityRows.length === 0 ? `
          <div class="p-8 text-center">
            <p class="text-gray-500">No recent stage events yet.</p>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full min-w-max">
              <thead class="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp (UTC)</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Offer</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                </tr>
              </thead>
              <tbody>${activityRowsHtml}</tbody>
            </table>
          </div>
        `}
      </div>
    </div>
    <script>
      setTimeout(function () {
        window.location.reload()
      }, ${window.autoRefreshMs})
    </script>`

  return c.html(layout('Launch Control Room', '/dashboard/launch', content))
})

// ── Sites list (/dashboard/sites) ────────────────────────────────────────────

dashboard.get('/dashboard/sites', async (c) => {
  const user = c.get('user')
  const sites = await c.env.DB.prepare(
    'SELECT id, name, domain, created_at FROM sites WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.sub).all<{ id: string; name: string; domain: string; created_at: string }>()

  const siteCards = (sites.results ?? []).map(s => `
    <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-gray-900 truncate">${escHtml(s.name)}</p>
        <p class="text-sm text-gray-500 truncate">${escHtml(s.domain)}</p>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <a href="/dashboard/sites/${s.id}/analytics" class="text-indigo-600 hover:underline text-sm">Analytics</a>
        <a href="/dashboard/sites/${s.id}/goals" class="text-indigo-600 hover:underline text-sm">Goals</a>
        <a href="/dashboard/sites/${s.id}" class="text-indigo-600 hover:underline text-sm">Manage →</a>
      </div>
    </div>`).join('')

  const content = `
    <div class="p-4 sm:p-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Sites</h1>
        <a href="/dashboard/sites/new" class="inline-block self-start bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          Add Site
        </a>
      </div>

      ${(sites.results ?? []).length === 0 ? `
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p class="text-gray-400 text-lg mb-4">No sites yet</p>
          <a href="/dashboard/sites/new" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            Add your first site
          </a>
        </div>
      ` : `<div class="space-y-3">${siteCards}</div>`}
    </div>`

  return c.html(layout('Sites', '/dashboard/sites', content))
})

// ── New site form (/dashboard/sites/new) ─────────────────────────────────────

dashboard.get('/dashboard/sites/new', (c) => {
  const error = c.req.query('error')
  const limitBanner = error === 'limit' ? `
    <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-800">
      <strong>Free plan limit reached.</strong> You can only add 1 site on the free plan.
      <a href="/dashboard/billing" class="font-medium underline ml-1">Upgrade to Pro</a> for unlimited sites.
    </div>` : ''

  const content = `
    <div class="p-4 sm:p-8 max-w-lg">
      <div class="mb-6">
        <a href="/dashboard/sites" class="text-sm text-indigo-600 hover:underline">← Back to Sites</a>
        <h1 class="text-2xl font-bold text-gray-900 mt-2">Add a Site</h1>
      </div>
      ${limitBanner}
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form method="POST" action="/dashboard/sites" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
            <input type="text" name="name" required placeholder="My Website"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            <p class="text-xs text-gray-400 mt-1">A friendly name to identify this site</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input type="text" name="domain" required placeholder="example.com"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            <p class="text-xs text-gray-400 mt-1">The domain where you'll install the tracking script</p>
          </div>
          <button type="submit" class="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 transition text-sm">
            Create Site
          </button>
        </form>
      </div>
    </div>`

  return c.html(layout('Add Site', '/dashboard/sites', content))
})

// ── Create site (POST /dashboard/sites) ──────────────────────────────────────

dashboard.post('/dashboard/sites', async (c) => {
  const user = c.get('user')
  const body = await c.req.parseBody()
  const name = (body['name'] as string ?? '').trim()
  const domain = (body['domain'] as string ?? '').trim().toLowerCase().replace(/^https?:\/\//, '')
  const returnTo = (body['return_to'] as string ?? '').trim()
  const setupIntent = normalizeSetupIntent((body['intent'] as string | undefined) ?? undefined)
  const setupOffer = normalizeSetupOffer((body['offer'] as string | undefined) ?? undefined)
  const shouldReturnToSetup = returnTo === 'setup'

  if (!name || !domain) {
    if (shouldReturnToSetup) {
      return c.redirect(`/dashboard/setup${buildSetupQuery(setupIntent, setupOffer)}`)
    }
    return c.redirect('/dashboard/sites/new')
  }

  // Enforce free plan: max 1 site
  const dbUser = await c.env.DB.prepare(
    `SELECT
      plan,
      email,
      COALESCE(first_touch_is_internal, 0) as first_touch_is_internal,
      first_touch_ref,
      first_touch_utm_source,
      first_touch_utm_medium,
      first_touch_utm_campaign,
      first_site_alert_sent_at
    FROM users
    WHERE id = ?`
  ).bind(user.sub).first<{
    plan: string
    email: string
    first_touch_is_internal: number
    first_touch_ref: string | null
    first_touch_utm_source: string | null
    first_touch_utm_medium: string | null
    first_touch_utm_campaign: string | null
    first_site_alert_sent_at: string | null
  }>()
  const plan = dbUser?.plan ?? 'free'
  if (plan !== 'pro') {
    const siteCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM sites WHERE user_id = ?').bind(user.sub).first<{ count: number }>()
    if ((siteCount?.count ?? 0) >= 1) {
      if (shouldReturnToSetup) {
        return c.redirect(`/dashboard/setup${buildSetupQuery(setupIntent, setupOffer, undefined, 'limit')}`)
      }
      return c.redirect('/dashboard/sites/new?error=limit')
    }
  }

  const siteId = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    'INSERT INTO sites (id, user_id, domain, name, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(siteId, user.sub, domain, name, now).run()

  await c.env.DB.prepare(
    `UPDATE users
     SET first_site_id = COALESCE(first_site_id, ?),
         first_site_created_at = COALESCE(first_site_created_at, ?),
         updated_at = ?
     WHERE id = ?`
  ).bind(siteId, now, now, user.sub).run()

  if (dbUser) {
    const alertUser: ActivationAlertUserContext = {
      userId: user.sub,
      email: dbUser.email,
      firstTouchIsInternal: dbUser.first_touch_is_internal,
      firstTouchRef: dbUser.first_touch_ref,
      firstTouchUtmSource: dbUser.first_touch_utm_source,
      firstTouchUtmMedium: dbUser.first_touch_utm_medium,
      firstTouchUtmCampaign: dbUser.first_touch_utm_campaign,
      firstSiteAlertSentAt: dbUser.first_site_alert_sent_at,
    }
    c.executionCtx.waitUntil(
      maybeSendFirstSiteCreatedAlert(c.env, {
        user: alertUser,
        siteId,
        siteName: name,
        siteDomain: domain,
        occurredAt: now,
      })
    )
  }

  if (shouldReturnToSetup) {
    return c.redirect(`/dashboard/setup${buildSetupQuery(setupIntent, setupOffer, siteId)}`)
  }

  return c.redirect(`/dashboard/sites/${siteId}`)
})

// ── Site detail (/dashboard/sites/:id) ───────────────────────────────────────

dashboard.get('/dashboard/sites/:id', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain, created_at, public, COALESCE(alerts_enabled, 1) as alerts_enabled FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; name: string; domain: string; created_at: string; public: number; alerts_enabled: number }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const isPublic = site.public === 1
  const alertsEnabled = site.alerts_enabled === 1
  const baseUrl = getPublicBaseUrl(c.env)
  const publicUrl = `${baseUrl}/public/${site.id}`
  const badgeUrl = `${baseUrl}/badge/${site.id}.svg`
  const snippet = `&lt;script defer src="${baseUrl}/js/beam.js" data-site-id="${site.id}"&gt;&lt;/script&gt;`
  const eventSnippet = `window.beam.track('signup', { plan: 'pro', source: 'pricing-page' })`
  const embedUrl = `${baseUrl}/embed/${site.id}`
  const embedIframe = `&lt;iframe src="${embedUrl}" width="320" height="200" frameborder="0" scrolling="no" style="border:none;overflow:hidden"&gt;&lt;/iframe&gt;`
  const badgeMarkdown = `![Beam visitors badge](${badgeUrl})`
  const badgeHtml = `&lt;img src="${badgeUrl}" alt="Beam visitors this month badge" /&gt;`
  const installationSignal = await getSiteInstallationSignal(c.env.DB, site.id)
  const initialInstallStatus = JSON.stringify(installationSignal)

  const content = `
    <div class="p-4 sm:p-8 max-w-2xl">
      <div class="mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <a href="/dashboard/sites" class="text-sm text-indigo-600 hover:underline">← Back to Sites</a>
          <div class="flex flex-wrap gap-2">
            <a href="/dashboard/sites/${site.id}/migrate" class="inline-block self-start sm:self-auto bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Migration Assistant</a>
            <a href="/dashboard/sites/${site.id}/goals" class="inline-block self-start sm:self-auto bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Manage Goals</a>
            <a href="/dashboard/sites/${site.id}/analytics" class="inline-block self-start sm:self-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">View Analytics</a>
          </div>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mt-2">${escHtml(site.name)}</h1>
        <p class="text-gray-500 text-sm">${escHtml(site.domain)}</p>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Tracking Snippet</h2>
        <p class="text-sm text-gray-500 mb-3">Add this snippet to the <code class="bg-gray-100 px-1 rounded">&lt;head&gt;</code> of your website:</p>
        <div class="relative">
          <pre id="snippet" class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">${snippet}</pre>
          <button onclick="copySnippet()" class="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded transition">
            Copy
          </button>
        </div>
      </div>

      <div id="verify-installation" class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Verify installation</h2>
            <p class="text-sm text-gray-500 mt-0.5">Check for a recent pageview or custom event from this site.</p>
          </div>
          <button id="verify-install-btn" type="button" onclick="verifyInstallation()" class="inline-flex items-center justify-center self-start sm:self-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition whitespace-nowrap">
            Verify installation
          </button>
        </div>
        <div id="verify-status" class="mt-4"></div>
        <div class="mt-5 border-t border-gray-100 pt-4">
          <h3 class="text-sm font-semibold text-gray-900">Optional snippet URL check</h3>
          <p class="text-sm text-gray-500 mt-1">
            Fetch a public page and verify whether Beam script markup is present, using this exact site ID.
          </p>
          <div class="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              id="snippet-check-url"
              type="url"
              value="${escHtml(site.domain)}"
              placeholder="https://example.com"
              class="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button id="snippet-check-btn" type="button" onclick="runSnippetCheck()" class="inline-flex items-center justify-center self-start sm:self-auto rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition whitespace-nowrap">
              Scan snippet URL
            </button>
          </div>
          <p class="mt-2 text-xs text-gray-400">Read-only check: Beam fetches public HTML only and never edits your site.</p>
          <div id="snippet-check-status" class="mt-3"></div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Migration assistant</h2>
            <p class="text-sm text-gray-500 mt-0.5">Scan your live domain for existing analytics tags and get vendor-specific replacement steps.</p>
          </div>
          <a href="/dashboard/sites/${site.id}/migrate" class="inline-flex items-center justify-center self-start sm:self-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition whitespace-nowrap">
            Open assistant
          </a>
        </div>
        <p class="text-xs text-gray-400 mt-3">Read-only: Beam only fetches public HTML and never edits your site or third-party tooling.</p>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Custom Events</h2>
        <p class="text-sm text-gray-500 mb-3">Track button clicks, signups, or form submissions anywhere after the Beam script loads:</p>
        <pre class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">${escHtml(eventSnippet)}</pre>
      </div>

      <!-- Public dashboard toggle -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Public Dashboard</h2>
            <p class="text-sm text-gray-500 mt-0.5">Share a read-only analytics view with anyone.</p>
          </div>
          <form method="POST" action="/dashboard/sites/${site.id}/public">
            <button type="submit" class="${isPublic ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-200 hover:bg-gray-300'} text-${isPublic ? 'white' : 'gray-700'} px-4 py-2 rounded-lg text-sm font-medium transition">
              ${isPublic ? 'Public: On' : 'Public: Off'}
            </button>
          </form>
        </div>
        ${isPublic ? `
          <div class="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <a href="${publicUrl}" target="_blank" class="text-indigo-600 text-sm hover:underline truncate flex-1">${publicUrl}</a>
            <button onclick="copyPublicUrl()" class="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap">Copy link</button>
          </div>

          <div class="mt-4 border border-gray-200 rounded-xl p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900">Visitor Badge</h3>
                <p class="text-sm text-gray-500 mt-0.5">Embed this public SVG badge in your README or website.</p>
              </div>
              <img src="${badgeUrl}" alt="Beam visitors this month badge" class="shrink-0" />
            </div>

            <div class="space-y-3">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Markdown</p>
                  <button type="button" onclick="copyBadgeMarkdown()" class="text-xs text-gray-500 hover:text-gray-700">Copy</button>
                </div>
                <pre id="badge-markdown" class="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">${escHtml(badgeMarkdown)}</pre>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">HTML</p>
                  <button type="button" onclick="copyBadgeHtml()" class="text-xs text-gray-500 hover:text-gray-700">Copy</button>
                </div>
                <pre id="badge-html" class="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">${badgeHtml}</pre>
              </div>
            </div>

            <div class="mt-4 border border-gray-200 rounded-xl p-4">
              <div class="mb-3">
                <h3 class="text-sm font-semibold text-gray-900">Embeddable Widget</h3>
                <p class="text-sm text-gray-500 mt-0.5">Paste this iframe into your site's footer or about page to show live visitor stats — and let Beam grow via your audience.</p>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">HTML</p>
                  <button type="button" onclick="copyEmbedIframe()" class="text-xs text-gray-500 hover:text-gray-700">Copy</button>
                </div>
                <pre id="embed-iframe" class="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">${embedIframe}</pre>
              </div>
              <div class="mt-3">
                <p class="text-xs text-gray-500">Preview:</p>
                <div class="mt-2 border border-gray-200 rounded-lg overflow-hidden" style="width:320px;height:200px;max-width:100%">
                  <iframe src="${embedUrl}" width="320" height="200" frameborder="0" scrolling="no" style="border:none;overflow:hidden;width:100%;height:100%"></iframe>
                </div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Traffic Alerts</h2>
            <p class="text-sm text-gray-500 mt-0.5">Email alerts when daily traffic drops by more than 40% or spikes by more than 100% versus your 28-day baseline.</p>
          </div>
          <form method="POST" action="/dashboard/sites/${site.id}/alerts">
            <button type="submit" class="${alertsEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-200 hover:bg-gray-300'} text-${alertsEnabled ? 'white' : 'gray-700'} px-4 py-2 rounded-lg text-sm font-medium transition">
              ${alertsEnabled ? 'Alerts: On' : 'Alerts: Off'}
            </button>
          </form>
        </div>
        <p class="text-xs text-gray-400">Alerts only send when the site has at least 7 days of analytics data.</p>
      </div>

      <div class="bg-white rounded-xl border border-red-100 p-6">
        <h2 class="text-base font-semibold text-red-700 mb-1">Danger Zone</h2>
        <p class="text-sm text-gray-500 mb-3">Permanently delete this site and all its pageview data.</p>
        <form method="POST" action="/dashboard/sites/${site.id}/delete" onsubmit="return confirm('Delete ${escHtml(site.name)}? This cannot be undone.')">
          <button type="submit" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition">
            Delete Site
          </button>
        </form>
      </div>
    </div>
    <script id="initial-install-status" type="application/json">${initialInstallStatus}</script>
    <script>
      function copyCode(id, buttonLabel, buttonSelector) {
        const el = document.getElementById(id);
        if (!el) return;
        const raw = el.textContent
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        navigator.clipboard.writeText(raw).then(() => {
          const btn = document.querySelector(buttonSelector);
          if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = buttonLabel, 2000);
          }
        });
      }
      function copySnippet() {
        copyCode('snippet', 'Copy', 'button[onclick="copySnippet()"]');
      }
      function copyPublicUrl() {
        navigator.clipboard.writeText('${publicUrl}').then(() => {
          const btn = document.querySelector('button[onclick="copyPublicUrl()"]');
          if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy link', 2000); }
        });
      }
      function copyBadgeMarkdown() {
        copyCode('badge-markdown', 'Copy', 'button[onclick="copyBadgeMarkdown()"]');
      }
      function copyBadgeHtml() {
        copyCode('badge-html', 'Copy', 'button[onclick="copyBadgeHtml()"]');
      }
      function copyEmbedIframe() {
        copyCode('embed-iframe', 'Copy', 'button[onclick="copyEmbedIframe()"]');
      }

      const verifyStatusEl = document.getElementById('verify-status');
      const verifyButton = document.getElementById('verify-install-btn');
      const initialInstallStatusEl = document.getElementById('initial-install-status');
      const verifyRoute = '/dashboard/sites/${site.id}/installation-status';
      const snippetCheckRoute = '/dashboard/sites/${site.id}/installation-status/snippet-check';
      const analyticsRoute = '/dashboard/sites/${site.id}/analytics';
      const snippetCheckInput = document.getElementById('snippet-check-url');
      const snippetCheckButton = document.getElementById('snippet-check-btn');
      const snippetCheckStatusEl = document.getElementById('snippet-check-status');
      let verifyPollTimer = null;
      let verifyInFlight = false;
      let verifyAttempts = 0;
      const maxVerifyAttempts = 9;

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function formatTimestamp(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      }

      function stopVerifyPolling() {
        if (verifyPollTimer) {
          clearInterval(verifyPollTimer);
          verifyPollTimer = null;
        }
      }

      function setVerifyButton(label, disabled) {
        if (!verifyButton) return;
        verifyButton.textContent = label;
        verifyButton.disabled = disabled;
        verifyButton.classList.toggle('opacity-70', disabled);
        verifyButton.classList.toggle('cursor-not-allowed', disabled);
      }

      function setSnippetCheckButton(label, disabled) {
        if (!snippetCheckButton) return;
        snippetCheckButton.textContent = label;
        snippetCheckButton.disabled = disabled;
        snippetCheckButton.classList.toggle('opacity-70', disabled);
        snippetCheckButton.classList.toggle('cursor-not-allowed', disabled);
      }

      function renderInstallStatus(status, isChecking) {
        if (!verifyStatusEl) return;
        if (isChecking) {
          verifyStatusEl.innerHTML = '<div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Checking for a fresh tracking hit now. Keep this page open while Beam polls automatically.</div>';
          return;
        }

        if (status && status.hasRecentActivity) {
          verifyStatusEl.innerHTML = '<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">'
            + '<p class="text-sm font-semibold text-emerald-900">Installation verified.</p>'
            + '<p class="text-sm text-emerald-800 mt-1">First seen: <strong>' + escapeHtml(formatTimestamp(status.firstSeenAt)) + '</strong></p>'
            + '<p class="text-xs text-emerald-700 mt-1">Most recent hit: ' + escapeHtml(formatTimestamp(status.lastSeenAt)) + '</p>'
            + '<a href="' + analyticsRoute + '" class="inline-block mt-2 text-sm font-medium text-emerald-900 underline">Open analytics →</a>'
            + '</div>';
          return;
        }

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
      }

      async function fetchInstallStatus() {
        const response = await fetch(verifyRoute, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error('status-failed');
        return response.json();
      }

      function renderSnippetCheck(result) {
        if (!snippetCheckStatusEl) return;
        if (!result.ok) {
          snippetCheckStatusEl.innerHTML = '<div class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">'
            + '<p class="text-sm font-semibold text-rose-900">Snippet scan failed</p>'
            + '<p class="text-sm text-rose-800 mt-1">' + escapeHtml(result.error || 'Unable to scan this page right now.') + '</p>'
            + '</div>';
          return;
        }

        const tone = result.guidance && result.guidance.tone === 'success'
          ? { wrapper: 'border-emerald-200 bg-emerald-50', title: 'text-emerald-900', text: 'text-emerald-800' }
          : { wrapper: 'border-amber-200 bg-amber-50', title: 'text-amber-900', text: 'text-amber-800' };

        const actionItems = (result.guidance?.actionItems || [])
          .map((item) => '<li>' + escapeHtml(item) + '</li>')
          .join('');

        const detectedIds = (result.detectedSiteIds || []).length > 0
          ? escapeHtml(result.detectedSiteIds.join(', '))
          : 'none';

        snippetCheckStatusEl.innerHTML = '<div class="rounded-lg border px-4 py-3 ' + tone.wrapper + '">'
          + '<p class="text-sm font-semibold ' + tone.title + '">' + escapeHtml(result.guidance?.title || 'Snippet scan completed') + '</p>'
          + '<p class="text-sm mt-1 ' + tone.text + '">' + escapeHtml(result.guidance?.summary || '') + '</p>'
          + '<p class="text-xs mt-2 ' + tone.text + '">Scanned URL: <code>' + escapeHtml(result.scannedUrl || '') + '</code></p>'
          + '<p class="text-xs mt-1 ' + tone.text + '">Detected data-site-id values: <strong>' + detectedIds + '</strong></p>'
          + (actionItems
            ? '<ul class="mt-2 space-y-1 text-xs list-disc pl-5 ' + tone.text + '">' + actionItems + '</ul>'
            : '')
          + '<a href="' + escapeHtml(result.guidance?.guidePath || '/for') + '" class="inline-block mt-2 text-xs font-semibold underline ' + tone.title + '">'
          + escapeHtml(result.guidance?.guideLabel || 'Open setup guides') + ' →</a>'
          + '</div>';
      }

      async function runSnippetCheck() {
        if (!snippetCheckInput || !snippetCheckStatusEl) return;
        const rawUrl = snippetCheckInput.value.trim();
        if (!rawUrl) {
          renderSnippetCheck({ ok: false, error: 'Enter a URL to scan.' });
          return;
        }

        setSnippetCheckButton('Scanning...', true);
        snippetCheckStatusEl.innerHTML = '<div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Scanning the page for Beam snippet markup now...</div>';

        try {
          const response = await fetch(snippetCheckRoute + '?url=' + encodeURIComponent(rawUrl), {
            headers: { 'Accept': 'application/json' },
          });
          const payload = await response.json();
          renderSnippetCheck(payload);
        } catch {
          renderSnippetCheck({ ok: false, error: 'Unable to scan this page right now.' });
        } finally {
          setSnippetCheckButton('Scan snippet URL', false);
        }
      }

      async function pollInstallStatus() {
        if (verifyInFlight) return;
        verifyInFlight = true;
        try {
          const status = await fetchInstallStatus();
          renderInstallStatus(status, false);
          const attemptsExhausted = verifyAttempts >= maxVerifyAttempts;
          if (status.hasRecentActivity || attemptsExhausted) {
            stopVerifyPolling();
            setVerifyButton(status.hasRecentActivity ? 'Verified' : 'Check again', false);
          }
        } catch {
          stopVerifyPolling();
          renderInstallStatus(null, false);
          setVerifyButton('Check again', false);
        } finally {
          verifyInFlight = false;
        }
      }

      async function verifyInstallation() {
        stopVerifyPolling();
        verifyAttempts = 0;
        setVerifyButton('Checking...', true);
        renderInstallStatus(null, true);

        try {
          const status = await fetchInstallStatus();
          renderInstallStatus(status, false);
          if (status.hasRecentActivity) {
            setVerifyButton('Verified', false);
            return;
          }
          setVerifyButton('Polling...', true);
          verifyPollTimer = setInterval(() => {
            verifyAttempts += 1;
            void pollInstallStatus();
          }, 4000);
        } catch {
          renderInstallStatus(null, false);
          setVerifyButton('Check again', false);
        }
      }

      if (initialInstallStatusEl) {
        try {
          const initialStatus = JSON.parse(initialInstallStatusEl.textContent || '{}');
          renderInstallStatus(initialStatus, false);
          if (initialStatus && initialStatus.hasRecentActivity) {
            setVerifyButton('Verified', false);
          }
        } catch {
          renderInstallStatus(null, false);
        }
      }

      window.addEventListener('beforeunload', stopVerifyPolling);
    </script>`

  return c.html(layout(site.name, '/dashboard/sites', content))
})

// ── Migration assistant (/dashboard/sites/:id/migrate) ──────────────────────

dashboard.get('/dashboard/sites/:id/migrate', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const shouldScan = c.req.query('scan') === '1'

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; name: string; domain: string }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const baseUrl = getPublicBaseUrl(c.env)
  const trackingSnippet = `<script defer src="${baseUrl}/js/beam.js" data-site-id="${site.id}"></script>`
  const importFlash = parseImportFlashState(
    c.req.query('import_source'),
    c.req.query('import_status'),
    c.req.query('import_message'),
  )

  const importJobsQuery = `SELECT
    id,
    status,
    input_filename,
    coverage_start_date,
    coverage_end_date,
    row_count,
    inserted_row_count,
    error_message,
    created_at,
    completed_at
   FROM import_jobs
   WHERE site_id = ? AND source = ?
   ORDER BY created_at DESC
   LIMIT 8`

  type ImportJobQueryRow = {
    id: string
    status: string
    input_filename: string | null
    coverage_start_date: string | null
    coverage_end_date: string | null
    row_count: number
    inserted_row_count: number
    error_message: string | null
    created_at: string
    completed_at: string | null
  }

  const toImportJobs = (rows: ImportJobQueryRow[]) => rows.map((row) => {
    const normalizedStatus = normalizeImportJobStatus(row.status) ?? 'failed'
    return {
      ...row,
      normalizedStatus,
    }
  })

  const [gaImportJobsResult, plausibleImportJobsResult, fathomImportJobsResult, migrateCoverageSnapshot] = await Promise.all([
    c.env.DB.prepare(importJobsQuery).bind(site.id, 'google_analytics').all<ImportJobQueryRow>(),
    c.env.DB.prepare(importJobsQuery).bind(site.id, 'plausible').all<ImportJobQueryRow>(),
    c.env.DB.prepare(importJobsQuery).bind(site.id, 'fathom').all<ImportJobQueryRow>(),
    c.env.DB.prepare(buildImportCoverageSnapshotQuery())
      .bind(site.id, site.id, site.id, site.id)
      .first<{ native_start_date: string | null; native_end_date: string | null; imported_start_date: string | null; imported_end_date: string | null }>(),
  ])
  const gaImportJobs = toImportJobs(gaImportJobsResult.results ?? [])
  const plausibleImportJobs = toImportJobs(plausibleImportJobsResult.results ?? [])
  const fathomImportJobs = toImportJobs(fathomImportJobsResult.results ?? [])
  const migrateCoverageWindow = resolveImportCoverageWindow({
    nativeStartDate: migrateCoverageSnapshot?.native_start_date ?? null,
    nativeEndDate: migrateCoverageSnapshot?.native_end_date ?? null,
    importedStartDate: migrateCoverageSnapshot?.imported_start_date ?? null,
    importedEndDate: migrateCoverageSnapshot?.imported_end_date ?? null,
  })

  let scanResult: ScanResult | null = null
  if (shouldScan) {
    scanResult = await scanAnalyticsStack(site.domain)
  }

  const scanSection = (() => {
    if (!scanResult) {
      return `<section class="bg-white rounded-xl border border-gray-200 p-5">
        <h2 class="text-base font-semibold text-gray-900">Run migration scan</h2>
        <p class="mt-2 text-sm text-gray-600">
          Beam will fetch your public homepage HTML and detect existing analytics vendors.
          This assistant is read-only and does not modify your site, browser, or third-party accounts.
        </p>
        <form method="GET" action="/dashboard/sites/${site.id}/migrate" class="mt-4">
          <input type="hidden" name="scan" value="1" />
          <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
            Scan ${escHtml(site.domain)}
          </button>
        </form>
      </section>`
    }

    if (!scanResult.ok) {
      return `<section class="bg-rose-50 rounded-xl border border-rose-200 p-5">
        <h2 class="text-base font-semibold text-rose-900">Scan failed</h2>
        <p class="mt-2 text-sm text-rose-800">${escHtml(scanResult.error)}</p>
        <p class="mt-2 text-xs text-rose-700">No changes were made. You can retry after confirming the domain resolves publicly.</p>
        <form method="GET" action="/dashboard/sites/${site.id}/migrate" class="mt-4">
          <input type="hidden" name="scan" value="1" />
          <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition">
            Retry scan
          </button>
        </form>
      </section>`
    }

    const plan = buildMigrationPlan(scanResult.detections)
    const guidance = buildScanGuidance(scanResult.detections)
    const detectionSummary = scanResult.detections.length === 0
      ? 'No supported analytics vendors were detected.'
      : `Detected ${scanResult.detections.length} vendor${scanResult.detections.length === 1 ? '' : 's'}.`

    const detectedCards = scanResult.detections.length === 0
      ? `<p class="text-sm text-gray-600">Beam did not find Google Analytics, GTM, Plausible, Fathom, Simple Analytics, Umami, Matomo, Cloudflare Web Analytics, Vercel Analytics, PostHog, GoatCounter, or Beam on the scanned page.</p>`
      : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${scanResult.detections.map((detection) => {
            const evidenceItems = detection.evidence
              .map((item) => `<li class="text-xs text-gray-600">${escHtml(item)}</li>`)
              .join('')
            return `<article class="rounded-lg border border-gray-200 bg-white p-3">
              <h4 class="text-sm font-semibold text-gray-900">${escHtml(detection.vendorName)}</h4>
              <ul class="mt-2 space-y-1 list-disc pl-4">${evidenceItems}</ul>
            </article>`
          }).join('')}
        </div>`

    const vendorRecommendations = plan.recommendations.length === 0
      ? ''
      : `<section class="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Vendor-Specific Next Steps</h3>
          <div class="mt-3 grid grid-cols-1 gap-3">
            ${plan.recommendations.map((recommendation) => {
              const steps = recommendation.steps
                .map((step) => `<li class="text-sm text-gray-700">${escHtml(step)}</li>`)
                .join('')
              return `<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 class="text-sm font-semibold text-gray-900">${escHtml(recommendation.vendorName)}</h4>
                <ol class="mt-2 list-decimal pl-5 space-y-1">${steps}</ol>
              </article>`
            }).join('')}
          </div>
        </section>`

    const modeBlock = (() => {
      if (plan.mode === 'beam') {
        return `<section class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-emerald-800">Beam Already Installed</h3>
          <p class="mt-2 text-sm text-emerald-900">
            Beam markers were detected on this domain. Move to installation verification to confirm fresh traffic and event collection.
          </p>
          <a href="/dashboard/sites/${site.id}#verify-installation" class="inline-flex items-center justify-center mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
            Go to verification flow
          </a>
        </section>`
      }

      if (plan.mode === 'none') {
        return `<section class="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-indigo-800">No Existing Analytics Detected</h3>
          <p class="mt-2 text-sm text-indigo-900">
            Start with Beam as your first analytics layer, then verify the first hit on this site.
          </p>
          <ol class="mt-3 list-decimal pl-5 space-y-2 text-sm text-indigo-900">
            <li>Add this script in your site <code class="rounded bg-white px-1 py-0.5">&lt;head&gt;</code>:
              <pre class="mt-2 rounded-lg bg-gray-900 text-green-400 p-3 text-xs overflow-x-auto">${escHtml(trackingSnippet)}</pre>
            </li>
            <li>Publish changes, then hard refresh your site to avoid stale cached scripts.</li>
            <li>Open Beam verification and generate a test hit with a manual page refresh.</li>
          </ol>
          <a href="/dashboard/sites/${site.id}#verify-installation" class="inline-flex items-center justify-center mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
            Verify installation
          </a>
        </section>`
      }

      if (plan.mode === 'mixed') {
        return `<section class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-800">Beam + Legacy Stack Detected</h3>
          <p class="mt-2 text-sm text-amber-900">
            Beam is already present, but additional analytics vendors are still active. Verify Beam first, then remove duplicate instrumentation to avoid split reporting.
          </p>
          <a href="/dashboard/sites/${site.id}#verify-installation" class="inline-flex items-center justify-center mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition">
            Verify Beam first
          </a>
        </section>`
      }

      return `<section class="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-indigo-800">Third-Party Stack Detected</h3>
        <p class="mt-2 text-sm text-indigo-900">
          Install Beam, verify first data collection, then retire the legacy scripts using the migration steps below.
        </p>
        <a href="/dashboard/sites/${site.id}" class="inline-flex items-center justify-center mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
          Open tracking snippet
        </a>
      </section>`
    })()

    return `<section class="rounded-xl border border-gray-200 bg-white p-5">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900">Migration scan results</h2>
          <p class="mt-1 text-sm text-gray-600">${escHtml(detectionSummary)}</p>
          <p class="mt-1 text-xs text-gray-500">Scanned URL: <code class="rounded bg-gray-100 px-1 py-0.5">${escHtml(scanResult.scannedUrl)}</code></p>
          <p class="mt-1 text-xs ${plan.hasBeam ? 'text-emerald-700' : 'text-gray-500'}">Beam detected: ${plan.hasBeam ? 'yes' : 'no'}</p>
        </div>
        <form method="GET" action="/dashboard/sites/${site.id}/migrate">
          <input type="hidden" name="scan" value="1" />
          <button type="submit" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Re-scan
          </button>
        </form>
      </div>

      <p class="mt-3 text-sm text-gray-700"><span class="font-semibold">Summary:</span> ${escHtml(guidance.summary)}</p>
      <p class="mt-1 text-sm text-gray-700"><span class="font-semibold">Recommendation:</span> ${escHtml(guidance.recommendation)}</p>

      <div class="mt-4">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Detected Vendors</h3>
        <div class="mt-2">${detectedCards}</div>
      </div>

      ${modeBlock}
      ${vendorRecommendations}
    </section>`
  })()

  const gaImportSection = (() => {
    const flashBanner = importFlash?.source === 'google_analytics'
      ? `<div class="mb-4 rounded-xl border px-4 py-3 ${
        importFlash?.tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-rose-200 bg-rose-50'
      }">
          <p class="text-sm font-semibold ${
            importFlash?.tone === 'success' ? 'text-emerald-900' : 'text-rose-900'
          }">${escHtml(importFlash?.title ?? '')}</p>
          <p class="mt-1 text-sm ${
            importFlash?.tone === 'success' ? 'text-emerald-800' : 'text-rose-800'
          }">${escHtml(importFlash?.message ?? '')}</p>
        </div>`
      : ''

    const importRows = gaImportJobs.length === 0
      ? `<p class="text-sm text-gray-500">No Google Analytics imports yet for this site.</p>`
      : `<div class="overflow-x-auto">
          <table class="w-full min-w-max text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-4">Imported</th>
                <th class="py-2 pr-4">Status</th>
                <th class="py-2 pr-4">Coverage</th>
                <th class="py-2 pr-4">Rows</th>
                <th class="py-2 pr-4">File</th>
                <th class="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              ${gaImportJobs.map((job) => {
                const statusTone = job.normalizedStatus === 'completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : job.normalizedStatus === 'failed'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'

                const coverage = job.coverage_start_date && job.coverage_end_date
                  ? `${job.coverage_start_date} → ${job.coverage_end_date}`
                  : '—'

                const details = job.normalizedStatus === 'failed'
                  ? (job.error_message?.trim() || 'Import failed')
                  : `${job.inserted_row_count.toLocaleString()} stored from ${job.row_count.toLocaleString()} parsed row${job.row_count === 1 ? '' : 's'}`

                return `<tr class="border-b border-gray-100 last:border-0">
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${escHtml(job.created_at.replace('T', ' ').slice(0, 16))}</td>
                  <td class="py-3 pr-4 whitespace-nowrap">
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}">
                      ${escHtml(importStatusLabel(job.normalizedStatus))}
                    </span>
                  </td>
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${escHtml(coverage)}</td>
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${job.row_count.toLocaleString()}</td>
                  <td class="py-3 pr-4 text-gray-700 max-w-xs truncate">${escHtml(job.input_filename || '—')}</td>
                  <td class="py-3 text-gray-600 max-w-lg">${escHtml(details)}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>`

    return `<section class="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      ${flashBanner}
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900">Import Google Analytics history</h2>
          <p class="mt-1 text-sm text-gray-600">Upload one daily GA CSV export to backfill trend context before native Beam tracking exists.</p>
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <p class="text-sm font-semibold text-indigo-900">Supported CSV format (GA4 daily)</p>
        <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-indigo-900">
          <li>Header row must include: <code>${GOOGLE_ANALYTICS_DAILY_REQUIRED_COLUMNS.join(', ')}</code></li>
          <li>One row per day with Date values in <code>YYYY-MM-DD</code> or <code>YYYYMMDD</code>.</li>
          <li>Generate from GA4 as a daily report/export that includes those columns.</li>
        </ul>
        <pre class="mt-3 rounded-lg bg-gray-900 text-green-400 p-3 text-xs overflow-x-auto">Date,Active users,Views
2026-03-01,1234,5678
2026-03-02,1100,5200</pre>
      </div>

      <form method="POST" action="/dashboard/sites/${site.id}/imports/google-analytics" enctype="multipart/form-data" class="mt-4 space-y-3">
        <div>
          <label for="ga_csv" class="block text-sm font-medium text-gray-700 mb-1">Google Analytics CSV file</label>
          <input
            id="ga_csv"
            name="ga_csv"
            type="file"
            accept=".csv,text/csv"
            required
            class="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
          />
        </div>
        <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
          Import Google Analytics CSV
        </button>
      </form>

      <div class="mt-5">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">Recent Imports</h3>
        ${importRows}
      </div>
    </section>`
  })()

  const plausibleImportSection = (() => {
    const flashBanner = importFlash?.source === 'plausible'
      ? `<div class="mb-4 rounded-xl border px-4 py-3 ${
        importFlash?.tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-rose-200 bg-rose-50'
      }">
          <p class="text-sm font-semibold ${
            importFlash?.tone === 'success' ? 'text-emerald-900' : 'text-rose-900'
          }">${escHtml(importFlash?.title ?? '')}</p>
          <p class="mt-1 text-sm ${
            importFlash?.tone === 'success' ? 'text-emerald-800' : 'text-rose-800'
          }">${escHtml(importFlash?.message ?? '')}</p>
        </div>`
      : ''

    const importRows = plausibleImportJobs.length === 0
      ? `<p class="text-sm text-gray-500">No Plausible imports yet for this site.</p>`
      : `<div class="overflow-x-auto">
          <table class="w-full min-w-max text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-4">Imported</th>
                <th class="py-2 pr-4">Status</th>
                <th class="py-2 pr-4">Coverage</th>
                <th class="py-2 pr-4">Rows</th>
                <th class="py-2 pr-4">File</th>
                <th class="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              ${plausibleImportJobs.map((job) => {
                const statusTone = job.normalizedStatus === 'completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : job.normalizedStatus === 'failed'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'

                const coverage = job.coverage_start_date && job.coverage_end_date
                  ? `${job.coverage_start_date} → ${job.coverage_end_date}`
                  : '—'

                const details = job.normalizedStatus === 'failed'
                  ? (job.error_message?.trim() || 'Import failed')
                  : `${job.inserted_row_count.toLocaleString()} stored from ${job.row_count.toLocaleString()} parsed row${job.row_count === 1 ? '' : 's'}`

                return `<tr class="border-b border-gray-100 last:border-0">
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${escHtml(job.created_at.replace('T', ' ').slice(0, 16))}</td>
                  <td class="py-3 pr-4 whitespace-nowrap">
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}">
                      ${escHtml(importStatusLabel(job.normalizedStatus))}
                    </span>
                  </td>
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${escHtml(coverage)}</td>
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${job.row_count.toLocaleString()}</td>
                  <td class="py-3 pr-4 text-gray-700 max-w-xs truncate">${escHtml(job.input_filename || '—')}</td>
                  <td class="py-3 text-gray-600 max-w-lg">${escHtml(details)}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>`

    return `<section class="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      ${flashBanner}
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900">Import Plausible history</h2>
          <p class="mt-1 text-sm text-gray-600">Upload one Plausible daily CSV export to backfill trend context before native Beam tracking exists.</p>
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <p class="text-sm font-semibold text-indigo-900">Supported CSV format (Plausible daily export)</p>
        <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-indigo-900">
          <li>Header row must include: <code>${PLAUSIBLE_DAILY_REQUIRED_COLUMNS.join(', ')}</code></li>
          <li>Date values must use <code>YYYY-MM-DD</code>.</li>
          <li>This import only backfills daily totals (visitors + pageviews), not page-level or campaign breakdowns.</li>
          <li>Generate the CSV from a Plausible daily report/export that includes those columns.</li>
        </ul>
        <pre class="mt-3 rounded-lg bg-gray-900 text-green-400 p-3 text-xs overflow-x-auto">Date,Visitors,Pageviews
2026-03-01,456,1200
2026-03-02,501,1402</pre>
      </div>

      <form method="POST" action="/dashboard/sites/${site.id}/imports/plausible" enctype="multipart/form-data" class="mt-4 space-y-3">
        <div>
          <label for="plausible_csv" class="block text-sm font-medium text-gray-700 mb-1">Plausible CSV file</label>
          <input
            id="plausible_csv"
            name="plausible_csv"
            type="file"
            accept=".csv,text/csv"
            required
            class="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
          />
        </div>
        <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
          Import Plausible CSV
        </button>
      </form>

      <div class="mt-5">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">Recent Imports</h3>
        ${importRows}
      </div>
    </section>`
  })()

  const fathomImportSection = (() => {
    const flashBanner = importFlash?.source === 'fathom'
      ? `<div class="mb-4 rounded-xl border px-4 py-3 ${
        importFlash?.tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-rose-200 bg-rose-50'
      }">
          <p class="text-sm font-semibold ${
            importFlash?.tone === 'success' ? 'text-emerald-900' : 'text-rose-900'
          }">${escHtml(importFlash?.title ?? '')}</p>
          <p class="mt-1 text-sm ${
            importFlash?.tone === 'success' ? 'text-emerald-800' : 'text-rose-800'
          }">${escHtml(importFlash?.message ?? '')}</p>
        </div>`
      : ''

    const importRows = fathomImportJobs.length === 0
      ? `<p class="text-sm text-gray-500">No Fathom imports yet for this site.</p>`
      : `<div class="overflow-x-auto">
          <table class="w-full min-w-max text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-4">Imported</th>
                <th class="py-2 pr-4">Status</th>
                <th class="py-2 pr-4">Coverage</th>
                <th class="py-2 pr-4">Rows</th>
                <th class="py-2 pr-4">File</th>
                <th class="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              ${fathomImportJobs.map((job) => {
                const statusTone = job.normalizedStatus === 'completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : job.normalizedStatus === 'failed'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'

                const coverage = job.coverage_start_date && job.coverage_end_date
                  ? `${job.coverage_start_date} → ${job.coverage_end_date}`
                  : '—'

                const details = job.normalizedStatus === 'failed'
                  ? (job.error_message?.trim() || 'Import failed')
                  : `${job.inserted_row_count.toLocaleString()} stored from ${job.row_count.toLocaleString()} parsed row${job.row_count === 1 ? '' : 's'}`

                return `<tr class="border-b border-gray-100 last:border-0">
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${escHtml(job.created_at.replace('T', ' ').slice(0, 16))}</td>
                  <td class="py-3 pr-4 whitespace-nowrap">
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}">
                      ${escHtml(importStatusLabel(job.normalizedStatus))}
                    </span>
                  </td>
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${escHtml(coverage)}</td>
                  <td class="py-3 pr-4 text-gray-700 whitespace-nowrap">${job.row_count.toLocaleString()}</td>
                  <td class="py-3 pr-4 text-gray-700 max-w-xs truncate">${escHtml(job.input_filename || '—')}</td>
                  <td class="py-3 text-gray-600 max-w-lg">${escHtml(details)}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>`

    return `<section class="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      ${flashBanner}
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900">Import Fathom history</h2>
          <p class="mt-1 text-sm text-gray-600">Upload one Fathom daily CSV export to backfill trend context before native Beam tracking exists.</p>
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <p class="text-sm font-semibold text-indigo-900">Supported CSV format (Fathom daily export)</p>
        <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-indigo-900">
          <li>Header row must include: <code>${FATHOM_DAILY_REQUIRED_COLUMNS.join(', ')}</code></li>
          <li>Date values must use <code>YYYY-MM-DD</code>.</li>
          <li>This import only backfills daily totals (unique visitors + pageviews), not page-level or campaign breakdowns.</li>
          <li>Generate the CSV from Fathom's dashboard using the date range selector and export to CSV. The exported file should include a daily breakdown with those columns.</li>
        </ul>
        <pre class="mt-3 rounded-lg bg-gray-900 text-green-400 p-3 text-xs overflow-x-auto">Date,Unique visitors,Pageviews
2026-03-01,456,1200
2026-03-02,501,1402</pre>
      </div>

      <form method="POST" action="/dashboard/sites/${site.id}/imports/fathom" enctype="multipart/form-data" class="mt-4 space-y-3">
        <div>
          <label for="fathom_csv" class="block text-sm font-medium text-gray-700 mb-1">Fathom CSV file</label>
          <input
            id="fathom_csv"
            name="fathom_csv"
            type="file"
            accept=".csv,text/csv"
            required
            class="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
          />
        </div>
        <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
          Import Fathom CSV
        </button>
      </form>

      <div class="mt-5">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">Recent Imports</h3>
        ${importRows}
      </div>
    </section>`
  })()

  const content = `
    <div class="p-4 sm:p-8 max-w-4xl">
      <div class="mb-6">
        <a href="/dashboard/sites/${site.id}" class="text-sm text-indigo-600 hover:underline">← Back to ${escHtml(site.name)}</a>
        <h1 class="text-2xl font-bold text-gray-900 mt-2">Migration Assistant</h1>
        <p class="text-sm text-gray-500 mt-1">${escHtml(site.domain)}</p>
      </div>

      <div class="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p class="text-sm text-blue-900">Read-only workflow: Beam only fetches public HTML and never mutates your site, browser, or third-party accounts.</p>
      </div>

      ${renderMigrateCoverageSection(migrateCoverageWindow, site.id)}

      ${gaImportSection}
      ${plausibleImportSection}
      ${fathomImportSection}
      ${scanSection}
    </div>`

  return c.html(layout(`Migration Assistant — ${site.name}`, '/dashboard/sites', content))
})

dashboard.post('/dashboard/sites/:id/imports/google-analytics', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const redirectToMigrate = (status: 'success' | 'error', message: string) =>
    `/dashboard/sites/${siteId}/migrate?import_source=google_analytics&import_status=${status}&import_message=${encodeURIComponent(message)}`

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const body = await c.req.parseBody()
  const uploaded = body['ga_csv']
  const file = uploaded instanceof File ? uploaded : null
  const filename = file?.name?.trim() || null
  const now = new Date().toISOString()

  if (!file) {
    const message = 'Choose a CSV file before starting a Google Analytics import.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'google_analytics',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  if (file.size === 0) {
    const message = 'Uploaded file is empty. Export a non-empty CSV from Google Analytics.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'google_analytics',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  if (file.size > 3_000_000) {
    const message = 'CSV file is too large. Keep Google Analytics imports under 3 MB.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'google_analytics',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  const csvText = await file.text()
  const parsed = parseGoogleAnalyticsDailyCsv(csvText)
  if (!parsed.ok) {
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'google_analytics',
      inputFilename: filename,
      errorMessage: parsed.error,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', parsed.error))
  }

  const parsedImport = parsed.value
  const importJobId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO import_jobs (
      id, site_id, user_id, source, status, input_filename,
      coverage_start_date, coverage_end_date, row_count, inserted_row_count,
      started_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'google_analytics', 'processing', ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    importJobId,
    siteId,
    user.sub,
    filename,
    parsedImport.coverageStartDate,
    parsedImport.coverageEndDate,
    parsedImport.rowCount,
    now,
    now,
    now,
  ).run()

  try {
    const UPSERT_BATCH_SIZE = 200
    for (let i = 0; i < parsedImport.rows.length; i += UPSERT_BATCH_SIZE) {
      const chunk = parsedImport.rows.slice(i, i + UPSERT_BATCH_SIZE)
      await c.env.DB.batch(
        chunk.map((row) => c.env.DB.prepare(
          `INSERT INTO imported_daily_traffic (
            site_id, import_job_id, source, date, visitors, pageviews, created_at
          ) VALUES (?, ?, 'google_analytics', ?, ?, ?, ?)
          ON CONFLICT(site_id, source, date) DO UPDATE SET
            import_job_id = excluded.import_job_id,
            visitors = excluded.visitors,
            pageviews = excluded.pageviews,
            created_at = excluded.created_at`
        ).bind(siteId, importJobId, row.date, row.visitors, row.pageviews, now))
      )
    }

    const completedAt = new Date().toISOString()
    await c.env.DB.prepare(
      `UPDATE import_jobs
       SET status = 'completed',
           inserted_row_count = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(parsedImport.rows.length, completedAt, completedAt, importJobId).run()

    const successMessage = `Imported ${parsedImport.rows.length} day${parsedImport.rows.length === 1 ? '' : 's'} (${parsedImport.coverageStartDate} to ${parsedImport.coverageEndDate}).`
    return c.redirect(redirectToMigrate('success', successMessage))
  } catch (error) {
    const completedAt = new Date().toISOString()
    const errorMessage = error instanceof Error
      ? `Import failed while storing rows: ${error.message}`
      : 'Import failed while storing rows.'
    await c.env.DB.prepare(
      `UPDATE import_jobs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(errorMessage, completedAt, completedAt, importJobId).run()
    return c.redirect(redirectToMigrate('error', errorMessage))
  }
})

dashboard.post('/dashboard/sites/:id/imports/plausible', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const redirectToMigrate = (status: 'success' | 'error', message: string) =>
    `/dashboard/sites/${siteId}/migrate?import_source=plausible&import_status=${status}&import_message=${encodeURIComponent(message)}`

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const body = await c.req.parseBody()
  const uploaded = body['plausible_csv']
  const file = uploaded instanceof File ? uploaded : null
  const filename = file?.name?.trim() || null
  const now = new Date().toISOString()

  if (!file) {
    const message = 'Choose a CSV file before starting a Plausible import.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'plausible',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  if (file.size === 0) {
    const message = 'Uploaded file is empty. Export a non-empty CSV from Plausible.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'plausible',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  if (file.size > 3_000_000) {
    const message = 'CSV file is too large. Keep Plausible imports under 3 MB.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'plausible',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  const csvText = await file.text()
  const parsed = parsePlausibleDailyCsv(csvText)
  if (!parsed.ok) {
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'plausible',
      inputFilename: filename,
      errorMessage: parsed.error,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', parsed.error))
  }

  const parsedImport = parsed.value
  const importJobId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO import_jobs (
      id, site_id, user_id, source, status, input_filename,
      coverage_start_date, coverage_end_date, row_count, inserted_row_count,
      started_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'plausible', 'processing', ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    importJobId,
    siteId,
    user.sub,
    filename,
    parsedImport.coverageStartDate,
    parsedImport.coverageEndDate,
    parsedImport.rowCount,
    now,
    now,
    now,
  ).run()

  try {
    const UPSERT_BATCH_SIZE = 200
    for (let i = 0; i < parsedImport.rows.length; i += UPSERT_BATCH_SIZE) {
      const chunk = parsedImport.rows.slice(i, i + UPSERT_BATCH_SIZE)
      await c.env.DB.batch(
        chunk.map((row) => c.env.DB.prepare(
          `INSERT INTO imported_daily_traffic (
            site_id, import_job_id, source, date, visitors, pageviews, created_at
          ) VALUES (?, ?, 'plausible', ?, ?, ?, ?)
          ON CONFLICT(site_id, source, date) DO UPDATE SET
            import_job_id = excluded.import_job_id,
            visitors = excluded.visitors,
            pageviews = excluded.pageviews,
            created_at = excluded.created_at`
        ).bind(siteId, importJobId, row.date, row.visitors, row.pageviews, now))
      )
    }

    const completedAt = new Date().toISOString()
    await c.env.DB.prepare(
      `UPDATE import_jobs
       SET status = 'completed',
           inserted_row_count = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(parsedImport.rows.length, completedAt, completedAt, importJobId).run()

    const successMessage = `Imported ${parsedImport.rows.length} day${parsedImport.rows.length === 1 ? '' : 's'} (${parsedImport.coverageStartDate} to ${parsedImport.coverageEndDate}).`
    return c.redirect(redirectToMigrate('success', successMessage))
  } catch (error) {
    const completedAt = new Date().toISOString()
    const errorMessage = error instanceof Error
      ? `Import failed while storing rows: ${error.message}`
      : 'Import failed while storing rows.'
    await c.env.DB.prepare(
      `UPDATE import_jobs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(errorMessage, completedAt, completedAt, importJobId).run()
    return c.redirect(redirectToMigrate('error', errorMessage))
  }
})

dashboard.post('/dashboard/sites/:id/imports/fathom', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const redirectToMigrate = (status: 'success' | 'error', message: string) =>
    `/dashboard/sites/${siteId}/migrate?import_source=fathom&import_status=${status}&import_message=${encodeURIComponent(message)}`

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const body = await c.req.parseBody()
  const uploaded = body['fathom_csv']
  const file = uploaded instanceof File ? uploaded : null
  const filename = file?.name?.trim() || null
  const now = new Date().toISOString()

  if (!file) {
    const message = 'Choose a CSV file before starting a Fathom import.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'fathom',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  if (file.size === 0) {
    const message = 'Uploaded file is empty. Export a non-empty CSV from Fathom.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'fathom',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  if (file.size > 3_000_000) {
    const message = 'CSV file is too large. Keep Fathom imports under 3 MB.'
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'fathom',
      inputFilename: filename,
      errorMessage: message,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', message))
  }

  const csvText = await file.text()
  const parsed = parseFathomDailyCsv(csvText)
  if (!parsed.ok) {
    await recordFailedImportJob(c.env.DB, {
      siteId,
      userId: user.sub,
      source: 'fathom',
      inputFilename: filename,
      errorMessage: parsed.error,
      nowISO: now,
    })
    return c.redirect(redirectToMigrate('error', parsed.error))
  }

  const parsedImport = parsed.value
  const importJobId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO import_jobs (
      id, site_id, user_id, source, status, input_filename,
      coverage_start_date, coverage_end_date, row_count, inserted_row_count,
      started_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'fathom', 'processing', ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    importJobId,
    siteId,
    user.sub,
    filename,
    parsedImport.coverageStartDate,
    parsedImport.coverageEndDate,
    parsedImport.rowCount,
    now,
    now,
    now,
  ).run()

  try {
    const UPSERT_BATCH_SIZE = 200
    for (let i = 0; i < parsedImport.rows.length; i += UPSERT_BATCH_SIZE) {
      const chunk = parsedImport.rows.slice(i, i + UPSERT_BATCH_SIZE)
      await c.env.DB.batch(
        chunk.map((row) => c.env.DB.prepare(
          `INSERT INTO imported_daily_traffic (
            site_id, import_job_id, source, date, visitors, pageviews, created_at
          ) VALUES (?, ?, 'fathom', ?, ?, ?, ?)
          ON CONFLICT(site_id, source, date) DO UPDATE SET
            import_job_id = excluded.import_job_id,
            visitors = excluded.visitors,
            pageviews = excluded.pageviews,
            created_at = excluded.created_at`
        ).bind(siteId, importJobId, row.date, row.visitors, row.pageviews, now))
      )
    }

    const completedAt = new Date().toISOString()
    await c.env.DB.prepare(
      `UPDATE import_jobs
       SET status = 'completed',
           inserted_row_count = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(parsedImport.rows.length, completedAt, completedAt, importJobId).run()

    const successMessage = `Imported ${parsedImport.rows.length} day${parsedImport.rows.length === 1 ? '' : 's'} (${parsedImport.coverageStartDate} to ${parsedImport.coverageEndDate}).`
    return c.redirect(redirectToMigrate('success', successMessage))
  } catch (error) {
    const completedAt = new Date().toISOString()
    const errorMessage = error instanceof Error
      ? `Import failed while storing rows: ${error.message}`
      : 'Import failed while storing rows.'
    await c.env.DB.prepare(
      `UPDATE import_jobs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(errorMessage, completedAt, completedAt, importJobId).run()
    return c.redirect(redirectToMigrate('error', errorMessage))
  }
})

// ── Installation verification status (GET /dashboard/sites/:id/installation-status) ──

dashboard.get('/dashboard/sites/:id/installation-status', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string }>()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const signal = await getSiteInstallationSignal(c.env.DB, siteId)
  return c.json({
    siteId,
    checkedAt: new Date().toISOString(),
    ...signal,
  })
})

dashboard.get('/dashboard/sites/:id/installation-status/snippet-check', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const rawUrl = c.req.query('url')

  const site = await c.env.DB.prepare(
    'SELECT id, domain FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; domain: string }>()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const scanTarget = rawUrl?.trim() ? rawUrl.trim() : site.domain
  const expectedScriptUrl = `${getPublicBaseUrl(c.env)}/js/beam.js`
  const checkedAt = new Date().toISOString()
  const scanResult = await scanBeamSnippetInstallation(scanTarget, site.id, expectedScriptUrl)

  if (!scanResult.ok) {
    const failureResponse: SnippetCheckResponse = {
      ...scanResult,
      checkedAt,
    }
    return c.json(failureResponse, 400)
  }

  const response: SnippetCheckResponse = {
    ...scanResult,
    checkedAt,
    guidance: buildBeamSnippetGuidance(scanResult),
  }
  return c.json(response)
})

// ── Import coverage JSON (GET /dashboard/sites/:id/import-coverage) ─────────

dashboard.get('/dashboard/sites/:id/import-coverage', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string }>()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const snapshot = await c.env.DB.prepare(buildImportCoverageSnapshotQuery())
    .bind(siteId, siteId, siteId, siteId)
    .first<{ native_start_date: string | null; native_end_date: string | null; imported_start_date: string | null; imported_end_date: string | null }>()

  const coverageWindow = resolveImportCoverageWindow({
    nativeStartDate: snapshot?.native_start_date ?? null,
    nativeEndDate: snapshot?.native_end_date ?? null,
    importedStartDate: snapshot?.imported_start_date ?? null,
    importedEndDate: snapshot?.imported_end_date ?? null,
  })

  return c.json({
    siteId,
    checkedAt: new Date().toISOString(),
    ...coverageWindow,
  })
})

// ── Toggle public flag (POST /dashboard/sites/:id/public) ────────────────────

dashboard.post('/dashboard/sites/:id/public', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id, public FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; public: number }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const newPublic = site.public === 1 ? 0 : 1
  await c.env.DB.prepare('UPDATE sites SET public = ? WHERE id = ?').bind(newPublic, siteId).run()

  return c.redirect(`/dashboard/sites/${siteId}`)
})

// ── Toggle traffic alerts flag (POST /dashboard/sites/:id/alerts) ───────────

dashboard.post('/dashboard/sites/:id/alerts', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id, COALESCE(alerts_enabled, 1) as alerts_enabled FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; alerts_enabled: number }>()

  if (!site) {
    return c.redirect('/dashboard/sites')
  }

  const newAlerts = site.alerts_enabled === 1 ? 0 : 1
  await c.env.DB.prepare('UPDATE sites SET alerts_enabled = ? WHERE id = ?').bind(newAlerts, siteId).run()

  return c.redirect(`/dashboard/sites/${siteId}`)
})

// ── Goals management (/dashboard/sites/:id/goals) ───────────────────────────

dashboard.get('/dashboard/sites/:id/goals', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const error = c.req.query('error')

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; name: string; domain: string }>()

  if (!site) return c.redirect('/dashboard/sites')

  const dbUser = await c.env.DB.prepare(
    'SELECT plan FROM users WHERE id = ?'
  ).bind(user.sub).first<{ plan: string }>()
  const isPro = (dbUser?.plan ?? 'free') === 'pro'

  const goals = await c.env.DB.prepare(
    'SELECT id, name, match_pattern, created_at FROM goals WHERE site_id = ? ORDER BY created_at DESC'
  ).bind(siteId).all<GoalRecord>()

  const window = buildAnalyticsWindow(new Date(), '30d')
  const periodMs = window.endDate.getTime() - window.startDate.getTime()
  const previousStartISO = new Date(window.startDate.getTime() - periodMs).toISOString()
  const previousEndISO = window.startISO
  const uvExpr = `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(path, '') || '|' || COALESCE(country, '') || '|' || COALESCE(browser, '') || '|' || CAST(COALESCE(screen_width, 0) AS TEXT)`

  const totalUnique = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT ${uvExpr}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`
  ).bind(siteId, window.startISO, window.endISO).first<{ count: number }>()
  const previousUnique = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT ${uvExpr}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`
  ).bind(siteId, previousStartISO, previousEndISO).first<{ count: number }>()

  const summaries = await computeGoalSummaries({
    db: c.env.DB,
    siteId,
    goals: goals.results ?? [],
    uvExpr,
    startISO: window.startISO,
    endISO: window.endISO,
    previousStartISO,
    previousEndISO,
    totalVisitors: totalUnique?.count ?? 0,
    previousTotalVisitors: previousUnique?.count ?? 0,
  })

  const summaryByGoalId = new Map(summaries.map((summary) => [summary.goal.id, summary]))

  const banner = error === 'limit'
    ? `<div class="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
         Free plans include up to 3 goals per site. Upgrade to <a href="/dashboard/billing" class="font-medium underline">Pro</a> for unlimited goals.
       </div>`
    : error === 'invalid'
      ? `<div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
           Goal name and pattern are required. Use exact paths (for example <code>/thank-you</code>), prefix wildcards (for example <code>/checkout/*</code>), or event names (for example <code>event:signup_complete</code>).
         </div>`
      : ''

  const goalRows = (goals.results ?? []).map((goal) => {
    const summary = summaryByGoalId.get(goal.id)
    const conversions = summary?.conversions ?? 0
    const rate = summary?.conversionRatePct ?? 0
    const trend = summary?.conversionTrendPct ?? null
    const trendClass = trend === null
      ? 'text-gray-500'
      : trend > 0
        ? 'text-green-600'
        : trend < 0
          ? 'text-red-600'
          : 'text-gray-500'
    const trendText = trend === null
      ? 'No previous period data'
      : `${trend > 0 ? '+' : ''}${trend.toFixed(1)}% vs previous period`

    return `
      <tr class="border-b border-gray-100 last:border-0">
        <td class="py-3 px-4">
          <p class="text-sm font-medium text-gray-900">${escHtml(goal.name)}</p>
          <p class="text-xs text-gray-500 mt-0.5">${escHtml(goal.match_pattern)}</p>
        </td>
        <td class="py-3 px-4 text-sm text-gray-700">${conversions.toLocaleString()}</td>
        <td class="py-3 px-4 text-sm text-gray-700">${rate.toFixed(1)}%</td>
        <td class="py-3 px-4 text-sm ${trendClass}">${trendText}</td>
        <td class="py-3 px-4 text-right">
          <button type="button" data-goal-id="${goal.id}" class="goal-delete text-sm text-red-600 hover:underline">Delete</button>
        </td>
      </tr>
    `
  }).join('')

  const content = `
    <div class="p-4 sm:p-8 max-w-5xl">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <a href="/dashboard/sites/${site.id}/analytics" class="text-sm text-indigo-600 hover:underline">← Back to Analytics</a>
          <h1 class="text-2xl font-bold text-gray-900 mt-2">Goals</h1>
          <p class="text-gray-500 text-sm">${escHtml(site.name)} · ${escHtml(site.domain)}</p>
        </div>
        <a href="/dashboard/sites/${site.id}" class="inline-block self-start bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
          Site settings
        </a>
      </div>

      ${banner}

      <div class="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-sm font-semibold text-gray-700">Create Goal</h2>
          <p class="text-xs text-gray-500">${(goals.results ?? []).length}${isPro ? '' : ' / 3'} goals used</p>
        </div>
        <form method="POST" action="/dashboard/sites/${site.id}/goals" class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="text"
            name="name"
            required
            maxlength="80"
            placeholder="Signup complete"
            class="md:col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            name="match_pattern"
            required
            maxlength="120"
            placeholder="/thank-you, /checkout/*, or event:signup_complete"
            class="md:col-span-5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" class="md:col-span-3 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition">
            Add Goal
          </button>
        </form>
        <p class="text-xs text-gray-400 mt-3">
          Goal patterns support exact paths, prefix wildcards at the end, or event names via <code>event:your_event_name</code>.
        </p>
      </div>

      <div class="bg-white rounded-xl border border-gray-200">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">Goal Conversion Stats (Last 30 Days)</h2>
          <span class="text-xs text-gray-400">Trend compares to the previous 30-day period</span>
        </div>
        ${(goals.results ?? []).length === 0 ? `
          <p class="px-5 py-8 text-sm text-gray-400 text-center">No goals yet. Add your first goal to start measuring conversion rates.</p>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full min-w-max">
              <thead class="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Goal</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Converters</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                  <th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend</th>
                  <th class="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>${goalRows}</tbody>
            </table>
          </div>
        `}
      </div>
    </div>
    <script>
      (function() {
        const buttons = document.querySelectorAll('.goal-delete');
        for (const button of buttons) {
          button.addEventListener('click', async function() {
            const goalId = this.getAttribute('data-goal-id');
            if (!goalId) return;
            if (!confirm('Delete this goal?')) return;
            const res = await fetch('/dashboard/sites/${site.id}/goals/' + goalId, { method: 'DELETE' });
            if (res.ok) window.location.reload();
          });
        }
      })();
    </script>
  `

  return c.html(layout(`Goals - ${site.name}`, '/dashboard/sites', content))
})

dashboard.post('/dashboard/sites/:id/goals', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const body = await c.req.parseBody()

  const name = ((body['name'] as string) ?? '').trim().slice(0, 80)
  const pattern = normalizeGoalPattern((body['match_pattern'] as string) ?? '')
  if (!name || !pattern) {
    return c.redirect(`/dashboard/sites/${siteId}/goals?error=invalid`)
  }

  const siteAndPlan = await c.env.DB.prepare(
    'SELECT s.id, u.plan FROM sites s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; plan: string }>()
  if (!siteAndPlan) return c.redirect('/dashboard/sites')

  if (siteAndPlan.plan !== 'pro') {
    const goalCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM goals WHERE site_id = ?'
    ).bind(siteId).first<{ count: number }>()
    if ((goalCount?.count ?? 0) >= 3) {
      return c.redirect(`/dashboard/sites/${siteId}/goals?error=limit`)
    }
  }

  await c.env.DB.prepare(
    'INSERT INTO goals (id, site_id, name, match_pattern, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), siteId, name, pattern, new Date().toISOString()).run()

  return c.redirect(`/dashboard/sites/${siteId}/goals`)
})

dashboard.delete('/dashboard/sites/:id/goals/:goalId', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const goalId = c.req.param('goalId')

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string }>()
  if (!site) {
    return c.json({ error: 'Not found' }, 404)
  }

  await c.env.DB.prepare(
    'DELETE FROM goals WHERE id = ? AND site_id = ?'
  ).bind(goalId, siteId).run()

  return c.json({ ok: true })
})

// ── Analytics (/dashboard/sites/:id/analytics) ───────────────────────────────

dashboard.get('/dashboard/sites/:id/analytics', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')
  const window = buildAnalyticsWindow(new Date(), c.req.query('range'))
  const range = window.range

  // ── Segment filters ────────────────────────────────────────────────────────
  const fPage     = c.req.query('page')     ?? null
  const fReferrer = c.req.query('referrer') ?? null
  const fCountry  = c.req.query('country')  ?? null
  const fBrowser  = c.req.query('browser')  ?? null
  const fDevice   = c.req.query('device')   ?? null
  const fChannel  = normalizeTrafficChannel(c.req.query('channel'))
  const channelExpr = buildTrafficChannelSql()

  const filterParts: string[] = []
  const filterBindings: string[] = []
  if (fPage !== null)     { filterParts.push('AND path = ?');                                    filterBindings.push(fPage) }
  if (fReferrer !== null) {
    if (fReferrer === 'Direct') { filterParts.push("AND (referrer = '' OR referrer IS NULL)") }
    else                        { filterParts.push('AND referrer = ?');                          filterBindings.push(fReferrer) }
  }
  if (fCountry !== null)  { filterParts.push("AND COALESCE(country, 'Unknown') = ?");            filterBindings.push(fCountry) }
  if (fBrowser !== null)  { filterParts.push("AND COALESCE(browser, 'Unknown') = ?");            filterBindings.push(fBrowser) }
  if (fDevice !== null)   { filterParts.push("AND COALESCE(device_type, 'Unknown') = ?");        filterBindings.push(fDevice) }
  if (fChannel !== null)  { filterParts.push(`AND ${channelExpr} = ?`);                           filterBindings.push(fChannel) }
  const fClause = filterParts.join(' ')

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; name: string; domain: string }>()

  if (!site) return c.redirect('/dashboard/sites')

  const goals = await c.env.DB.prepare(
    'SELECT id, name, match_pattern, created_at FROM goals WHERE site_id = ? ORDER BY created_at ASC'
  ).bind(siteId).all<GoalRecord>()

  // Count active visitors (pageviews in last 5 minutes via KV)
  const activeKeys = await c.env.KV.list({ prefix: `active:${siteId}:` })
  const activeVisitors = activeKeys.keys.length

  const startISO = window.startISO
  const endISO = window.endISO

  // Non-PII unique visitor fingerprint: distinct (date|path|country|browser|screen_width) per day
  const uvExpr = `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(path, '') || '|' || COALESCE(country, '') || '|' || COALESCE(browser, '') || '|' || CAST(COALESCE(screen_width, 0) AS TEXT)`

  const batchRes = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause}`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT COUNT(DISTINCT ${uvExpr}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause}`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT path, COUNT(*) as views FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY path ORDER BY views DESC LIMIT 1`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END as source, COUNT(*) as cnt FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY source ORDER BY cnt DESC LIMIT 1`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT ${window.groupByExpr} as date, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY date ORDER BY date ASC`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    // Breakdowns
    c.env.DB.prepare(`SELECT path, COUNT(DISTINCT ${uvExpr}) as visitors, COUNT(*) as pageviews FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY path ORDER BY pageviews DESC LIMIT 20`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END as source, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY source ORDER BY visitors DESC LIMIT 20`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT COALESCE(country, 'Unknown') as country, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY country ORDER BY visitors DESC LIMIT 20`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT COALESCE(browser, 'Unknown') as browser, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY browser ORDER BY visitors DESC LIMIT 10`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT COALESCE(device_type, 'Unknown') as device_type, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY device_type ORDER BY visitors DESC`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare(`SELECT ${channelExpr} as channel, COUNT(DISTINCT ${uvExpr}) as visitors, COUNT(*) as pageviews FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause} GROUP BY channel ORDER BY visitors DESC`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    // All-time pageview count (no range filter, no segment filter) — for empty state detection
    c.env.DB.prepare('SELECT COUNT(*) as count FROM pageviews WHERE site_id = ?')
      .bind(siteId),
    // Campaigns breakdown: utm_source x utm_medium with visitor + pageview counts
    c.env.DB.prepare(`SELECT COALESCE(utm_source, '') as utm_source, COALESCE(utm_medium, '') as utm_medium, COUNT(DISTINCT ${uvExpr}) as visitors, COUNT(*) as pageviews FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? AND utm_source IS NOT NULL ${fClause} GROUP BY utm_source, utm_medium ORDER BY visitors DESC LIMIT 20`)
      .bind(siteId, startISO, endISO, ...filterBindings),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM custom_events WHERE site_id = ? AND timestamp >= ? AND timestamp < ?')
      .bind(siteId, startISO, endISO),
    c.env.DB.prepare(`SELECT ${window.groupByExpr} as date, COUNT(*) as count FROM custom_events WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY date ORDER BY date ASC`)
      .bind(siteId, startISO, endISO),
    c.env.DB.prepare(`SELECT event_name, COUNT(*) as count FROM custom_events WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY event_name ORDER BY count DESC, event_name ASC LIMIT 20`)
      .bind(siteId, startISO, endISO),
    c.env.DB.prepare(`SELECT je.key as property_key, CAST(je.value AS TEXT) as property_value, COUNT(*) as count
      FROM custom_events ce, json_each(COALESCE(ce.properties, '{}')) je
      WHERE ce.site_id = ? AND ce.timestamp >= ? AND ce.timestamp < ?
      GROUP BY je.key, property_value
      ORDER BY count DESC, je.key ASC, property_value ASC
      LIMIT 20`)
      .bind(siteId, startISO, endISO),
  ])

  const totalPageviews = (batchRes[0]?.results[0] as { count: number } | undefined)?.count ?? 0
  const uniqueVisitors = (batchRes[1]?.results[0] as { count: number } | undefined)?.count ?? 0
  const topPage = (batchRes[2]?.results[0] as { path: string } | undefined)?.path ?? null
  const rawRef = (batchRes[3]?.results[0] as { source: string } | undefined)?.source ?? null

  // Extract hostname from referrer URL for display
  let topRef = 'Direct'
  if (rawRef && rawRef !== 'Direct') {
    topRef = displayReferrerSource(rawRef)
  }

  const dailyData = (batchRes[4]?.results ?? []) as { date: string; visitors: number }[]
  const allTimePageviews = (batchRes[11]?.results[0] as { count: number } | undefined)?.count ?? 0
  const emptyState = selectAnalyticsEmptyState(allTimePageviews, totalPageviews)

  // Breakdown data
  const topPages = (batchRes[5]?.results ?? []) as { path: string; visitors: number; pageviews: number }[]
  const rawReferrers = (batchRes[6]?.results ?? []) as { source: string; visitors: number }[]
  const topReferrers = rawReferrers.map(r => ({
    visitors: r.visitors,
    displaySource: displayReferrerSource(r.source),
  }))
  const topCountries = (batchRes[7]?.results ?? []) as { country: string; visitors: number }[]
  const topBrowsers = (batchRes[8]?.results ?? []) as { browser: string; visitors: number }[]
  const topDevices = (batchRes[9]?.results ?? []) as { device_type: string; visitors: number }[]
  const totalDeviceVisitors = topDevices.reduce((sum, d) => sum + d.visitors, 0)
  const channelBreakdown = (batchRes[10]?.results ?? []) as { channel: TrafficChannel; visitors: number; pageviews: number }[]
  const totalChannelVisitors = channelBreakdown.reduce((sum, row) => sum + row.visitors, 0)
  const topCampaigns = (batchRes[12]?.results ?? []) as { utm_source: string; utm_medium: string; visitors: number; pageviews: number }[]
  const totalEvents = (batchRes[13]?.results[0] as { count: number } | undefined)?.count ?? 0
  const eventDailyData = (batchRes[14]?.results ?? []) as { date: string; count: number }[]
  const topEvents = (batchRes[15]?.results ?? []) as { event_name: string; count: number }[]
  const eventProperties = (batchRes[16]?.results ?? []) as { property_key: string; property_value: string; count: number }[]

  const periodMs = window.endDate.getTime() - window.startDate.getTime()
  const previousStartISO = new Date(window.startDate.getTime() - periodMs).toISOString()
  const previousEndISO = window.startISO
  const [previousUniqueVisitorsResult, coverageSnapshotRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT ${uvExpr}) as count
       FROM pageviews
       WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause}`
    ).bind(siteId, previousStartISO, previousEndISO, ...filterBindings).first<{ count: number }>(),
    c.env.DB.prepare(buildImportCoverageSnapshotQuery())
      .bind(siteId, siteId, siteId, siteId)
      .first<{ native_start_date: string | null; native_end_date: string | null; imported_start_date: string | null; imported_end_date: string | null }>(),
  ])
  const previousUniqueVisitors = previousUniqueVisitorsResult?.count ?? 0
  const importCoverageWindow = resolveImportCoverageWindow({
    nativeStartDate: coverageSnapshotRow?.native_start_date ?? null,
    nativeEndDate: coverageSnapshotRow?.native_end_date ?? null,
    importedStartDate: coverageSnapshotRow?.imported_start_date ?? null,
    importedEndDate: coverageSnapshotRow?.imported_end_date ?? null,
  })
  const importCoverageBannerHtml = renderImportCoverageBanner(importCoverageWindow, siteId)

  const goalSummaries = await computeGoalSummaries({
    db: c.env.DB,
    siteId,
    goals: goals.results ?? [],
    uvExpr,
    startISO,
    endISO,
    previousStartISO,
    previousEndISO,
    totalVisitors: uniqueVisitors,
    previousTotalVisitors: previousUniqueVisitors,
    filterClause: fClause,
    filterBindings,
  })

  const siteInsights = await generateSiteInsights({
    db: c.env.DB,
    kv: c.env.KV,
    siteId,
    range,
    now: new Date(),
    goals: goals.results ?? [],
    filterClause: fClause,
    filterBindings,
  })

  const insightsCardHtml = siteInsights.enoughData ? `
    <div class="mb-6 bg-white rounded-xl border border-indigo-200 p-5">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h2 class="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Weekly Insights</h2>
        <span class="text-xs text-indigo-400">${escHtml(window.rangeLabel)}</span>
      </div>
      <ol class="list-decimal list-inside space-y-2">
        ${siteInsights.insights.map((insight) => `<li class="text-sm text-gray-700 leading-relaxed">${escHtml(insight)}</li>`).join('')}
      </ol>
    </div>
  ` : `
    <div class="mb-6 bg-white rounded-xl border border-gray-200 p-5">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Weekly Insights</h2>
      <p class="mt-2 text-sm text-gray-500">Not enough data yet. Insights appear after 14 full days of analytics history.</p>
    </div>
  `

  // Build chart values on the same UTC bucket boundaries used for the filter query.
  const chartValues: number[] = []
  const eventChartValues: number[] = []
  for (const date of window.chartDates) {
    const found = dailyData.find(row => row.date === date)
    const eventFound = eventDailyData.find(row => row.date === date)
    chartValues.push(found !== undefined ? found.visitors : 0)
    eventChartValues.push(eventFound !== undefined ? eventFound.count : 0)
  }
  const rangeBtnClass = (r: string) =>
    `px-3 py-1.5 text-sm rounded-lg font-medium transition ${range === r ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`

  // Build a query string preserving range + active filters, with optional overrides (null = remove)
  function dashUrl(overrides: Record<string, string | null> = {}): string {
    const p: Record<string, string> = { range }
    if (fPage !== null)     p['page']     = fPage
    if (fReferrer !== null) p['referrer'] = fReferrer
    if (fCountry !== null)  p['country']  = fCountry
    if (fBrowser !== null)  p['browser']  = fBrowser
    if (fDevice !== null)   p['device']   = fDevice
    if (fChannel !== null)  p['channel']  = fChannel
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) delete p[k]
      else p[k] = v
    }
    const qs = new URLSearchParams(p).toString()
    return qs ? `?${qs}` : ''
  }

  // Filter chip helpers
  function filterLink(key: string, rawValue: string, displayLabel: string): string {
    const isActive = (
      (key === 'page'     && fPage     === rawValue) ||
      (key === 'referrer' && fReferrer === rawValue) ||
      (key === 'country'  && fCountry  === rawValue) ||
      (key === 'browser'  && fBrowser  === rawValue) ||
      (key === 'device'   && fDevice   === rawValue) ||
      (key === 'channel'  && fChannel  === rawValue)
    )
    const href = escHtml(isActive ? dashUrl({ [key]: null }) : dashUrl({ [key]: rawValue }))
    const cls = isActive
      ? 'text-indigo-700 font-semibold hover:underline cursor-pointer'
      : 'hover:text-indigo-600 hover:underline cursor-pointer'
    const title = isActive ? 'Remove filter' : `Filter by ${escHtml(displayLabel)}`
    return `<a href="${href}" class="${cls}" title="${title}">${escHtml(displayLabel)}</a>`
  }

  const filterChipItems: { key: string; displayValue: string }[] = []
  if (fPage !== null)     filterChipItems.push({ key: 'page',     displayValue: fPage })
  if (fReferrer !== null) {
    filterChipItems.push({ key: 'referrer', displayValue: displayReferrerSource(fReferrer) })
  }
  if (fCountry !== null)  filterChipItems.push({ key: 'country',  displayValue: fCountry })
  if (fBrowser !== null)  filterChipItems.push({ key: 'browser',  displayValue: fBrowser })
  if (fDevice !== null)   filterChipItems.push({ key: 'device',   displayValue: fDevice })
  if (fChannel !== null)  filterChipItems.push({ key: 'channel',  displayValue: fChannel })

  const filterChipsHtml = filterChipItems.length === 0 ? '' : `
    <div class="flex flex-wrap items-center gap-2 mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
      <span class="text-xs font-semibold text-indigo-400 uppercase tracking-wide shrink-0">Filters:</span>
      ${filterChipItems.map(f => `
        <span class="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-800 text-xs font-medium px-2.5 py-1 rounded-full">
          ${escHtml(f.displayValue)}
          <a href="${escHtml(dashUrl({ [f.key]: null }))}" class="ml-0.5 text-indigo-400 hover:text-indigo-700 font-bold leading-none" title="Remove filter">×</a>
        </span>
      `).join('')}
      <a href="${escHtml(dashUrl({ page: null, referrer: null, country: null, browser: null, device: null, channel: null }))}" class="text-xs text-indigo-500 hover:text-indigo-700 underline ml-1">Clear all</a>
    </div>`

  const emptyBreakdown = '<p class="px-5 py-6 text-sm text-gray-400 text-center">No data for this period</p>'
  const breakdownTable = (title: string, headers: string[], rows: string[][]) => `
    <div class="bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700">${title}</h3>
      </div>
      ${rows.length === 0 ? emptyBreakdown : `
        <div class="overflow-x-auto">
          <table class="w-full min-w-max">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>${headers.map(h => `<th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((cells, i) => `
                <tr class="${i % 2 !== 0 ? 'bg-gray-50' : ''} border-b border-gray-50 last:border-0">
                  ${cells.map(cell => `<td class="py-2 px-4 text-sm text-gray-700">${cell}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>`

  const pagesTableRows = topPages.map(p => [
    filterLink('page', p.path || '/', p.path || '/'),
    p.visitors.toLocaleString(),
    p.pageviews.toLocaleString(),
  ])
  const referrersTableRows = topReferrers.map((r, i) => [
    filterLink('referrer', (rawReferrers[i]?.source ?? 'Direct'), r.displaySource),
    r.visitors.toLocaleString(),
  ])
  const countriesTableRows = topCountries.map(c2 => [
    filterLink('country', c2.country, c2.country),
    c2.visitors.toLocaleString(),
  ])
  const browsersTableRows = topBrowsers.map(b => [
    filterLink('browser', b.browser, b.browser),
    b.visitors.toLocaleString(),
  ])
  const devicesTableRows = topDevices.map(d => {
    const pct = totalDeviceVisitors > 0 ? Math.round((d.visitors / totalDeviceVisitors) * 100) : 0
    return [filterLink('device', d.device_type, d.device_type), d.visitors.toLocaleString(), `${pct}%`]
  })
  const channelsTableRows = channelBreakdown.map((row) => {
    const pct = totalChannelVisitors > 0 ? ((row.visitors / totalChannelVisitors) * 100).toFixed(1) : '0.0'
    return [
      filterLink('channel', row.channel, row.channel),
      row.visitors.toLocaleString(),
      row.pageviews.toLocaleString(),
      `${pct}%`,
    ]
  })
  const channelColors: Record<TrafficChannel, string> = {
    Search: '#0ea5e9',
    Social: '#8b5cf6',
    Email: '#10b981',
    Direct: '#f59e0b',
    Referral: '#64748b',
    Paid: '#ef4444',
  }
  const channelChartLabels = channelBreakdown.map((row) => {
    const pct = totalChannelVisitors > 0 ? ((row.visitors / totalChannelVisitors) * 100).toFixed(1) : '0.0'
    return `${row.channel} — ${row.visitors.toLocaleString()} (${pct}%)`
  })
  const channelChartValues = channelBreakdown.map((row) => row.visitors)
  const channelChartColors = channelBreakdown.map((row) => channelColors[row.channel] ?? '#94a3b8')
  const channelChartLinks = channelBreakdown.map((row) => dashUrl({ channel: row.channel }))
  const campaignsTableRows = topCampaigns.map(camp => [escHtml(camp.utm_source), escHtml(camp.utm_medium || '—'), camp.visitors.toLocaleString(), camp.pageviews.toLocaleString()])
  const eventsTableRows = topEvents.map(event => [escHtml(event.event_name), event.count.toLocaleString()])
  const eventPropertiesRows = eventProperties.map(prop => [escHtml(prop.property_key), escHtml(prop.property_value), prop.count.toLocaleString()])

  const goalCardsHtml = goalSummaries.length === 0 ? `
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <p class="text-sm text-gray-500">No goals yet. <a href="/dashboard/sites/${site.id}/goals" class="text-indigo-600 hover:underline">Create a goal</a> to start tracking conversions.</p>
    </div>
  ` : `
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${goalSummaries.map((summary) => {
        const trend = summary.conversionTrendPct
        const trendClass = trend === null
          ? 'text-gray-500'
          : trend > 0
            ? 'text-green-600'
            : trend < 0
              ? 'text-red-600'
              : 'text-gray-500'
        const trendText = trend === null
          ? 'No previous period data'
          : `${trend > 0 ? '+' : ''}${trend.toFixed(1)}% vs previous period`
        return `
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversion Goal</p>
            <h3 class="text-lg font-semibold text-gray-900 mt-1">${escHtml(summary.goal.name)}</h3>
            <p class="text-xs text-gray-500 mt-1">${escHtml(summary.goal.match_pattern)}</p>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-gray-500 uppercase tracking-wide">Converters</p>
                <p class="text-xl font-bold text-gray-900">${summary.conversions.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 uppercase tracking-wide">Rate</p>
                <p class="text-xl font-bold text-gray-900">${summary.conversionRatePct.toFixed(1)}%</p>
              </div>
            </div>
            <p class="text-xs mt-3 ${trendClass}">${trendText}</p>
          </div>
        `
      }).join('')}
    </div>
  `

  const goalReferrerTablesHtml = goalSummaries.length === 0 ? '' : `
    <div class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
      ${goalSummaries.map((summary) => {
        const rows = summary.referrerBreakdown.map((row) => [
          filterLink('referrer', row.rawSource, displayReferrerSource(row.rawSource)),
          row.convertedVisitors.toLocaleString(),
          row.visitors.toLocaleString(),
          `${row.conversionRatePct.toFixed(1)}%`,
        ])
        return breakdownTable(
          `Goal: ${escHtml(summary.goal.name)} - Referrer Conversion`,
          ['Source', 'Converters', 'Visitors', 'Rate'],
          rows
        )
      }).join('')}
    </div>
  `

  const statCard = (label: string, value: string) => `
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${label}</p>
      <p class="text-2xl font-bold text-gray-900 mt-1 truncate">${escHtml(value)}</p>
    </div>`

  const content = `
    <div class="p-4 sm:p-8">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <a href="/dashboard/sites/${site.id}" class="text-sm text-indigo-600 hover:underline">← ${escHtml(site.name)}</a>
          <h1 class="text-2xl font-bold text-gray-900 mt-1">Analytics</h1>
          <p class="text-gray-500 text-sm">${escHtml(site.domain)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="${dashUrl({ range: 'today' })}" class="${rangeBtnClass('today')}">Today</a>
          <a href="${dashUrl({ range: '7d' })}" class="${rangeBtnClass('7d')}">7 Days</a>
          <a href="${dashUrl({ range: '30d' })}" class="${rangeBtnClass('30d')}">30 Days</a>
          <a href="/dashboard/sites/${site.id}/goals" class="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">Goals</a>
          <a href="/dashboard/sites/${site.id}/export" class="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">Export CSV</a>
        </div>
      </div>

      <div class="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p class="text-sm text-blue-900">
          ${window.isHourly
            ? `Hourly analytics are shown in <strong>${window.timezoneLabel}</strong>. Today&#39;s chart groups pageviews by UTC hour.`
            : `Daily analytics are shown in <strong>${window.timezoneLabel}</strong>. The ${window.rangeLabel.toLowerCase()} filter and chart buckets both use UTC day boundaries.`
          }
        </p>
      </div>

      <div class="flex items-center gap-2 mb-4">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${activeVisitors > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">
          <span class="w-2 h-2 rounded-full ${activeVisitors > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></span>
          ${activeVisitors} active now
        </span>
        <span class="text-xs text-gray-400">visitors in the last 5 minutes</span>
      </div>

      ${filterChipsHtml}

      ${importCoverageBannerHtml}

      ${emptyState === 'no-data-ever' ? `
        <div id="analytics-install-status" class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div class="flex justify-center mb-3">
            <span class="inline-block w-3 h-3 rounded-full bg-indigo-400 animate-pulse"></span>
          </div>
          <p class="text-gray-600 text-lg font-medium">Waiting for data&hellip;</p>
          <p class="text-gray-400 text-sm mt-2">Install the tracking snippet on your site to start collecting analytics. This page will update automatically.</p>
          <div class="mt-4 flex justify-center gap-3 flex-wrap">
            <a href="/dashboard/sites/${site.id}" class="inline-block text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">Get tracking snippet \u2192</a>
            <a href="/for" class="inline-block text-sm font-medium bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">Framework setup guides</a>
          </div>
        </div>
        <script>
          (function() {
            var siteId = '${site.id}';
            var statusUrl = '/dashboard/sites/' + siteId + '/installation-status';
            var maxPolls = 60;
            var polls = 0;
            var pollId = setInterval(function() {
              polls++;
              if (polls >= maxPolls) {
                clearInterval(pollId);
                var dot = document.querySelector('#analytics-install-status .animate-pulse');
                if (dot) dot.style.display = 'none';
                return;
              }
              fetch(statusUrl)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (data.hasActivity) {
                    clearInterval(pollId);
                    window.location.reload();
                  }
                })
                .catch(function() {});
            }, 5000);
          })();
        </script>
      ` : emptyState === 'no-data-in-range' ? `
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p class="text-gray-600 text-lg font-medium">No data for ${escHtml(window.rangeLabel)}</p>
          <p class="text-gray-400 text-sm mt-2">There are no pageviews in this time range.</p>
          <div class="mt-4 flex justify-center gap-3">
            <a href="${dashUrl({ range: '30d' })}" class="inline-block px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">View last 30 days</a>
            <a href="${dashUrl({ range: 'today' })}" class="inline-block px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">View today</a>
          </div>
        </div>
      ` : `
        ${insightsCardHtml}

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          ${statCard('Unique Visitors', uniqueVisitors.toLocaleString())}
          ${statCard('Total Pageviews', totalPageviews.toLocaleString())}
          ${statCard('Top Page', topPage ?? '\u2014')}
          ${statCard('Top Referrer', topRef)}
        </div>

        <div class="mb-6">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h2 class="text-sm font-semibold text-gray-700">Conversions</h2>
            <a href="/dashboard/sites/${site.id}/goals" class="text-sm text-indigo-600 hover:underline">Manage goals</a>
          </div>
          ${goalCardsHtml}
          ${goalReferrerTablesHtml}
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div class="bg-white rounded-xl border border-gray-200 p-6 xl:col-span-2">
            <div class="flex items-center justify-between gap-3 mb-4">
              <h2 class="text-sm font-semibold text-gray-700">Visitors \u2014 ${window.rangeLabel}</h2>
              <p class="text-xs text-gray-400">Grouped by UTC ${window.isHourly ? 'hour' : 'day'}</p>
            </div>
            <canvas id="visitors-chart" height="80"></canvas>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <div class="flex items-center justify-between gap-3 mb-4">
              <h2 class="text-sm font-semibold text-gray-700">Traffic Sources</h2>
              <p class="text-xs text-gray-400">Click a slice to filter</p>
            </div>
            <canvas id="channels-chart" height="180"></canvas>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
        <script>
          (function() {
            const labels = ${JSON.stringify(window.chartLabels)};
            const data = ${JSON.stringify(chartValues)};
            new Chart(document.getElementById('visitors-chart'), {
              type: 'line',
              data: {
                labels,
                datasets: [{
                  label: 'Visitors',
                  data,
                  borderColor: '#4f46e5',
                  backgroundColor: 'rgba(79,70,229,0.08)',
                  borderWidth: 2,
                  pointRadius: 3,
                  fill: true,
                  tension: 0.3
                }]
              },
              options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, ticks: { precision: 0 } }
                }
              }
            });

            const channelLabels = ${JSON.stringify(channelChartLabels)};
            const channelValues = ${JSON.stringify(channelChartValues)};
            const channelColors = ${JSON.stringify(channelChartColors)};
            const channelLinks = ${JSON.stringify(channelChartLinks)};
            if (channelValues.length > 0) {
              new Chart(document.getElementById('channels-chart'), {
                type: 'doughnut',
                data: {
                  labels: channelLabels,
                  datasets: [{
                    data: channelValues,
                    backgroundColor: channelColors,
                    borderWidth: 0
                  }]
                },
                options: {
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                  onClick: (_, elements) => {
                    if (!elements.length) return;
                    const target = channelLinks[elements[0].index];
                    if (target) window.location.href = target;
                  }
                }
              });
            }
          })();
        </script>

        <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${breakdownTable('Traffic Sources', ['Channel', 'Visitors', 'Pageviews', '%'], channelsTableRows)}
          ${breakdownTable('Top Pages', ['Path', 'Visitors', 'Pageviews'], pagesTableRows)}
          ${breakdownTable('Referrer Sources', ['Source', 'Visitors'], referrersTableRows)}
          ${breakdownTable('Countries', ['Country', 'Visitors'], countriesTableRows)}
          ${breakdownTable('Browsers', ['Browser', 'Visitors'], browsersTableRows)}
          ${breakdownTable('Devices', ['Device Type', 'Visitors', '%'], devicesTableRows)}
          ${breakdownTable('Campaigns', ['Source', 'Medium', 'Visitors', 'Pageviews'], campaignsTableRows)}
        </div>

        <div class="mt-8">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Events</h2>
              <p class="text-sm text-gray-500 mt-1">Track signups, CTA clicks, and other custom actions with <code class="bg-gray-100 px-1 rounded">beam.track()</code>.</p>
            </div>
            <span class="text-sm font-medium text-gray-500 shrink-0">${totalEvents.toLocaleString()} events in ${escHtml(window.rangeLabel.toLowerCase())}</span>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <div class="flex items-center justify-between gap-3 mb-4">
              <h3 class="text-sm font-semibold text-gray-700">Events Over Time</h3>
              <p class="text-xs text-gray-400">Grouped by UTC ${window.isHourly ? 'hour' : 'day'}</p>
            </div>
            <canvas id="events-chart" height="80"></canvas>
          </div>
          <script>
            (function() {
              const labels = ${JSON.stringify(window.chartLabels)};
              const data = ${JSON.stringify(eventChartValues)};
              new Chart(document.getElementById('events-chart'), {
                type: 'bar',
                data: {
                  labels,
                  datasets: [{
                    label: 'Events',
                    data,
                    borderRadius: 6,
                    backgroundColor: '#0f766e'
                  }]
                },
                options: {
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                  }
                }
              });
            })();
          </script>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${breakdownTable('Top Events', ['Event', 'Count'], eventsTableRows)}
            ${breakdownTable('Event Properties', ['Property', 'Value', 'Count'], eventPropertiesRows)}
          </div>
        </div>
      `}
    </div>`

  return c.html(layout(`Analytics \u2014 ${site.name}`, '/dashboard/sites', content))
})

// ── Delete site (POST /dashboard/sites/:id/delete) ───────────────────────────

dashboard.post('/dashboard/sites/:id/delete', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  // Verify ownership
  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first()

  if (site) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM pageviews WHERE site_id = ?').bind(siteId),
      c.env.DB.prepare('DELETE FROM custom_events WHERE site_id = ?').bind(siteId),
      c.env.DB.prepare('DELETE FROM goals WHERE site_id = ?').bind(siteId),
      c.env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(siteId),
    ])
  }

  return c.redirect('/dashboard/sites')
})

// ── CSV Export (/dashboard/sites/:id/export) ─────────────────────────────────

dashboard.get('/dashboard/sites/:id/export', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; name: string; domain: string }>()

  if (!site) return c.redirect('/dashboard/sites')

  const dbUser = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?').bind(user.sub).first<{ plan: string }>()
  const isPro = (dbUser?.plan ?? 'free') === 'pro'

  // Default date range: last 30 days
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const content = `
    <div class="p-4 sm:p-8 max-w-xl">
      <div class="mb-6">
        <a href="/dashboard/sites/${site.id}/analytics" class="text-sm text-indigo-600 hover:underline">← Back to Analytics</a>
        <h1 class="text-2xl font-bold text-gray-900 mt-2">Export Data</h1>
        <p class="text-gray-500 text-sm mt-1">${escHtml(site.domain)}</p>
      </div>

      ${!isPro ? `
        <div class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="text-4xl mb-3">📊</div>
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Pro Feature</h2>
          <p class="text-sm text-gray-500 mb-4">CSV export is available on the Pro plan. Upgrade to download your raw pageview data for analysis in spreadsheets or other tools.</p>
          <a href="/dashboard/billing" class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Upgrade to Pro — $5/mo</a>
        </div>
      ` : `
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <p class="text-sm text-gray-500 mb-4">Export your raw pageview data as CSV. Maximum range: 90 days per export.</p>
          <form method="POST" action="/dashboard/sites/${site.id}/export" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" name="start_date" value="${thirtyDaysAgo}" max="${todayStr}"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" name="end_date" value="${todayStr}" max="${todayStr}"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>
            <p class="text-xs text-gray-400">CSV columns: timestamp, path, referrer, country, device_type, browser, screen_width, language, utm_source, utm_medium, utm_campaign</p>
            <button type="submit" class="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 transition text-sm">
              Download CSV
            </button>
          </form>
        </div>
      `}
    </div>`

  return c.html(layout('Export Data', '/dashboard/sites', content))
})

dashboard.post('/dashboard/sites/:id/export', async (c) => {
  const user = c.get('user')
  const siteId = c.req.param('id')

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, user.sub).first<{ id: string; name: string; domain: string }>()

  if (!site) return c.redirect('/dashboard/sites')

  // Re-read plan from DB — not JWT
  const dbUser = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?').bind(user.sub).first<{ plan: string }>()
  if ((dbUser?.plan ?? 'free') !== 'pro') {
    return c.redirect(`/dashboard/sites/${siteId}/export`)
  }

  const body = await c.req.parseBody()
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let startStr = ((body['start_date'] as string) ?? '').trim() || thirtyDaysAgo
  let endStr = ((body['end_date'] as string) ?? '').trim() || todayStr

  // Validate date format (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(startStr)) startStr = thirtyDaysAgo
  if (!dateRe.test(endStr)) endStr = todayStr

  // Clamp end to today
  if (endStr > todayStr) endStr = todayStr
  // Ensure start <= end
  if (startStr > endStr) startStr = endStr

  // Enforce 90-day max
  const startMs = new Date(startStr + 'T00:00:00Z').getTime()
  const endMs = new Date(endStr + 'T00:00:00Z').getTime()
  const diffDays = (endMs - startMs) / (24 * 60 * 60 * 1000)
  const clampedStart = diffDays > 90
    ? new Date(endMs - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : startStr

  const startISO = clampedStart + 'T00:00:00.000Z'
  const endISO = endStr + 'T23:59:59.999Z'

  const rows = await c.env.DB.prepare(
    'SELECT timestamp, path, referrer, country, device_type, browser, screen_width, language, utm_source, utm_medium, utm_campaign FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
  ).bind(siteId, startISO, endISO).all<{
    timestamp: string; path: string; referrer: string; country: string;
    device_type: string; browser: string; screen_width: number; language: string;
    utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  }>()

  const csvEscape = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const lines: string[] = [
    'timestamp,path,referrer,country,device_type,browser,screen_width,language,utm_source,utm_medium,utm_campaign'
  ]
  for (const r of (rows.results ?? [])) {
    lines.push([
      csvEscape(r.timestamp),
      csvEscape(r.path),
      csvEscape(r.referrer),
      csvEscape(r.country),
      csvEscape(r.device_type),
      csvEscape(r.browser),
      csvEscape(r.screen_width),
      csvEscape(r.language),
      csvEscape(r.utm_source),
      csvEscape(r.utm_medium),
      csvEscape(r.utm_campaign),
    ].join(','))
  }

  const safeDomain = site.domain.replace(/[^a-z0-9.-]/gi, '-')
  const filename = `beam-export-${safeDomain}-${clampedStart}-${endStr}.csv`

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

// ── Settings placeholder ──────────────────────────────────────────────────────

dashboard.get('/dashboard/settings', (c) => {
  const user = c.get('user')
  const content = `
    <div class="p-8 max-w-lg">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <p class="text-sm text-gray-500">Account: <span class="font-medium text-gray-900">${escHtml(user.email)}</span></p>
        <p class="text-sm text-gray-500 mt-2">Plan: <span class="font-medium text-gray-900">${user.plan === 'pro' ? 'Pro' : 'Free'}</span></p>
      </div>
    </div>`
  return c.html(layout('Settings', '/dashboard/settings', content))
})

// ── Helpers ───────────────────────────────────────────────────────────────────

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export { dashboard }
