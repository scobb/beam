import { Hono } from 'hono'
import type { Env } from '../types'
import { buildAnalyticsWindow, selectAnalyticsEmptyState } from '../lib/analytics'
import { getPublicBaseUrl } from '../lib/publicUrl'
import { escHtml, layout } from './dashboard'

const demo = new Hono<{ Bindings: Env }>()
const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const DAY_MS = 24 * 60 * 60 * 1000

type DeviceType = 'Desktop' | 'Mobile' | 'Tablet'

interface DemoPageview {
  timestamp: string
  path: string
  referrer: string
  country: string
  browser: string
  deviceType: DeviceType
  screenWidth: number
  utmSource: string
  utmMedium: string
}

interface DemoEvent {
  timestamp: string
  eventName: string
  properties: Record<string, string>
}

interface Weighted<T> {
  value: T
  weight: number
}

interface DemoDataset {
  pageviews: DemoPageview[]
  events: DemoEvent[]
  siteName: string
  domain: string
  activeVisitors: number
}

const PAGE_CHOICES: Weighted<string>[] = [
  { value: '/', weight: 24 },
  { value: '/pricing', weight: 15 },
  { value: '/docs/getting-started', weight: 11 },
  { value: '/docs/events', weight: 9 },
  { value: '/blog/privacy-analytics-vs-ga4', weight: 8 },
  { value: '/blog/how-we-cut-cookie-banners', weight: 7 },
  { value: '/features/public-dashboards', weight: 7 },
  { value: '/features/goal-tracking', weight: 7 },
  { value: '/signup', weight: 6 },
  { value: '/contact', weight: 6 },
]

const REFERRER_CHOICES: Weighted<string>[] = [
  { value: '', weight: 34 },
  { value: 'https://www.google.com/search?q=privacy+analytics', weight: 29 },
  { value: 'https://twitter.com/keylightdigital/status/1900', weight: 14 },
  { value: 'https://news.ycombinator.com/item?id=44123456', weight: 12 },
  { value: 'https://www.reddit.com/r/webdev/comments/1be4m2/privacy_analytics_stack/', weight: 11 },
]

const COUNTRY_CHOICES: Weighted<string>[] = [
  { value: 'US', weight: 37 },
  { value: 'GB', weight: 14 },
  { value: 'DE', weight: 11 },
  { value: 'CA', weight: 11 },
  { value: 'IN', weight: 10 },
  { value: 'AU', weight: 9 },
  { value: 'BR', weight: 8 },
]

const DEVICE_CHOICES: Weighted<DeviceType>[] = [
  { value: 'Desktop', weight: 61 },
  { value: 'Mobile', weight: 32 },
  { value: 'Tablet', weight: 7 },
]

const EVENT_NAMES = ['signup_click', 'pricing_view', 'docs_download', 'contact_form'] as const

function hashSeed(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(choices: Weighted<T>[], rand: () => number): T {
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0)
  let cursor = rand() * total
  for (const choice of choices) {
    cursor -= choice.weight
    if (cursor <= 0) return choice.value
  }
  return choices[choices.length - 1]!.value
}

function screenWidthForDevice(deviceType: DeviceType, rand: () => number): number {
  const desktopWidths = [1280, 1366, 1440, 1536, 1920]
  const mobileWidths = [360, 375, 390, 393, 414, 430]
  const tabletWidths = [768, 810, 834, 1024]

  if (deviceType === 'Desktop') {
    return desktopWidths[Math.floor(rand() * desktopWidths.length)] ?? 1366
  }
  if (deviceType === 'Mobile') {
    return mobileWidths[Math.floor(rand() * mobileWidths.length)] ?? 390
  }
  return tabletWidths[Math.floor(rand() * tabletWidths.length)] ?? 810
}

function browserForDevice(deviceType: DeviceType, rand: () => number): string {
  if (deviceType === 'Mobile') {
    return pickWeighted(
      [
        { value: 'Safari', weight: 52 },
        { value: 'Chrome', weight: 43 },
        { value: 'Firefox', weight: 5 },
      ],
      rand
    )
  }

  if (deviceType === 'Tablet') {
    return pickWeighted(
      [
        { value: 'Safari', weight: 58 },
        { value: 'Chrome', weight: 35 },
        { value: 'Firefox', weight: 7 },
      ],
      rand
    )
  }

  return pickWeighted(
    [
      { value: 'Chrome', weight: 56 },
      { value: 'Firefox', weight: 17 },
      { value: 'Safari', weight: 14 },
      { value: 'Edge', weight: 13 },
    ],
    rand
  )
}

function utmForReferrer(referrer: string): { source: string; medium: string } {
  if (referrer.includes('google.')) return { source: 'google', medium: 'organic' }
  if (referrer.includes('twitter.com')) return { source: 'twitter', medium: 'social' }
  if (referrer.includes('ycombinator.com')) return { source: 'hacker-news', medium: 'referral' }
  if (referrer.includes('reddit.com')) return { source: 'reddit', medium: 'social' }
  return { source: '', medium: '' }
}

function randomTimestampInDay(dayStartMs: number, rand: () => number): string {
  const offsetMs = Math.floor(rand() * DAY_MS)
  return new Date(dayStartMs + offsetMs).toISOString()
}

function dateBucket(timestamp: string): string {
  return timestamp.slice(0, 10)
}

function fingerprint(pageview: DemoPageview): string {
  return `${dateBucket(pageview.timestamp)}|${pageview.path}|${pageview.country}|${pageview.browser}|${pageview.screenWidth}`
}

function domainFromReferrer(referrer: string): string {
  if (referrer === '') return 'Direct'
  try {
    return new URL(referrer).hostname
  } catch {
    return referrer.length > 40 ? `${referrer.slice(0, 40)}...` : referrer
  }
}

function generateDemoDataset(now: Date): DemoDataset {
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const seedKey = `beam-demo-v1:${todayUTC.toISOString().slice(0, 10)}`
  const rand = createPrng(hashSeed(seedKey))

  const pageviews: DemoPageview[] = []
  const events: DemoEvent[] = []

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const dayStartMs = todayUTC.getTime() - dayOffset * DAY_MS
    const day = new Date(dayStartMs)
    const dayIndex = 29 - dayOffset
    const weekday = day.getUTCDay()
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.72 : 1
    const baseline = 68 + dayIndex * 2
    const jitter = Math.floor(rand() * 24)
    const dailyPageviews = Math.max(40, Math.round((baseline + jitter) * weekendFactor))

    for (let i = 0; i < dailyPageviews; i++) {
      const path = pickWeighted(PAGE_CHOICES, rand)
      const referrer = pickWeighted(REFERRER_CHOICES, rand)
      const country = pickWeighted(COUNTRY_CHOICES, rand)
      const deviceType = pickWeighted(DEVICE_CHOICES, rand)
      const browser = browserForDevice(deviceType, rand)
      const screenWidth = screenWidthForDevice(deviceType, rand)
      const timestamp = randomTimestampInDay(dayStartMs, rand)
      const utm = utmForReferrer(referrer)

      const pageview: DemoPageview = {
        timestamp,
        path,
        referrer,
        country,
        browser,
        deviceType,
        screenWidth,
        utmSource: utm.source,
        utmMedium: utm.medium,
      }
      pageviews.push(pageview)

      // Seeded conversion-like behavior so events look realistic and consistent.
      if (path === '/pricing' && rand() < 0.42) {
        events.push({
          timestamp,
          eventName: 'pricing_view',
          properties: {
            plan: rand() < 0.78 ? 'pro' : 'free',
            source: utm.source || 'direct',
          },
        })
      }
      if (path === '/signup' && rand() < 0.27) {
        events.push({
          timestamp,
          eventName: 'signup_click',
          properties: {
            cta: rand() < 0.58 ? 'hero' : 'pricing-card',
            device: deviceType.toLowerCase(),
          },
        })
      }
      if ((path.startsWith('/docs') || path.startsWith('/features')) && rand() < 0.2) {
        events.push({
          timestamp,
          eventName: 'docs_download',
          properties: {
            asset: path.startsWith('/docs') ? 'setup-checklist.pdf' : 'roi-template.csv',
            source: utm.source || 'direct',
          },
        })
      }
      if (path === '/contact' && rand() < 0.24) {
        events.push({
          timestamp,
          eventName: 'contact_form',
          properties: {
            intent: rand() < 0.6 ? 'demo-request' : 'support',
            source: utm.source || 'direct',
          },
        })
      }
    }
  }

  // Guarantee the named event set exists in every render.
  const todayStamp = new Date(todayUTC.getTime() + 12 * 60 * 60 * 1000).toISOString()
  for (const eventName of EVENT_NAMES) {
    if (!events.some((event) => event.eventName === eventName)) {
      events.push({
        timestamp: todayStamp,
        eventName,
        properties: { source: 'direct' },
      })
    }
  }

  const todayCount = pageviews.filter((pv) => dateBucket(pv.timestamp) === todayUTC.toISOString().slice(0, 10)).length
  const activeVisitors = Math.max(3, Math.round(todayCount / 20))

  return {
    pageviews,
    events,
    siteName: 'Northstar SaaS',
    domain: 'northstarsaas.io',
    activeVisitors,
  }
}

function countDistinctPageviewVisitors(records: DemoPageview[]): number {
  return new Set(records.map((record) => fingerprint(record))).size
}

function groupEventProperties(records: DemoEvent[]): { property_key: string; property_value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const event of records) {
    for (const [key, value] of Object.entries(event.properties)) {
      const indexKey = `${key}\u0000${String(value)}`
      counts.set(indexKey, (counts.get(indexKey) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([combinedKey, count]) => {
      const split = combinedKey.split('\u0000')
      const propertyKey = split[0] ?? ''
      const propertyValue = split[1] ?? ''
      return { property_key: propertyKey, property_value: propertyValue, count }
    })
    .sort((a, b) => b.count - a.count || a.property_key.localeCompare(b.property_key) || a.property_value.localeCompare(b.property_value))
    .slice(0, 20)
}

function asTableRows<T>(
  rows: T[],
  mapper: (row: T, index: number) => string[]
): string[][] {
  return rows.map((row, index) => mapper(row, index))
}

// ── Interactive live demo (/demo) ────────────────────────────────────────────

demo.get('/demo', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const dataset = generateDemoDataset(new Date())
  const window = buildAnalyticsWindow(new Date(), c.req.query('range'))
  const range = window.range

  const fPage = c.req.query('page') ?? null
  const fReferrer = c.req.query('referrer') ?? null
  const fCountry = c.req.query('country') ?? null
  const fBrowser = c.req.query('browser') ?? null
  const fDevice = c.req.query('device') ?? null

  const inRangePageviews = dataset.pageviews.filter(
    (row) => row.timestamp >= window.startISO && row.timestamp < window.endISO
  )

  const filteredPageviews = inRangePageviews.filter((row) => {
    if (fPage !== null && row.path !== fPage) return false
    if (fReferrer !== null) {
      if (fReferrer === 'Direct') {
        if (row.referrer !== '') return false
      } else if (row.referrer !== fReferrer) {
        return false
      }
    }
    if (fCountry !== null && row.country !== fCountry) return false
    if (fBrowser !== null && row.browser !== fBrowser) return false
    if (fDevice !== null && row.deviceType !== fDevice) return false
    return true
  })

  const totalPageviews = filteredPageviews.length
  const uniqueVisitors = countDistinctPageviewVisitors(filteredPageviews)

  const pageCounts = new Map<string, number>()
  const referrerCounts = new Map<string, number>()
  const visitorsByBucket = new Map<string, Set<string>>()

  for (const row of filteredPageviews) {
    pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1)
    const source = row.referrer === '' ? 'Direct' : row.referrer
    referrerCounts.set(source, (referrerCounts.get(source) ?? 0) + 1)

    const bucket = window.isHourly ? row.timestamp.slice(11, 13) : dateBucket(row.timestamp)
    let bucketVisitors = visitorsByBucket.get(bucket)
    if (bucketVisitors === undefined) {
      bucketVisitors = new Set<string>()
      visitorsByBucket.set(bucket, bucketVisitors)
    }
    bucketVisitors.add(fingerprint(row))
  }

  const topPage = Array.from(pageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const rawTopRef = Array.from(referrerCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topRef = rawTopRef === null ? 'Direct' : domainFromReferrer(rawTopRef === 'Direct' ? '' : rawTopRef)

  const dailyData = Array.from(visitorsByBucket.entries()).map(([date, visitors]) => ({ date, visitors: visitors.size }))

  const topPagesMap = new Map<string, { visitors: Set<string>; pageviews: number }>()
  const topReferrersMap = new Map<string, Set<string>>()
  const topCountriesMap = new Map<string, Set<string>>()
  const topBrowsersMap = new Map<string, Set<string>>()
  const topDevicesMap = new Map<string, Set<string>>()
  const topCampaignsMap = new Map<string, { visitors: Set<string>; pageviews: number; source: string; medium: string }>()

  for (const row of filteredPageviews) {
    const visitorKey = fingerprint(row)

    const pageAgg = topPagesMap.get(row.path) ?? { visitors: new Set<string>(), pageviews: 0 }
    pageAgg.visitors.add(visitorKey)
    pageAgg.pageviews += 1
    topPagesMap.set(row.path, pageAgg)

    const source = row.referrer === '' ? 'Direct' : row.referrer
    const refAgg = topReferrersMap.get(source) ?? new Set<string>()
    refAgg.add(visitorKey)
    topReferrersMap.set(source, refAgg)

    const countryAgg = topCountriesMap.get(row.country) ?? new Set<string>()
    countryAgg.add(visitorKey)
    topCountriesMap.set(row.country, countryAgg)

    const browserAgg = topBrowsersMap.get(row.browser) ?? new Set<string>()
    browserAgg.add(visitorKey)
    topBrowsersMap.set(row.browser, browserAgg)

    const deviceAgg = topDevicesMap.get(row.deviceType) ?? new Set<string>()
    deviceAgg.add(visitorKey)
    topDevicesMap.set(row.deviceType, deviceAgg)

    if (row.utmSource !== '') {
      const campaignKey = `${row.utmSource}\u0000${row.utmMedium}`
      const campAgg = topCampaignsMap.get(campaignKey) ?? {
        source: row.utmSource,
        medium: row.utmMedium,
        visitors: new Set<string>(),
        pageviews: 0,
      }
      campAgg.visitors.add(visitorKey)
      campAgg.pageviews += 1
      topCampaignsMap.set(campaignKey, campAgg)
    }
  }

  const topPages = Array.from(topPagesMap.entries())
    .map(([path, agg]) => ({ path, visitors: agg.visitors.size, pageviews: agg.pageviews }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 20)

  const rawReferrers = Array.from(topReferrersMap.entries())
    .map(([source, visitors]) => ({ source, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 20)

  const topReferrers = rawReferrers.map((row) => ({
    visitors: row.visitors,
    displaySource: row.source === 'Direct' ? 'Direct' : domainFromReferrer(row.source),
  }))

  const topCountries = Array.from(topCountriesMap.entries())
    .map(([country, visitors]) => ({ country, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 20)

  const topBrowsers = Array.from(topBrowsersMap.entries())
    .map(([browser, visitors]) => ({ browser, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10)

  const topDevices = Array.from(topDevicesMap.entries())
    .map(([deviceType, visitors]) => ({ device_type: deviceType, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)

  const topCampaigns = Array.from(topCampaignsMap.values())
    .map((camp) => ({
      utm_source: camp.source,
      utm_medium: camp.medium,
      visitors: camp.visitors.size,
      pageviews: camp.pageviews,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 20)

  const allTimePageviews = dataset.pageviews.length
  const emptyState = selectAnalyticsEmptyState(allTimePageviews, totalPageviews)

  const rangeEvents = dataset.events.filter((event) => event.timestamp >= window.startISO && event.timestamp < window.endISO)
  const totalEvents = rangeEvents.length

  const eventsByBucket = new Map<string, number>()
  const topEventsMap = new Map<string, number>()
  for (const event of rangeEvents) {
    const bucket = window.isHourly ? event.timestamp.slice(11, 13) : dateBucket(event.timestamp)
    eventsByBucket.set(bucket, (eventsByBucket.get(bucket) ?? 0) + 1)
    topEventsMap.set(event.eventName, (topEventsMap.get(event.eventName) ?? 0) + 1)
  }

  const eventDailyData = Array.from(eventsByBucket.entries()).map(([date, count]) => ({ date, count }))
  const topEvents = Array.from(topEventsMap.entries())
    .map(([event_name, count]) => ({ event_name, count }))
    .sort((a, b) => b.count - a.count || a.event_name.localeCompare(b.event_name))
    .slice(0, 20)

  const eventProperties = groupEventProperties(rangeEvents)

  const chartValues: number[] = []
  const eventChartValues: number[] = []
  for (const date of window.chartDates) {
    const visitorsForDate = dailyData.find((row) => row.date === date)
    const eventsForDate = eventDailyData.find((row) => row.date === date)
    chartValues.push(visitorsForDate?.visitors ?? 0)
    eventChartValues.push(eventsForDate?.count ?? 0)
  }

  const rangeBtnClass = (r: string) =>
    `px-3 py-1.5 text-sm rounded-lg font-medium transition ${range === r ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`

  function dashUrl(overrides: Record<string, string | null> = {}): string {
    const p: Record<string, string> = { range }
    if (fPage !== null) p['page'] = fPage
    if (fReferrer !== null) p['referrer'] = fReferrer
    if (fCountry !== null) p['country'] = fCountry
    if (fBrowser !== null) p['browser'] = fBrowser
    if (fDevice !== null) p['device'] = fDevice
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) delete p[k]
      else p[k] = v
    }
    const qs = new URLSearchParams(p).toString()
    return qs ? `?${qs}` : ''
  }

  function filterLink(key: string, rawValue: string, displayLabel: string): string {
    const isActive =
      (key === 'page' && fPage === rawValue) ||
      (key === 'referrer' && fReferrer === rawValue) ||
      (key === 'country' && fCountry === rawValue) ||
      (key === 'browser' && fBrowser === rawValue) ||
      (key === 'device' && fDevice === rawValue)

    const href = escHtml(isActive ? dashUrl({ [key]: null }) : dashUrl({ [key]: rawValue }))
    const cls = isActive
      ? 'text-indigo-700 font-semibold hover:underline cursor-pointer'
      : 'hover:text-indigo-600 hover:underline cursor-pointer'
    const title = isActive ? 'Remove filter' : `Filter by ${escHtml(displayLabel)}`
    return `<a href="${href}" class="${cls}" title="${title}">${escHtml(displayLabel)}</a>`
  }

  const filterChipItems: { key: string; displayValue: string }[] = []
  if (fPage !== null) filterChipItems.push({ key: 'page', displayValue: fPage })
  if (fReferrer !== null) {
    const value = fReferrer === 'Direct' ? 'Direct' : domainFromReferrer(fReferrer)
    filterChipItems.push({ key: 'referrer', displayValue: value })
  }
  if (fCountry !== null) filterChipItems.push({ key: 'country', displayValue: fCountry })
  if (fBrowser !== null) filterChipItems.push({ key: 'browser', displayValue: fBrowser })
  if (fDevice !== null) filterChipItems.push({ key: 'device', displayValue: fDevice })

  const filterChipsHtml =
    filterChipItems.length === 0
      ? ''
      : `
    <div class="flex flex-wrap items-center gap-2 mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
      <span class="text-xs font-semibold text-indigo-400 uppercase tracking-wide shrink-0">Filters:</span>
      ${filterChipItems
        .map(
          (item) => `
        <span class="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-800 text-xs font-medium px-2.5 py-1 rounded-full">
          ${escHtml(item.displayValue)}
          <a href="${escHtml(dashUrl({ [item.key]: null }))}" class="ml-0.5 text-indigo-400 hover:text-indigo-700 font-bold leading-none" title="Remove filter">x</a>
        </span>
      `
        )
        .join('')}
      <a href="${escHtml(dashUrl({ page: null, referrer: null, country: null, browser: null, device: null }))}" class="text-xs text-indigo-500 hover:text-indigo-700 underline ml-1">Clear all</a>
    </div>`

  const emptyBreakdown = '<p class="px-5 py-6 text-sm text-gray-400 text-center">No data for this period</p>'

  const breakdownTable = (title: string, headers: string[], rows: string[][]) => `
    <div class="bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700">${title}</h3>
      </div>
      ${
        rows.length === 0
          ? emptyBreakdown
          : `
        <div class="overflow-x-auto">
          <table class="w-full min-w-max">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>${headers.map((h) => `<th class="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (cells, index) => `
                <tr class="${index % 2 !== 0 ? 'bg-gray-50' : ''} border-b border-gray-50 last:border-0">
                  ${cells.map((cell) => `<td class="py-2 px-4 text-sm text-gray-700">${cell}</td>`).join('')}
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
      }
    </div>`

  const pagesTableRows = asTableRows(topPages, (row) => [
    filterLink('page', row.path || '/', row.path || '/'),
    row.visitors.toLocaleString(),
    row.pageviews.toLocaleString(),
  ])

  const referrersTableRows = asTableRows(topReferrers, (row, index) => [
    filterLink('referrer', rawReferrers[index]?.source ?? 'Direct', row.displaySource),
    row.visitors.toLocaleString(),
  ])

  const countriesTableRows = asTableRows(topCountries, (row) => [
    filterLink('country', row.country, row.country),
    row.visitors.toLocaleString(),
  ])

  const browsersTableRows = asTableRows(topBrowsers, (row) => [
    filterLink('browser', row.browser, row.browser),
    row.visitors.toLocaleString(),
  ])

  const totalDeviceVisitors = topDevices.reduce((sum, row) => sum + row.visitors, 0)
  const devicesTableRows = asTableRows(topDevices, (row) => {
    const pct = totalDeviceVisitors > 0 ? Math.round((row.visitors / totalDeviceVisitors) * 100) : 0
    return [filterLink('device', row.device_type, row.device_type), row.visitors.toLocaleString(), `${pct}%`]
  })

  const campaignsTableRows = asTableRows(topCampaigns, (row) => [
    escHtml(row.utm_source),
    escHtml(row.utm_medium || '-'),
    row.visitors.toLocaleString(),
    row.pageviews.toLocaleString(),
  ])

  const eventsTableRows = asTableRows(topEvents, (row) => [escHtml(row.event_name), row.count.toLocaleString()])
  const eventPropertiesRows = asTableRows(eventProperties, (row) => [
    escHtml(row.property_key),
    escHtml(row.property_value),
    row.count.toLocaleString(),
  ])

  const statCard = (label: string, value: string) => `
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${label}</p>
      <p class="text-2xl font-bold text-gray-900 mt-1 truncate">${escHtml(value)}</p>
    </div>`

  const content = `
    <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
    <script>
      (function() {
        let sent = false;
        function trackDemoView() {
          if (sent) return true;
          if (!window.beam || typeof window.beam.track !== 'function') return false;
          window.beam.track('demo_view', { page: 'demo', range: ${JSON.stringify(range)} });
          sent = true;
          return true;
        }
        if (trackDemoView()) return;
        setTimeout(trackDemoView, 120);
        setTimeout(trackDemoView, 350);
        setTimeout(trackDemoView, 700);
      })();
    </script>
    <div class="p-4 sm:p-8">
      <div class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p class="text-sm text-emerald-900">
          <strong>This is a live demo with sample data</strong> - Start tracking your own site.
        </p>
        <a href="/signup" class="inline-block bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-800 transition self-start sm:self-auto">
          Create free account
        </a>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <a href="/" class="text-sm text-indigo-600 hover:underline">&larr; Back to Beam</a>
          <h1 class="text-2xl font-bold text-gray-900 mt-1">Analytics</h1>
          <p class="text-gray-500 text-sm">${escHtml(dataset.domain)} (Demo)</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="${dashUrl({ range: 'today' })}" class="${rangeBtnClass('today')}">Today</a>
          <a href="${dashUrl({ range: '7d' })}" class="${rangeBtnClass('7d')}">7 Days</a>
          <a href="${dashUrl({ range: '30d' })}" class="${rangeBtnClass('30d')}">30 Days</a>
        </div>
      </div>

      <div class="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p class="text-sm text-blue-900">
          ${
            window.isHourly
              ? `Hourly analytics are shown in <strong>${window.timezoneLabel}</strong>. Today&#39;s chart groups pageviews by UTC hour.`
              : `Daily analytics are shown in <strong>${window.timezoneLabel}</strong>. The ${window.rangeLabel.toLowerCase()} filter and chart buckets both use UTC day boundaries.`
          }
        </p>
      </div>

      <div class="flex items-center gap-2 mb-4">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${dataset.activeVisitors > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">
          <span class="w-2 h-2 rounded-full ${dataset.activeVisitors > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></span>
          ${dataset.activeVisitors} active now
        </span>
        <span class="text-xs text-gray-400">sample live visitor count</span>
      </div>

      ${filterChipsHtml}

      ${
        emptyState === 'no-data-ever'
          ? `
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p class="text-gray-400 text-lg">No demo data available</p>
          <p class="text-gray-400 text-sm mt-2">Refresh the page to regenerate the sample dashboard.</p>
        </div>
      `
          : emptyState === 'no-data-in-range'
            ? `
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p class="text-gray-400 text-lg">No data for ${escHtml(window.rangeLabel)}</p>
          <p class="text-gray-400 text-sm mt-2">Try a wider range or clear filters to inspect the full sample dataset.</p>
        </div>
      `
            : `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          ${statCard('Unique Visitors', uniqueVisitors.toLocaleString())}
          ${statCard('Total Pageviews', totalPageviews.toLocaleString())}
          ${statCard('Top Page', topPage ?? '-')}
          ${statCard('Top Referrer', topRef)}
        </div>

        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="text-sm font-semibold text-gray-700">Visitors - ${window.rangeLabel}</h2>
            <p class="text-xs text-gray-400">Grouped by UTC ${window.isHourly ? 'hour' : 'day'}</p>
          </div>
          <canvas id="visitors-chart" height="80"></canvas>
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
          })();
        </script>

        <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      `
      }
    </div>`

  return c.html(layout(`Demo Analytics - ${dataset.siteName}`, '/dashboard/sites', content, `${baseUrl}/demo`, `${baseUrl}/og/demo`))
})

export { demo }
