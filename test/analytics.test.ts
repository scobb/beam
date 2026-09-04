import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAnalyticsWindow,
  buildEventPropertiesQuery,
  buildSiteHasPageviewsQuery,
  normalizeAnalyticsRange,
  selectAnalyticsEmptyState,
} from '../src/lib/analytics'

test('normalizeAnalyticsRange defaults invalid values to 7d', () => {
  assert.equal(normalizeAnalyticsRange(undefined), '7d')
  assert.equal(normalizeAnalyticsRange('bad-input'), '7d')
  assert.equal(normalizeAnalyticsRange('today'), 'today')
  assert.equal(normalizeAnalyticsRange('30d'), '30d')
})

test('today window snaps to UTC midnight and uses 24 hourly buckets', () => {
  const window = buildAnalyticsWindow(new Date('2026-04-02T18:45:00-07:00'), 'today')

  assert.equal(window.range, 'today')
  assert.equal(window.startISO, '2026-04-03T00:00:00.000Z')
  assert.equal(window.endISO, '2026-04-04T00:00:00.000Z')
  assert.equal(window.isHourly, true)
  assert.equal(window.chartDates.length, 24)
  assert.equal(window.chartDates[0], '00')
  assert.equal(window.chartDates[23], '23')
  assert.equal(window.chartLabels[0], '12am')
  assert.equal(window.chartLabels[12], '12pm')
  assert.equal(window.chartLabels[13], '1pm')
  assert.equal(window.chartLabels[23], '11pm')
  assert.equal(window.groupByExpr, "strftime('%H', timestamp)")
})

test('7 day window uses the same UTC basis for filters and chart buckets', () => {
  const window = buildAnalyticsWindow(new Date('2026-04-02T01:30:00Z'), '7d')

  assert.equal(window.startISO, '2026-03-27T00:00:00.000Z')
  assert.equal(window.endISO, '2026-04-03T00:00:00.000Z')
  assert.equal(window.chartDates[0], '2026-03-27')
  assert.equal(window.chartDates[window.chartDates.length - 1], '2026-04-02')
  assert.equal(window.chartDates.length, 7)
  assert.equal(window.isHourly, false)
  assert.deepEqual(window.chartLabels, window.chartDates)
  assert.equal(window.groupByExpr, "strftime('%Y-%m-%d', timestamp)")
})

// ── D1 read reduction: empty-state probe ──────────────────────────────────────
// The empty-state check only needs to know *whether* a site has ever recorded a
// pageview, not how many. Counting scanned every row a site had ever recorded
// (~2.2B rows/month in production, 25% of all D1 reads) to answer a yes/no.

test('selectAnalyticsEmptyState: no data ever — site has never recorded a pageview', () => {
  assert.equal(selectAnalyticsEmptyState(false, 0), 'no-data-ever')
})

test('selectAnalyticsEmptyState: no data in range — site has history but none in range', () => {
  assert.equal(selectAnalyticsEmptyState(true, 0), 'no-data-in-range')
})

test('selectAnalyticsEmptyState: has data — range contains pageviews', () => {
  assert.equal(selectAnalyticsEmptyState(true, 10), 'has-data')
})

test('buildSiteHasPageviewsQuery probes for existence instead of counting rows', () => {
  const sql = buildSiteHasPageviewsQuery()

  assert.match(sql, /LIMIT 1/i, 'must stop at the first matching row')
  assert.doesNotMatch(sql, /COUNT\s*\(/i, 'must not scan every row to answer a yes/no')
  assert.match(sql, /FROM pageviews WHERE site_id = \?/i)
})

// ── D1 read reduction: event properties are lazy-loaded ───────────────────────
// The json_each cross join reads ~2,170 rows for every row it returns (2.52B
// rows/month, 29.8% of total D1 runtime). It must not run on page load.

test('buildEventPropertiesQuery is bounded by site and time range', () => {
  const sql = buildEventPropertiesQuery()

  assert.match(sql, /json_each/i)
  assert.match(sql, /ce\.site_id = \?/i)
  assert.match(sql, /ce\.timestamp >= \? AND ce\.timestamp < \?/i)
  assert.match(sql, /LIMIT 20/i)
})
