export interface GoalRecord {
  id: string
  name: string
  match_pattern: string
  created_at: string
}

export interface GoalSourceSummary {
  rawSource: string
  visitors: number
  convertedVisitors: number
  conversionRatePct: number
}

export interface GoalSummary {
  goal: GoalRecord
  conversions: number
  previousConversions: number
  conversionRatePct: number
  previousConversionRatePct: number
  conversionTrendPct: number | null
  referrerBreakdown: GoalSourceSummary[]
}

interface ComputeGoalSummariesParams {
  db: D1Database
  siteId: string
  goals: GoalRecord[]
  uvExpr: string
  startISO: string
  endISO: string
  previousStartISO: string
  previousEndISO: string
  totalVisitors: number
  previousTotalVisitors: number
  filterClause?: string
  filterBindings?: string[]
}

const EVENT_GOAL_PREFIX = 'event:'

export function normalizeGoalPattern(raw: string): string | null {
  let pattern = raw.trim()
  if (!pattern) return null
  if (pattern.startsWith(EVENT_GOAL_PREFIX)) {
    const eventName = pattern.slice(EVENT_GOAL_PREFIX.length).trim()
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(eventName)) return null
    return `${EVENT_GOAL_PREFIX}${eventName}`
  }
  if (!pattern.startsWith('/')) pattern = `/${pattern}`
  if (pattern.length > 120) return null

  const stars = (pattern.match(/\*/g) ?? []).length
  if (stars > 1) return null
  if (stars === 1 && !pattern.endsWith('*')) return null

  return pattern
}

type GoalMatcher =
  | { kind: 'path'; clause: string; binding: string }
  | { kind: 'event'; clause: string; binding: string }

function goalMatcher(pattern: string): GoalMatcher {
  if (pattern.startsWith(EVENT_GOAL_PREFIX)) {
    return {
      kind: 'event',
      clause: 'event_name = ?',
      binding: pattern.slice(EVENT_GOAL_PREFIX.length),
    }
  }

  if (pattern.endsWith('*')) {
    return {
      kind: 'path',
      clause: 'path LIKE ?',
      binding: `${pattern.slice(0, -1)}%`,
    }
  }
  return {
    kind: 'path',
    clause: 'path = ?',
    binding: pattern,
  }
}

export function displayReferrerSource(rawSource: string): string {
  if (rawSource === 'Direct') return rawSource
  try {
    return new URL(rawSource).hostname
  } catch {
    return rawSource.length > 40 ? `${rawSource.slice(0, 40)}...` : rawSource
  }
}

export function computeTrendPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}

export async function computeGoalSummaries(params: ComputeGoalSummariesParams): Promise<GoalSummary[]> {
  const {
    db,
    siteId,
    goals,
    uvExpr,
    startISO,
    endISO,
    previousStartISO,
    previousEndISO,
    totalVisitors,
    previousTotalVisitors,
    filterClause = '',
    filterBindings = [],
  } = params

  const summaries: GoalSummary[] = []
  const eventUvExpr = `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(path, '') || '|' || COALESCE(country, '') || '|' || COALESCE(referrer, '')`

  for (const goal of goals) {
    const matcher = goalMatcher(goal.match_pattern)

    const currentConverters = matcher.kind === 'event'
      ? await db.prepare(
          `SELECT COUNT(DISTINCT ${eventUvExpr}) as count
           FROM custom_events
           WHERE site_id = ? AND timestamp >= ? AND timestamp < ? AND ${matcher.clause}`
        ).bind(siteId, startISO, endISO, matcher.binding).first<{ count: number }>()
      : await db.prepare(
          `SELECT COUNT(DISTINCT ${uvExpr}) as count
           FROM pageviews
           WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause} AND ${matcher.clause}`
        ).bind(siteId, startISO, endISO, ...filterBindings, matcher.binding).first<{ count: number }>()

    const previousConverters = matcher.kind === 'event'
      ? await db.prepare(
          `SELECT COUNT(DISTINCT ${eventUvExpr}) as count
           FROM custom_events
           WHERE site_id = ? AND timestamp >= ? AND timestamp < ? AND ${matcher.clause}`
        ).bind(siteId, previousStartISO, previousEndISO, matcher.binding).first<{ count: number }>()
      : await db.prepare(
          `SELECT COUNT(DISTINCT ${uvExpr}) as count
           FROM pageviews
           WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause} AND ${matcher.clause}`
        ).bind(siteId, previousStartISO, previousEndISO, ...filterBindings, matcher.binding).first<{ count: number }>()

    const sourceTotals = await db.prepare(
      `SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END as source,
              COUNT(DISTINCT ${uvExpr}) as visitors
       FROM pageviews
       WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause}
       GROUP BY source`
    ).bind(siteId, startISO, endISO, ...filterBindings).all<{ source: string; visitors: number }>()

    const sourceConverters = matcher.kind === 'event'
      ? await db.prepare(
          `SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END as source,
                  COUNT(DISTINCT ${eventUvExpr}) as converted_visitors
           FROM custom_events
           WHERE site_id = ? AND timestamp >= ? AND timestamp < ? AND ${matcher.clause}
           GROUP BY source`
        ).bind(siteId, startISO, endISO, matcher.binding).all<{ source: string; converted_visitors: number }>()
      : await db.prepare(
          `SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END as source,
                  COUNT(DISTINCT ${uvExpr}) as converted_visitors
           FROM pageviews
           WHERE site_id = ? AND timestamp >= ? AND timestamp < ? ${filterClause} AND ${matcher.clause}
           GROUP BY source`
        ).bind(siteId, startISO, endISO, ...filterBindings, matcher.binding).all<{ source: string; converted_visitors: number }>()

    const conversions = currentConverters?.count ?? 0
    const previous = previousConverters?.count ?? 0
    const conversionRatePct = totalVisitors > 0 ? (conversions / totalVisitors) * 100 : 0
    const previousConversionRatePct = previousTotalVisitors > 0 ? (previous / previousTotalVisitors) * 100 : 0

    const convertedBySource = new Map<string, number>()
    for (const row of sourceConverters.results ?? []) {
      convertedBySource.set(row.source, row.converted_visitors)
    }

    const referrerBreakdown: GoalSourceSummary[] = (sourceTotals.results ?? [])
      .map((row) => {
        const convertedVisitors = convertedBySource.get(row.source) ?? 0
        return {
          rawSource: row.source,
          visitors: row.visitors,
          convertedVisitors,
          conversionRatePct: row.visitors > 0 ? (convertedVisitors / row.visitors) * 100 : 0,
        }
      })
      .filter((row) => row.visitors > 0)
      .sort((a, b) => {
        if (b.conversionRatePct !== a.conversionRatePct) return b.conversionRatePct - a.conversionRatePct
        if (b.convertedVisitors !== a.convertedVisitors) return b.convertedVisitors - a.convertedVisitors
        return b.visitors - a.visitors
      })
      .slice(0, 10)

    summaries.push({
      goal,
      conversions,
      previousConversions: previous,
      conversionRatePct,
      previousConversionRatePct,
      conversionTrendPct: computeTrendPercent(conversions, previous),
      referrerBreakdown,
    })
  }

  return summaries
}
