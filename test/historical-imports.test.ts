import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildImportCoverageSnapshotQuery,
  buildImportedDailyMetricsRangeQuery,
  mergeDailyMetrics,
  normalizeImportJobStatus,
  normalizeImportSource,
  parseFathomDailyCsv,
  parseGoogleAnalyticsDailyCsv,
  parsePlausibleDailyCsv,
  parseImportedDailyMetricRow,
  resolveImportCoverageWindow,
} from '../src/lib/historicalImports'

test('normalizeImportSource and normalizeImportJobStatus only allow known values', () => {
  assert.equal(normalizeImportSource('Google_Analytics'), 'google_analytics')
  assert.equal(normalizeImportSource(' plausible '), 'plausible')
  assert.equal(normalizeImportSource('unknown'), null)

  assert.equal(normalizeImportJobStatus('completed'), 'completed')
  assert.equal(normalizeImportJobStatus(' PROCESSING '), 'processing')
  assert.equal(normalizeImportJobStatus('done'), null)
})

test('parseImportedDailyMetricRow parses valid daily metric rows', () => {
  const parsed = parseImportedDailyMetricRow(
    { date: '2026-03-30', visitors: '1,234', pageviews: '5678' },
    12,
  )

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  assert.deepEqual(parsed.value, {
    date: '2026-03-30',
    visitors: 1234,
    pageviews: 5678,
  })
})

test('parseImportedDailyMetricRow rejects malformed rows with row-aware messages', () => {
  const badDate = parseImportedDailyMetricRow({ date: '03/30/2026', visitors: '10', pageviews: '20' }, 2)
  assert.equal(badDate.ok, false)
  if (!badDate.ok) assert.match(badDate.error, /Row 2: invalid date/i)

  const badVisitors = parseImportedDailyMetricRow({ date: '2026-03-30', visitors: '-1', pageviews: '20' }, 3)
  assert.equal(badVisitors.ok, false)
  if (!badVisitors.ok) assert.match(badVisitors.error, /Row 3: invalid visitors/i)

  const badPageviews = parseImportedDailyMetricRow({ date: '2026-03-30', visitors: '20', pageviews: '9.5' }, 4)
  assert.equal(badPageviews.ok, false)
  if (!badPageviews.ok) assert.match(badPageviews.error, /Row 4: invalid pageviews/i)
})

test('parseGoogleAnalyticsDailyCsv parses supported GA daily exports and aggregates duplicate days', () => {
  const parsed = parseGoogleAnalyticsDailyCsv([
    'Date,Active users,Views',
    '20260330,1,2',
    '2026-03-31,"1,200",3400',
    '2026-03-31,5,10',
  ].join('\n'))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  assert.equal(parsed.value.source, 'google_analytics')
  assert.equal(parsed.value.rowCount, 3)
  assert.equal(parsed.value.coverageStartDate, '2026-03-30')
  assert.equal(parsed.value.coverageEndDate, '2026-03-31')
  assert.deepEqual(parsed.value.rows, [
    { date: '2026-03-30', visitors: 1, pageviews: 2 },
    { date: '2026-03-31', visitors: 1205, pageviews: 3410 },
  ])
})

test('parseGoogleAnalyticsDailyCsv rejects unsupported GA files missing required columns', () => {
  const parsed = parseGoogleAnalyticsDailyCsv([
    'Date,Sessions',
    '2026-03-30,100',
  ].join('\n'))

  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.match(parsed.error, /missing required column/i)
    assert.match(parsed.error, /active users/i)
  }
})

test('parsePlausibleDailyCsv parses supported Plausible daily exports and aggregates duplicate days', () => {
  const parsed = parsePlausibleDailyCsv([
    'Date,Visitors,Pageviews',
    '2026-03-30,10,20',
    '2026-03-31,"1,200",3400',
    '2026-03-31,5,10',
  ].join('\n'))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  assert.equal(parsed.value.source, 'plausible')
  assert.equal(parsed.value.rowCount, 3)
  assert.equal(parsed.value.coverageStartDate, '2026-03-30')
  assert.equal(parsed.value.coverageEndDate, '2026-03-31')
  assert.deepEqual(parsed.value.rows, [
    { date: '2026-03-30', visitors: 10, pageviews: 20 },
    { date: '2026-03-31', visitors: 1205, pageviews: 3410 },
  ])
})

test('parsePlausibleDailyCsv rejects unsupported files missing required columns', () => {
  const parsed = parsePlausibleDailyCsv([
    'Date,Visitors,Unique Pageviews',
    '2026-03-30,100,150',
  ].join('\n'))

  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.match(parsed.error, /missing required column/i)
    assert.match(parsed.error, /pageviews/i)
  }
})

test('parseFathomDailyCsv parses supported Fathom daily exports and aggregates duplicate days', () => {
  const parsed = parseFathomDailyCsv([
    'Date,Unique visitors,Pageviews',
    '2026-03-30,10,20',
    '2026-03-31,"1,200",3400',
    '2026-03-31,5,10',
  ].join('\n'))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  assert.equal(parsed.value.source, 'fathom')
  assert.equal(parsed.value.rowCount, 3)
  assert.equal(parsed.value.coverageStartDate, '2026-03-30')
  assert.equal(parsed.value.coverageEndDate, '2026-03-31')
  assert.deepEqual(parsed.value.rows, [
    { date: '2026-03-30', visitors: 10, pageviews: 20 },
    { date: '2026-03-31', visitors: 1205, pageviews: 3410 },
  ])
})

test('parseFathomDailyCsv rejects unsupported files missing required columns', () => {
  const parsed = parseFathomDailyCsv([
    'Date,Visitors,Pageviews',
    '2026-03-30,100,150',
  ].join('\n'))

  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.match(parsed.error, /missing required column/i)
    assert.match(parsed.error, /unique visitors/i)
  }
})

test('parseFathomDailyCsv rejects empty files', () => {
  const parsed = parseFathomDailyCsv('')
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.match(parsed.error, /empty/i)
})

test('parseFathomDailyCsv rejects malformed date rows with row-aware messages', () => {
  const parsed = parseFathomDailyCsv([
    'Date,Unique visitors,Pageviews',
    '03/30/2026,10,20',
  ].join('\n'))
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.match(parsed.error, /invalid date/i)
})

test('query helpers return import foundation SQL with completion and coverage fields', () => {
  const coverageSql = buildImportCoverageSnapshotQuery()
  assert.match(coverageSql, /MIN\(strftime\('%Y-%m-%d', timestamp\)\)/)
  assert.match(coverageSql, /imported_daily_traffic/)

  const rangeSql = buildImportedDailyMetricsRangeQuery()
  assert.match(rangeSql, /JOIN import_jobs/)
  assert.match(rangeSql, /j\.status = 'completed'/)
  assert.match(rangeSql, /ORDER BY t\.date ASC, imported_at DESC, t\.source ASC/)
})

test('resolveImportCoverageWindow marks hybrid mode and trims imported overlap at first native day', () => {
  const window = resolveImportCoverageWindow({
    nativeStartDate: '2026-03-20',
    nativeEndDate: '2026-04-01',
    importedStartDate: '2026-02-01',
    importedEndDate: '2026-03-25',
  })

  assert.equal(window.mode, 'hybrid')
  assert.equal(window.cutoverDate, '2026-03-20')
  assert.equal(window.importedVisibleStartDate, '2026-02-01')
  assert.equal(window.importedVisibleEndDate, '2026-03-19')
})

test('resolveImportCoverageWindow degrades to native-only when imports do not add pre-native days', () => {
  const window = resolveImportCoverageWindow({
    nativeStartDate: '2026-03-20',
    nativeEndDate: '2026-04-01',
    importedStartDate: '2026-03-20',
    importedEndDate: '2026-03-25',
  })

  assert.equal(window.mode, 'native-only')
  assert.equal(window.cutoverDate, null)
  assert.equal(window.importedVisibleStartDate, null)
  assert.equal(window.importedVisibleEndDate, null)
})

test('resolveImportCoverageWindow returns empty mode when no data exists', () => {
  const window = resolveImportCoverageWindow({
    nativeStartDate: null,
    nativeEndDate: null,
    importedStartDate: null,
    importedEndDate: null,
  })

  assert.equal(window.mode, 'empty')
  assert.equal(window.cutoverDate, null)
  assert.equal(window.importedVisibleStartDate, null)
  assert.equal(window.importedVisibleEndDate, null)
})

test('resolveImportCoverageWindow returns import-only mode when no native data exists', () => {
  const window = resolveImportCoverageWindow({
    nativeStartDate: null,
    nativeEndDate: null,
    importedStartDate: '2026-01-01',
    importedEndDate: '2026-03-31',
  })

  assert.equal(window.mode, 'import-only')
  assert.equal(window.cutoverDate, null)
  assert.equal(window.importedVisibleStartDate, '2026-01-01')
  assert.equal(window.importedVisibleEndDate, '2026-03-31')
})

test('resolveImportCoverageWindow returns native-only mode when no imports exist', () => {
  const window = resolveImportCoverageWindow({
    nativeStartDate: '2026-03-01',
    nativeEndDate: '2026-04-01',
    importedStartDate: null,
    importedEndDate: null,
  })

  assert.equal(window.mode, 'native-only')
  assert.equal(window.cutoverDate, null)
  assert.equal(window.importedVisibleStartDate, null)
  assert.equal(window.importedVisibleEndDate, null)
})

test('mergeDailyMetrics prefers native rows on overlapping dates and picks latest import for import-only days', () => {
  const merged = mergeDailyMetrics(
    [
      { date: '2026-03-20', visitors: 10, pageviews: 15 },
      { date: '2026-03-22', visitors: 20, pageviews: 30 },
    ],
    [
      { date: '2026-03-19', source: 'google_analytics', visitors: 8, pageviews: 9, importedAt: '2026-04-01T09:00:00.000Z' },
      { date: '2026-03-20', source: 'google_analytics', visitors: 100, pageviews: 100, importedAt: '2026-04-01T09:00:00.000Z' },
      { date: '2026-03-21', source: 'plausible', visitors: 3, pageviews: 6, importedAt: '2026-03-30T09:00:00.000Z' },
      { date: '2026-03-21', source: 'fathom', visitors: 7, pageviews: 11, importedAt: '2026-04-02T09:00:00.000Z' },
    ],
  )

  assert.deepEqual(merged, [
    { date: '2026-03-19', visitors: 8, pageviews: 9, dataSource: 'google_analytics' },
    { date: '2026-03-20', visitors: 10, pageviews: 15, dataSource: 'native' },
    { date: '2026-03-21', visitors: 7, pageviews: 11, dataSource: 'fathom' },
    { date: '2026-03-22', visitors: 20, pageviews: 30, dataSource: 'native' },
  ])
})
