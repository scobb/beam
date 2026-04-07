import { buildAnalyticsWindow, type AnalyticsRange } from './analytics'
import { displayReferrerSource, type GoalRecord } from './goals'

const UV_EXPR = `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(path, '') || '|' || COALESCE(country, '') || '|' || COALESCE(browser, '') || '|' || CAST(COALESCE(screen_width, 0) AS TEXT)`

interface CountRow {
  count: number
}

interface BucketRow {
  key: string
  count: number
}

interface InsightCandidate {
  kind: string
  score: number
  sentence: string
}

export interface SiteInsights {
  enoughData: boolean
  historyDays: number
  rangeLabel: string
  insights: string[]
}

export interface GenerateSiteInsightsParams {
  db: D1Database
  kv?: KVNamespace
  siteId: string
  range: AnalyticsRange
  now?: Date
  goals?: GoalRecord[]
  filterClause?: string
  filterBindings?: string[]
}

export interface GoalComparison {
  name: string
  currentConverters: number
  previousConverters: number
}

export interface InsightCompositionInput {
  range: AnalyticsRange
  rangeLabel: string
  isHourly: boolean
  currentPageviews: number
  previousPageviews: number
  currentUniqueVisitors: number
  previousUniqueVisitors: number
  sourcesCurrent: Map<string, number>
  sourcesPrevious: Map<string, number>
  pagesCurrent: Map<string, number>
  pagesPrevious: Map<string, number>
  devicesCurrent: Map<string, number>
  devicesPrevious: Map<string, number>
  peak: { key: string; count: number } | null
  goalComparisons?: GoalComparison[]
}

function periodLabel(range: AnalyticsRange): string {
  if (range === 'today') return 'today'
  if (range === '30d') return 'the last 30 days'
  return 'the last 7 days'
}

function hourLabel(rawHour: string): string {
  const hour = Number.parseInt(rawHour, 10)
  if (!Number.isFinite(hour)) return `${rawHour}:00 UTC`
  if (hour === 0) return '12am UTC'
  if (hour < 12) return `${hour}am UTC`
  if (hour === 12) return '12pm UTC'
  return `${hour - 12}pm UTC`
}

function shortUtcDate(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function toCountMap(rows: { key: string; count: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.key, row.count)
  }
  return map
}

function pickLargestDelta(currentMap: Map<string, number>, previousMap: Map<string, number>): {
  key: string
  current: number
  previous: number
  delta: number
} | null {
  const keys = new Set<string>([...currentMap.keys(), ...previousMap.keys()])
  let best: { key: string; current: number; previous: number; delta: number } | null = null
  for (const key of keys) {
    const current = currentMap.get(key) ?? 0
    const previous = previousMap.get(key) ?? 0
    const delta = current - previous
    if (delta === 0) continue
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { key, current, previous, delta }
    }
  }
  return best
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

function goalPathMatcher(pattern: string): { clause: string; binding: string } {
  if (pattern.endsWith('*')) {
    return {
      clause: 'path LIKE ?',
      binding: `${pattern.slice(0, -1)}%`,
    }
  }
  return {
    clause: 'path = ?',
    binding: pattern,
  }
}

async function fetchBreakdown(
  db: D1Database,
  siteId: string,
  startISO: string,
  endISO: string,
  valueSql: string,
  filterClause: string,
  filterBindings: string[]
): Promise<Map<string, number>> {
  const rows = await db.prepare(
    `SELECT ${valueSql} as key, COUNT(*) as count
     FROM pageviews
     WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}
     GROUP BY key`
  ).bind(siteId, startISO, endISO, ...filterBindings).all<BucketRow>()
  return toCountMap(rows.results ?? [])
}

function fallbackTrafficSummary(
  currentPv: number,
  previousPv: number,
  currentUv: number,
  previousUv: number,
  range: AnalyticsRange
): string[] {
  const period = periodLabel(range)
  const sentences: string[] = []
  if (currentPv > 0 || previousPv > 0) {
    const pvPct = percentChange(currentPv, previousPv)
    if (pvPct === null && previousPv === 0) {
      sentences.push(`You recorded ${currentPv.toLocaleString()} pageviews ${period}, up from zero in the previous period.`)
    } else if (pvPct !== null) {
      const dir = pvPct >= 0 ? 'up' : 'down'
      sentences.push(`Pageviews were ${dir} ${Math.abs(pvPct).toFixed(0)}% (${previousPv.toLocaleString()} to ${currentPv.toLocaleString()}) ${period}.`)
    }
  }
  if (currentUv > 0 || previousUv > 0) {
    const uvPct = percentChange(currentUv, previousUv)
    if (uvPct === null && previousUv === 0) {
      sentences.push(`You had ${currentUv.toLocaleString()} unique visitors ${period}, after none in the previous period.`)
    } else if (uvPct !== null) {
      const dir = uvPct >= 0 ? 'increased' : 'decreased'
      sentences.push(`Unique visitors ${dir} by ${Math.abs(uvPct).toFixed(0)}% (${previousUv.toLocaleString()} to ${currentUv.toLocaleString()}) ${period}.`)
    }
  }
  if (sentences.length === 0) {
    sentences.push(`Traffic stayed flat ${period}, with no meaningful change versus the previous period.`)
  }
  if (sentences.length < 3) {
    const extras = [
      `No major source mix shifts were detected ${period}.`,
      `Device distribution stayed broadly stable ${period}.`,
      `Keep collecting data to surface stronger trend signals beyond headline totals.`,
    ]
    for (const extra of extras) {
      if (sentences.length >= 3) break
      sentences.push(extra)
    }
  }
  return sentences
}

export function composeInsightSentences(input: InsightCompositionInput): string[] {
  const {
    range,
    isHourly,
    currentPageviews,
    previousPageviews,
    currentUniqueVisitors,
    previousUniqueVisitors,
    sourcesCurrent,
    sourcesPrevious,
    pagesCurrent,
    pagesPrevious,
    devicesCurrent,
    devicesPrevious,
    peak,
    goalComparisons = [],
  } = input

  const period = periodLabel(range)
  const candidates: InsightCandidate[] = []

  const sourceDelta = pickLargestDelta(sourcesCurrent, sourcesPrevious)
  if (sourceDelta) {
    const source = sourceDelta.key === 'Direct' ? 'Direct traffic' : `${displayReferrerSource(sourceDelta.key)} traffic`
    const sourcePct = percentChange(sourceDelta.current, sourceDelta.previous)
    const sentence = sourcePct === null && sourceDelta.previous === 0
      ? `${source} appeared in ${period} with ${sourceDelta.current.toLocaleString()} visitors after none in the previous period.`
      : `${source} ${sourceDelta.delta > 0 ? 'increased' : 'decreased'} ${Math.abs(sourcePct ?? 0).toFixed(0)}% (${sourceDelta.previous.toLocaleString()} to ${sourceDelta.current.toLocaleString()} visitors) ${period}.`
    candidates.push({
      kind: 'source-change',
      score: Math.abs(sourceDelta.delta),
      sentence,
    })
  }

  const pageDelta = pickLargestDelta(pagesCurrent, pagesPrevious)
  if (pageDelta) {
    const pagePct = percentChange(pageDelta.current, pageDelta.previous)
    const pageText = pageDelta.key.length > 70 ? `${pageDelta.key.slice(0, 67)}...` : pageDelta.key
    const sentence = pagePct === null && pageDelta.previous === 0
      ? `Page ${pageText} became a new traffic driver with ${pageDelta.current.toLocaleString()} pageviews ${period}.`
      : `Page ${pageText} was your biggest mover, ${pageDelta.delta > 0 ? 'up' : 'down'} ${Math.abs(pagePct ?? 0).toFixed(0)}% (${pageDelta.previous.toLocaleString()} to ${pageDelta.current.toLocaleString()} pageviews) ${period}.`
    candidates.push({
      kind: 'page-change',
      score: Math.abs(pageDelta.delta),
      sentence,
    })
  }

  const newReferrers = [...sourcesCurrent.entries()]
    .filter(([source, visitors]) => source !== 'Direct' && visitors > 0 && !sourcesPrevious.has(source))
    .sort((a, b) => b[1] - a[1])
  if (newReferrers.length > 0) {
    const topNew = newReferrers.slice(0, 2)
    const joined = topNew
      .map(([source, visitors]) => `${displayReferrerSource(source)} (${visitors.toLocaleString()} visitors)`)
      .join(topNew.length === 2 ? ' and ' : '')
    candidates.push({
      kind: 'new-referrers',
      score: topNew.reduce((sum, item) => sum + item[1], 0),
      sentence: `New referral sources showed up ${period}: ${joined}.`,
    })
  }

  const currentDeviceTotal = [...devicesCurrent.values()].reduce((sum, count) => sum + count, 0)
  const previousDeviceTotal = [...devicesPrevious.values()].reduce((sum, count) => sum + count, 0)
  if (currentDeviceTotal > 0 && previousDeviceTotal > 0) {
    const deviceKeys = new Set<string>([...devicesCurrent.keys(), ...devicesPrevious.keys()])
    let bestDevice: { name: string; currentShare: number; previousShare: number; delta: number } | null = null
    for (const device of deviceKeys) {
      const currentShare = ((devicesCurrent.get(device) ?? 0) / currentDeviceTotal) * 100
      const previousShare = ((devicesPrevious.get(device) ?? 0) / previousDeviceTotal) * 100
      const delta = currentShare - previousShare
      if (!bestDevice || Math.abs(delta) > Math.abs(bestDevice.delta)) {
        bestDevice = { name: device, currentShare, previousShare, delta }
      }
    }
    if (bestDevice && Math.abs(bestDevice.delta) >= 3) {
      const changeWord = bestDevice.delta > 0 ? 'rose' : 'fell'
      candidates.push({
        kind: 'device-shift',
        score: Math.abs(bestDevice.delta) * 2,
        sentence: `${bestDevice.name} share ${changeWord} from ${bestDevice.previousShare.toFixed(0)}% to ${bestDevice.currentShare.toFixed(0)}% (${bestDevice.delta > 0 ? '+' : ''}${bestDevice.delta.toFixed(1)} pts) ${period}.`,
      })
    }
  }

  if (peak && peak.count > 0) {
    const sentence = isHourly
      ? `Peak traffic hit at ${hourLabel(peak.key)} with ${peak.count.toLocaleString()} pageviews today.`
      : `Your busiest day was ${shortUtcDate(peak.key)} (UTC) with ${peak.count.toLocaleString()} pageviews in ${period}.`
    candidates.push({
      kind: 'peak-period',
      score: peak.count,
      sentence,
    })
  }

  if (goalComparisons.length > 0 && (currentUniqueVisitors > 0 || previousUniqueVisitors > 0)) {
    let goalCandidate: InsightCandidate | null = null
    for (const goal of goalComparisons) {
      if (goal.currentConverters === 0 && goal.previousConverters === 0) continue
      const currentRate = currentUniqueVisitors > 0 ? (goal.currentConverters / currentUniqueVisitors) * 100 : 0
      const previousRate = previousUniqueVisitors > 0 ? (goal.previousConverters / previousUniqueVisitors) * 100 : 0
      const deltaPts = currentRate - previousRate
      const sentence = previousUniqueVisitors === 0
        ? `Goal "${goal.name}" converted ${goal.currentConverters.toLocaleString()} visitors (${currentRate.toFixed(1)}%) ${period}, with no baseline in the previous period.`
        : `Goal "${goal.name}" conversion rate ${deltaPts >= 0 ? 'improved' : 'declined'} from ${previousRate.toFixed(1)}% to ${currentRate.toFixed(1)}% (${deltaPts >= 0 ? '+' : ''}${deltaPts.toFixed(1)} pts).`
      const score = Math.abs(deltaPts) * 3 + goal.currentConverters
      if (!goalCandidate || score > goalCandidate.score) {
        goalCandidate = {
          kind: 'goal-change',
          score,
          sentence,
        }
      }
    }
    if (goalCandidate) {
      candidates.push(goalCandidate)
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const insights: string[] = []
  const seenKinds = new Set<string>()
  const seenSentences = new Set<string>()
  for (const candidate of candidates) {
    if (insights.length >= 5) break
    if (seenKinds.has(candidate.kind)) continue
    if (seenSentences.has(candidate.sentence)) continue
    insights.push(candidate.sentence)
    seenKinds.add(candidate.kind)
    seenSentences.add(candidate.sentence)
  }

  if (insights.length < 3) {
    for (const sentence of fallbackTrafficSummary(currentPageviews, previousPageviews, currentUniqueVisitors, previousUniqueVisitors, range)) {
      if (insights.length >= 5) break
      if (seenSentences.has(sentence)) continue
      insights.push(sentence)
      seenSentences.add(sentence)
    }
  }

  return insights.slice(0, 5)
}

export async function generateSiteInsights(params: GenerateSiteInsightsParams): Promise<SiteInsights> {
  const {
    db,
    kv,
    siteId,
    range,
    now = new Date(),
    goals = [],
    filterClause = '',
    filterBindings = [],
  } = params

  // KV cache for non-today ranges (data changes slowly; 5-minute TTL saves ~12 D1 reads per call)
  const cacheKey = kv && range !== 'today'
    ? `siteInsights:${siteId}:${range}:${encodeURIComponent(filterClause)}:${filterBindings.join('|')}`
    : null

  if (kv && cacheKey) {
    const cached = await kv.get(cacheKey)
    if (cached !== null) {
      try {
        return JSON.parse(cached) as SiteInsights
      } catch { /* ignore parse errors, fall through to compute */ }
    }
  }

  const window = buildAnalyticsWindow(now, range)
  const periodMs = window.endDate.getTime() - window.startDate.getTime()
  const previousStartISO = new Date(window.startDate.getTime() - periodMs).toISOString()
  const previousEndISO = window.startISO

  const historyDaysRow = await db.prepare(
    'SELECT COUNT(DISTINCT substr(timestamp, 1, 10)) as count FROM pageviews WHERE site_id = ?'
  ).bind(siteId).first<CountRow>()
  const historyDays = historyDaysRow?.count ?? 0

  if (historyDays < 14) {
    return {
      enoughData: false,
      historyDays,
      rangeLabel: window.rangeLabel,
      insights: [],
    }
  }

  const [
    currentPvRow,
    previousPvRow,
    currentUvRow,
    previousUvRow,
    peakRow,
  ] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}`
    ).bind(siteId, window.startISO, window.endISO, ...filterBindings).first<CountRow>(),
    db.prepare(
      `SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}`
    ).bind(siteId, previousStartISO, previousEndISO, ...filterBindings).first<CountRow>(),
    db.prepare(
      `SELECT COUNT(DISTINCT ${UV_EXPR}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}`
    ).bind(siteId, window.startISO, window.endISO, ...filterBindings).first<CountRow>(),
    db.prepare(
      `SELECT COUNT(DISTINCT ${UV_EXPR}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}`
    ).bind(siteId, previousStartISO, previousEndISO, ...filterBindings).first<CountRow>(),
    db.prepare(
      `SELECT ${window.groupByExpr} as key, COUNT(*) as count
       FROM pageviews
       WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}
       GROUP BY key
       ORDER BY count DESC, key ASC
       LIMIT 1`
    ).bind(siteId, window.startISO, window.endISO, ...filterBindings).first<BucketRow>(),
  ])

  const [
    currentSources,
    previousSources,
    currentPages,
    previousPages,
    currentDevices,
    previousDevices,
  ] = await Promise.all([
    fetchBreakdown(
      db,
      siteId,
      window.startISO,
      window.endISO,
      "CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END",
      filterClause,
      filterBindings
    ),
    fetchBreakdown(
      db,
      siteId,
      previousStartISO,
      previousEndISO,
      "CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END",
      filterClause,
      filterBindings
    ),
    fetchBreakdown(db, siteId, window.startISO, window.endISO, "COALESCE(path, '/')", filterClause, filterBindings),
    fetchBreakdown(db, siteId, previousStartISO, previousEndISO, "COALESCE(path, '/')", filterClause, filterBindings),
    fetchBreakdown(db, siteId, window.startISO, window.endISO, "COALESCE(device_type, 'Unknown')", filterClause, filterBindings),
    fetchBreakdown(db, siteId, previousStartISO, previousEndISO, "COALESCE(device_type, 'Unknown')", filterClause, filterBindings),
  ])

  const goalComparisons: GoalComparison[] = []
  for (const goal of goals) {
    const matcher = goalPathMatcher(goal.match_pattern)
    const [currentGoalRow, previousGoalRow] = await Promise.all([
      db.prepare(
        `SELECT COUNT(DISTINCT ${UV_EXPR}) as count
         FROM pageviews
         WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause} AND ${matcher.clause}`
      ).bind(siteId, window.startISO, window.endISO, ...filterBindings, matcher.binding).first<CountRow>(),
      db.prepare(
        `SELECT COUNT(DISTINCT ${UV_EXPR}) as count
         FROM pageviews
         WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause} AND ${matcher.clause}`
      ).bind(siteId, previousStartISO, previousEndISO, ...filterBindings, matcher.binding).first<CountRow>(),
    ])
    goalComparisons.push({
      name: goal.name,
      currentConverters: currentGoalRow?.count ?? 0,
      previousConverters: previousGoalRow?.count ?? 0,
    })
  }

  const insights = composeInsightSentences({
    range,
    rangeLabel: window.rangeLabel,
    isHourly: window.isHourly,
    currentPageviews: currentPvRow?.count ?? 0,
    previousPageviews: previousPvRow?.count ?? 0,
    currentUniqueVisitors: currentUvRow?.count ?? 0,
    previousUniqueVisitors: previousUvRow?.count ?? 0,
    sourcesCurrent: currentSources,
    sourcesPrevious: previousSources,
    pagesCurrent: currentPages,
    pagesPrevious: previousPages,
    devicesCurrent: currentDevices,
    devicesPrevious: previousDevices,
    peak: peakRow ? { key: peakRow.key, count: peakRow.count } : null,
    goalComparisons,
  })

  const result: SiteInsights = {
    enoughData: true,
    historyDays,
    rangeLabel: window.rangeLabel,
    insights,
  }

  // Write result to KV cache (fire-and-forget; don't block the response)
  if (kv && cacheKey) {
    kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 }).catch(() => {})
  }

  return result
}
