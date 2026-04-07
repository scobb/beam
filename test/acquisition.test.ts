import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAcquisitionUserScopeClause, buildAcquisitionWindow, normalizeAcquisitionRange } from '../src/lib/acquisition'

test('normalizeAcquisitionRange defaults invalid values to 7d', () => {
  assert.equal(normalizeAcquisitionRange(undefined), '7d')
  assert.equal(normalizeAcquisitionRange('today'), '7d')
  assert.equal(normalizeAcquisitionRange('bad-input'), '7d')
  assert.equal(normalizeAcquisitionRange('30d'), '30d')
  assert.equal(normalizeAcquisitionRange('90d'), '90d')
})

test('buildAcquisitionWindow uses UTC day boundaries for 90d ranges', () => {
  const window = buildAcquisitionWindow(new Date('2026-04-02T18:45:00-07:00'), '90d')

  assert.equal(window.range, '90d')
  assert.equal(window.startISO, '2026-01-04T00:00:00.000Z')
  assert.equal(window.endISO, '2026-04-04T00:00:00.000Z')
  assert.equal(window.rangeLabel, 'Last 90 Days')
  assert.equal(window.timezoneLabel, 'UTC')
})

test('buildAcquisitionWindow uses UTC day boundaries for 7d ranges', () => {
  const window = buildAcquisitionWindow(new Date('2026-04-02T01:30:00Z'), '7d')

  assert.equal(window.range, '7d')
  assert.equal(window.startISO, '2026-03-27T00:00:00.000Z')
  assert.equal(window.endISO, '2026-04-03T00:00:00.000Z')
  assert.equal(window.rangeLabel, 'Last 7 Days')
})

test('buildAcquisitionUserScopeClause defaults to external-only classification', () => {
  const clause = buildAcquisitionUserScopeClause(false, 'u')
  assert.match(clause, /first_touch_is_internal/)
  assert.match(clause, /testmail\.dev/)
  assert.match(clause, /ralph\+\*/)
  assert.match(clause, /phase\[0-9\]\*/)
})

test('buildAcquisitionUserScopeClause allows include_internal debug mode', () => {
  assert.equal(buildAcquisitionUserScopeClause(true, 'u'), '')
})
