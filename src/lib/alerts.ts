export const ALERT_BASELINE_DAYS = 28
export const MIN_ALERT_DATA_DAYS = 7

export type AlertDirection = 'down' | 'spike'

export function averageDaily(total: number, days: number): number {
  if (days <= 0) return 0
  return total / days
}

export function hasMinimumDataDays(dayCount: number): boolean {
  return dayCount >= MIN_ALERT_DATA_DAYS
}

export function calculatePercentChange(current: number, baseline: number): number | null {
  if (baseline <= 0) return null
  return ((current - baseline) / baseline) * 100
}

export function detectAnomaly(current: number, baseline: number): { direction: AlertDirection; percent: number } | null {
  const pct = calculatePercentChange(current, baseline)
  if (pct === null) return null

  if (pct < -40) {
    return { direction: 'down', percent: Math.round(Math.abs(pct)) }
  }

  if (pct > 100) {
    return { direction: 'spike', percent: Math.round(pct) }
  }

  return null
}
