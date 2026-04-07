import { Hono } from 'hono'
import type { Env } from '../types'
import { escHtml } from './dashboard'
import { buildAnalyticsWindow, selectAnalyticsEmptyState } from '../lib/analytics'
import { buildTrafficChannelSql, normalizeTrafficChannel, type TrafficChannel } from '../lib/channels'
import {
  computeGoalSummaries,
  displayReferrerSource,
  type GoalRecord,
} from '../lib/goals'

const publicDash = new Hono<{ Bindings: Env }>()
const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

function notFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found — Beam</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <p class="text-4xl font-bold text-gray-300 mb-4">404</p>
    <p class="text-gray-500">This dashboard is not public or does not exist.</p>
    <a href="/" class="inline-block mt-4 text-indigo-600 hover:underline text-sm">← Back to Beam</a>
  </div>
</body>
</html>`
}

function badgeSvg(valueText: string): string {
  const leftText = 'visitors'
  const leftWidth = 68
  const rightWidth = Math.max(150, 14 + valueText.length * 7)
  const totalWidth = leftWidth + rightWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${leftText}: ${valueText}">
  <title>${leftText}: ${valueText}</title>
  <defs>
    <clipPath id="beam-badge-clip">
      <rect width="${totalWidth}" height="20" rx="4" fill="#fff"/>
    </clipPath>
  </defs>
  <g clip-path="url(#beam-badge-clip)">
    <rect width="${leftWidth}" height="20" fill="#4b5563"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="#4f46e5"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="14">${leftText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14">${valueText}</text>
  </g>
</svg>`
}

publicDash.get('/badge/*', async (c) => {
  const pathSegments = c.req.path.split('/')
  const rawSiteId = pathSegments[pathSegments.length - 1] ?? ''
  const siteId = rawSiteId.endsWith('.svg') ? rawSiteId.slice(0, -4) : ''

  if (!siteId) {
    return new Response('Not Found', { status: 404 })
  }

  const site = await c.env.DB.prepare(
    'SELECT id, public FROM sites WHERE id = ?'
  ).bind(siteId).first<{ id: string; public: number }>()

  if (!site || site.public !== 1) {
    return new Response('Not Found', { status: 404 })
  }

  const now = new Date()
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const cacheKey = `badge:${siteId}:${monthKey}`
  const cachedCount = await c.env.KV.get(cacheKey)

  let visitorCount = cachedCount !== null ? Number.parseInt(cachedCount, 10) : Number.NaN
  if (!Number.isFinite(visitorCount)) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
    const uvExpr = `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(path, '') || '|' || COALESCE(country, '') || '|' || COALESCE(browser, '') || '|' || CAST(COALESCE(screen_width, 0) AS TEXT)`
    const result = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT ${uvExpr}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`
    ).bind(siteId, monthStart, monthEnd).first<{ count: number }>()

    visitorCount = result?.count ?? 0
    await c.env.KV.put(cacheKey, String(visitorCount), { expirationTtl: 3600 })
  }

  const svg = badgeSvg(`${visitorCount.toLocaleString()} this month | Beam`)
  return new Response(svg, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'image/svg+xml; charset=utf-8',
    },
  })
})

// ── Public analytics dashboard (/public/:site_id) ─────────────────────────────

publicDash.get('/public/:site_id', async (c) => {
  const siteId = c.req.param('site_id')
  const selfSiteId = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const isBeamDogfoodSite = siteId === selfSiteId
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
    'SELECT id, name, domain, public FROM sites WHERE id = ?'
  ).bind(siteId).first<{ id: string; name: string; domain: string; public: number }>()

  if (!site || site.public !== 1) {
    return c.html(notFoundPage(), 404)
  }

  const goals = await c.env.DB.prepare(
    'SELECT id, name, match_pattern, created_at FROM goals WHERE site_id = ? ORDER BY created_at ASC'
  ).bind(siteId).all<GoalRecord>()

  const startISO = window.startISO
  const endISO = window.endISO

  // Count active visitors (pageviews in last 5 minutes via KV)
  const activeKeys = await c.env.KV.list({ prefix: `active:${siteId}:` })
  const activeVisitors = activeKeys.keys.length

  // Non-PII unique visitor fingerprint
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

  let topRef = 'Direct'
  if (rawRef && rawRef !== 'Direct') {
    topRef = displayReferrerSource(rawRef)
  }

  const dailyData = (batchRes[4]?.results ?? []) as { date: string; visitors: number }[]
  const allTimePageviews = (batchRes[11]?.results[0] as { count: number } | undefined)?.count ?? 0
  const emptyState = selectAnalyticsEmptyState(allTimePageviews, totalPageviews)

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
  const totalEvents = (batchRes[12]?.results[0] as { count: number } | undefined)?.count ?? 0
  const eventDailyData = (batchRes[13]?.results ?? []) as { date: string; count: number }[]
  const topEvents = (batchRes[14]?.results ?? []) as { event_name: string; count: number }[]
  const eventProperties = (batchRes[15]?.results ?? []) as { property_key: string; property_value: string; count: number }[]

  const periodMs = window.endDate.getTime() - window.startDate.getTime()
  const previousStartISO = new Date(window.startDate.getTime() - periodMs).toISOString()
  const previousEndISO = window.startISO
  const previousUniqueVisitorsResult = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT ${uvExpr}) as count
     FROM pageviews
     WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${fClause}`
  ).bind(siteId, previousStartISO, previousEndISO, ...filterBindings).first<{ count: number }>()
  const previousUniqueVisitors = previousUniqueVisitorsResult?.count ?? 0

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

  // Build chart data filling in all dates
  const chartValues: number[] = []
  const eventChartValues: number[] = []
  for (const ds of window.chartDates) {
    const found = dailyData.find(row => row.date === ds)
    const eventFound = eventDailyData.find(row => row.date === ds)
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
  const eventsTableRows = topEvents.map(event => [escHtml(event.event_name), event.count.toLocaleString()])
  const eventPropertiesRows = eventProperties.map(prop => [escHtml(prop.property_key), escHtml(prop.property_value), prop.count.toLocaleString()])

  const goalCardsHtml = goalSummaries.length === 0 ? `
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <p class="text-sm text-gray-500">This site has no public goals configured yet.</p>
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

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(site.name)} Analytics — Beam</title>
  <meta name="description" content="Public analytics dashboard for ${escHtml(site.domain)} powered by Beam.">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Public header -->
  <header class="bg-white border-b border-gray-200">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <a href="/" class="text-xl font-bold text-indigo-600 shrink-0">Beam</a>
        <span class="text-gray-300 shrink-0">|</span>
        <span class="text-gray-600 text-sm font-medium truncate">${escHtml(site.name)}</span>
        <span class="text-xs text-gray-400 hidden sm:inline truncate">${escHtml(site.domain)}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="${dashUrl({ range: 'today' })}" class="${rangeBtnClass('today')}">Today</a>
        <a href="${dashUrl({ range: '7d' })}" class="${rangeBtnClass('7d')}">7 Days</a>
        <a href="${dashUrl({ range: '30d' })}" class="${rangeBtnClass('30d')}">30 Days</a>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
    <div class="flex items-center gap-2 mb-4">
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${activeVisitors > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">
        <span class="w-2 h-2 rounded-full ${activeVisitors > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></span>
        ${activeVisitors} active now
      </span>
      <span class="text-xs text-gray-400">visitors in the last 5 minutes</span>
    </div>

    <div class="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <p class="text-sm text-blue-900">
        ${window.isHourly
          ? `Hourly analytics are shown in <strong>${window.timezoneLabel}</strong>. Today&#39;s chart groups pageviews by UTC hour.`
          : `Daily analytics are shown in <strong>${window.timezoneLabel}</strong>. The ${window.rangeLabel.toLowerCase()} filter and chart buckets both use UTC day boundaries.`
        }
      </p>
    </div>

    ${filterChipsHtml}

    ${emptyState === 'no-data-ever' ? `
      <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p class="text-gray-400 text-lg">No data yet</p>
        <p class="text-gray-400 text-sm mt-2">No pageviews have been recorded for this site.</p>
      </div>
    ` : emptyState === 'no-data-in-range' ? `
      <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p class="text-gray-400 text-lg">No data for ${escHtml(window.rangeLabel)}</p>
        <p class="text-gray-400 text-sm mt-2">There are no pageviews in this time range. Try a wider range to see historical data.</p>
      </div>
    ` : `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${statCard('Unique Visitors', uniqueVisitors.toLocaleString())}
        ${statCard('Total Pageviews', totalPageviews.toLocaleString())}
        ${statCard('Top Page', topPage ?? '\u2014')}
        ${statCard('Top Referrer', topRef)}
      </div>

      <div class="mb-6">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-sm font-semibold text-gray-700">Conversions</h2>
          <span class="text-xs text-gray-400">Goal metrics for this range</span>
        </div>
        ${goalCardsHtml}
        ${goalReferrerTablesHtml}
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
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

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${breakdownTable('Traffic Sources', ['Channel', 'Visitors', 'Pageviews', '%'], channelsTableRows)}
        ${breakdownTable('Top Pages', ['Path', 'Visitors', 'Pageviews'], pagesTableRows)}
        ${breakdownTable('Referrer Sources', ['Source', 'Visitors'], referrersTableRows)}
        ${breakdownTable('Countries', ['Country', 'Visitors'], countriesTableRows)}
        ${breakdownTable('Browsers', ['Browser', 'Visitors'], browsersTableRows)}
        ${breakdownTable('Devices', ['Device Type', 'Visitors', '%'], devicesTableRows)}
      </div>

      <div class="mt-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Events</h2>
            <p class="text-sm text-gray-500 mt-1">Custom interactions this site is tracking with Beam.</p>
            ${isBeamDogfoodSite ? '<p class="text-xs text-emerald-700 mt-1">These are real funnel metrics from Beam&apos;s own site, including cta_click, demo_view, signup_start, signup_complete, docs_view, and pricing_view.</p>' : ''}
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
            new Chart(document.getElementById('events-chart'), {
              type: 'bar',
              data: {
                labels: ${JSON.stringify(window.chartLabels)},
                datasets: [{
                  label: 'Events',
                  data: ${JSON.stringify(eventChartValues)},
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
  </main>

  <!-- Powered by Beam footer -->
  <footer class="border-t border-gray-200 mt-12">
    <div class="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
      <p class="text-sm text-gray-400">
        Analytics powered by <a href="/" class="text-indigo-600 font-medium hover:underline">Beam</a>
        — Privacy-first web analytics for $5/mo
      </p>
      <div class="flex items-center gap-5 text-sm">
        <a href="/privacy" class="text-gray-500 hover:text-gray-700">Privacy</a>
        <a href="/terms" class="text-gray-500 hover:text-gray-700">Terms</a>
        <a href="/signup" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          Get started free →
        </a>
      </div>
    </div>
  </footer>
</body>
</html>`)
})

// ── Embeddable analytics widget (/embed/:siteId) ──────────────────────────────

publicDash.get('/embed/:siteId', async (c) => {
  const siteId = c.req.param('siteId')

  const site = await c.env.DB.prepare(
    'SELECT id, name, domain, public FROM sites WHERE id = ?'
  ).bind(siteId).first<{ id: string; name: string; domain: string; public: number }>()

  if (!site || site.public !== 1) {
    return new Response('Not Found', { status: 404 })
  }

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()

  // Active visitors in the last 5 minutes (via KV heartbeats)
  const activeKeys = await c.env.KV.list({ prefix: `active:${siteId}:` })
  const activeVisitors = activeKeys.keys.length

  const [pvResult, topPagesResult] = await Promise.all([
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?'
    ).bind(siteId, todayStart, todayEnd).first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT path, COUNT(*) as views FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY path ORDER BY views DESC LIMIT 3'
    ).bind(siteId, todayStart, todayEnd).all<{ path: string; views: number }>(),
  ])

  const todayPageviews = pvResult?.count ?? 0
  const topPages = (topPagesResult.results ?? []) as { path: string; views: number }[]

  const siteName = escHtml(site.name)
  const topPagesHtml = topPages.length === 0
    ? '<li style="color:#9ca3af;font-size:12px">No pageviews today yet</li>'
    : topPages.map(p => `<li style="display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden"><span style="color:#374151;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${escHtml(p.path)}</span><span style="color:#6b7280;font-size:11px;white-space:nowrap">${p.views.toLocaleString()}</span></li>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${siteName} — Beam Analytics</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#111827;padding:12px 14px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.site-name{font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
.live-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:4px;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px}
.stat-label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
.stat-value{font-size:20px;font-weight:700;color:#111827;line-height:1}
.pages-heading{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.pages-list{list-style:none;display:flex;flex-direction:column;gap:4px}
.footer{margin-top:10px;text-align:center}
.footer a{font-size:10px;color:#9ca3af;text-decoration:none}
.footer a:hover{color:#4f46e5}
</style>
</head>
<body>
<div class="header">
  <span class="site-name">${siteName}</span>
  <span style="font-size:11px;color:#6b7280;white-space:nowrap"><span class="live-dot"></span>${activeVisitors} live</span>
</div>
<div class="stats">
  <div class="stat">
    <div class="stat-label">Today</div>
    <div class="stat-value">${todayPageviews.toLocaleString()}</div>
    <div style="font-size:10px;color:#6b7280;margin-top:1px">pageviews</div>
  </div>
  <div class="stat">
    <div class="stat-label">Live now</div>
    <div class="stat-value">${activeVisitors}</div>
    <div style="font-size:10px;color:#6b7280;margin-top:1px">visitors</div>
  </div>
</div>
<div class="pages-heading">Top pages today</div>
<ul class="pages-list">${topPagesHtml}</ul>
<div class="footer">
  <a href="/?utm_source=embed" target="_blank" rel="noopener">Powered by Beam</a>
</div>
<script>setTimeout(()=>location.reload(),60000)</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'ALLOWALL',
      'Cache-Control': 'no-store',
    },
  })
})

export { publicDash }
