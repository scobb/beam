export type AnalyticsRange = 'today' | '7d' | '30d'
export type EmptyStateKind = 'no-data-ever' | 'no-data-in-range' | 'has-data'

/**
 * Determines which empty state to render on an analytics page.
 * - 'no-data-ever': site has never recorded a pageview → show install instructions
 * - 'no-data-in-range': site has historical data but none in the selected range → show range-scoped message
 * - 'has-data': range has data → render charts normally
 */
export function selectAnalyticsEmptyState(allTimeCount: number, rangeCount: number): EmptyStateKind {
  if (rangeCount > 0) return 'has-data'
  if (allTimeCount === 0) return 'no-data-ever'
  return 'no-data-in-range'
}

export interface AnalyticsWindow {
  range: AnalyticsRange
  rangeLabel: string
  timezoneLabel: string
  startDate: Date
  endDate: Date
  startISO: string
  endISO: string
  /** SQL match keys: YYYY-MM-DD for daily ranges; zero-padded hour '00'..'23' for today */
  chartDates: string[]
  /** Human-readable chart axis labels: same as chartDates for daily; '12am'..'11pm' for today */
  chartLabels: string[]
  /** Whether the chart is grouped by hour (true for today) or by day (false otherwise) */
  isHourly: boolean
  /** strftime expression to use in SQL GROUP BY for the time bucket */
  groupByExpr: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Format a 0-23 hour number to a human-readable am/pm label */
function hourLabel(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

export function normalizeAnalyticsRange(range: string | undefined): AnalyticsRange {
  if (range === 'today' || range === '30d') {
    return range
  }
  return '7d'
}

export function buildAnalyticsWindow(now: Date, requestedRange: string | undefined): AnalyticsWindow {
  const range = normalizeAnalyticsRange(requestedRange)
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const endDate = new Date(todayUTC.getTime() + DAY_MS)

  if (range === 'today') {
    // 24 hourly buckets: chartDates are zero-padded hour strings matching strftime('%H', ...)
    const chartDates = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
    const chartLabels = Array.from({ length: 24 }, (_, h) => hourLabel(h))
    return {
      range,
      rangeLabel: 'Today',
      timezoneLabel: 'UTC',
      startDate: todayUTC,
      endDate,
      startISO: todayUTC.toISOString(),
      endISO: endDate.toISOString(),
      chartDates,
      chartLabels,
      isHourly: true,
      groupByExpr: "strftime('%H', timestamp)",
    }
  }

  const days = range === '30d' ? 30 : 7
  const startDate = new Date(todayUTC.getTime() - (days - 1) * DAY_MS)
  const chartDates = Array.from({ length: days }, (_, index) =>
    new Date(startDate.getTime() + index * DAY_MS).toISOString().slice(0, 10)
  )

  return {
    range,
    rangeLabel: range === '30d' ? 'Last 30 Days' : 'Last 7 Days',
    timezoneLabel: 'UTC',
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    chartDates,
    chartLabels: chartDates,
    isHourly: false,
    groupByExpr: "strftime('%Y-%m-%d', timestamp)",
  }
}
