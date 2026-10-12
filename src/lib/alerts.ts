/**
 * Traffic alert rules.
 *
 * Beam's sites are small — most see 1–40 pageviews a day — and at that volume a
 * single quiet day is normal, not news. The old rule ("today is 40% below the
 * 28-day average") was backtested on production history from 2026-07-01 to
 * 2026-10-11: even comparing complete days it fired ~420 times a month, nearly
 * all noise, and the paying customer had turned alerts off on 18 of 19 sites.
 *
 * What customers actually need to hear about is tracking *stopping* (the
 * June 2026 incident), plus genuinely large spikes. Replayed over the same
 * history, these two rules fire ~8 times a month across all ~24 eligible sites
 * (a quarter of them on Beam's own), and the outage rule catches 69–89% of
 * simulated 2–3 day outages.
 */

export const ALERT_BASELINE_DAYS = 28

/**
 * A site must have had traffic on this many of the baseline days to be
 * "reliably active". 20 is exactly four five-day weeks, so weekday-only sites
 * (B2B, schools) qualify; at 21 they never could.
 */
export const MIN_ACTIVE_BASELINE_DAYS = 20

/** Spikes are only judged on sites big enough for a daily count to mean something. */
export const SPIKE_MIN_DAILY_AVG = 10
export const SPIKE_MIN_PERCENT = 100
export const SPIKE_MIN_Z = 3

/**
 * How many days of history the detectors need, ending with the last complete
 * day. A reliably active baseline has gaps of at most 8 days, so a quiet streak
 * fires by day 9 at the latest; 28 baseline days precede it.
 */
export const ALERT_HISTORY_DAYS = ALERT_BASELINE_DAYS + (ALERT_BASELINE_DAYS - MIN_ACTIVE_BASELINE_DAYS) + 1

export function averageDaily(total: number, days: number): number {
  if (days <= 0) return 0
  return total / days
}

export function calculatePercentChange(current: number, baseline: number): number | null {
  if (baseline <= 0) return null
  return ((current - baseline) / baseline) * 100
}

export function longestZeroRun(counts: number[]): number {
  let best = 0
  let run = 0
  for (const n of counts) {
    run = n === 0 ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

function trailingZeroRun(counts: number[]): number {
  let run = 0
  for (let i = counts.length - 1; i >= 0 && counts[i] === 0; i--) run++
  return run
}

export type TrackingStopped = {
  /** Consecutive complete days with no pageviews, ending with the last one. */
  quietDays: number
  /** The longest quiet stretch in the baseline — what "normal" looks like. */
  longestNormalGap: number
  baselineDaily: number
}

/**
 * Fires when a reliably active site has now been silent for longer than it ever
 * was in the 28 days before the silence began. Fires on exactly one day per
 * outage — the day the streak first exceeds the normal gap — so an outage sends
 * one email, not one per day.
 *
 * @param daily pageviews per UTC day, oldest first, ending with the last complete day
 */
export function detectTrackingStopped(daily: number[]): TrackingStopped | null {
  const quietDays = trailingZeroRun(daily)
  if (quietDays === 0) return null

  const baseline = daily.slice(0, daily.length - quietDays).slice(-ALERT_BASELINE_DAYS)
  if (baseline.length < ALERT_BASELINE_DAYS) return null
  if (baseline.filter(n => n > 0).length < MIN_ACTIVE_BASELINE_DAYS) return null

  const longestNormalGap = longestZeroRun(baseline)
  if (quietDays !== longestNormalGap + 1) return null

  return { quietDays, longestNormalGap, baselineDaily: averageDaily(baseline.reduce((a, b) => a + b, 0), ALERT_BASELINE_DAYS) }
}

export type TrafficSpike = { pageviews: number; baselineDaily: number; percent: number }

/**
 * A spike must clear both a relative bar (over double the average) and the
 * site's own variability (3 standard deviations), and only counts on sites
 * averaging 10+ pageviews a day. The deviation is floored at √mean so a
 * perfectly flat baseline doesn't make every wobble look extreme.
 *
 * @param daily pageviews per UTC day, oldest first, ending with the last complete day
 */
export function detectSpike(daily: number[]): TrafficSpike | null {
  const pageviews = daily[daily.length - 1]
  const baseline = daily.slice(0, -1).slice(-ALERT_BASELINE_DAYS)
  if (pageviews === undefined || baseline.length < ALERT_BASELINE_DAYS) return null

  const mean = averageDaily(baseline.reduce((a, b) => a + b, 0), ALERT_BASELINE_DAYS)
  if (mean < SPIKE_MIN_DAILY_AVG) return null

  const variance = baseline.reduce((acc, n) => acc + (n - mean) ** 2, 0) / baseline.length
  const sd = Math.max(Math.sqrt(variance), Math.sqrt(mean))
  const percent = calculatePercentChange(pageviews, mean) ?? 0
  if (percent <= SPIKE_MIN_PERCENT || (pageviews - mean) / sd < SPIKE_MIN_Z) return null

  return { pageviews, baselineDaily: mean, percent: Math.round(percent) }
}
