import test from 'node:test'
import assert from 'node:assert/strict'
import { createSqliteD1 } from './helpers/sqliteD1'
import { EVENT_VISITOR_KEY_SQL, PAGEVIEW_VISITOR_KEY_SQL } from '../src/lib/visitorKey'
import { computeGoalSummaries } from '../src/lib/goals'

const SITE = 'site-1'

function setup() {
  const { db, d1 } = createSqliteD1()
  db.exec('PRAGMA foreign_keys = OFF')
  const pv = db.prepare(
    'INSERT INTO pageviews (site_id, path, referrer, country, browser, screen_width, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const ev = db.prepare(
    'INSERT INTO custom_events (site_id, event_name, path, referrer, country, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  )
  return { db, d1, pv, ev }
}

function countVisitors(db: ReturnType<typeof setup>['db'], start: string, end: string): number {
  const row = db.prepare(
    `SELECT COUNT(DISTINCT ${PAGEVIEW_VISITOR_KEY_SQL}) AS n FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`
  ).get(SITE, start, end) as { n: number }
  return row.n
}

test('one visitor browsing several pages in a day counts once', () => {
  const { db, pv } = setup()
  for (const path of ['/', '/pricing', '/docs', '/pricing']) {
    pv.run(SITE, path, '', 'US', 'Chrome', 1920, '2026-11-04T10:00:00Z')
  }
  assert.equal(countVisitors(db, '2026-11-04', '2026-11-05'), 1)
})

test('visitors that differ in country, browser, or screen width count separately', () => {
  const { db, pv } = setup()
  pv.run(SITE, '/', '', 'US', 'Chrome', 1920, '2026-11-04T10:00:00Z')
  pv.run(SITE, '/', '', 'DE', 'Chrome', 1920, '2026-11-04T10:00:00Z')
  pv.run(SITE, '/', '', 'US', 'Safari', 1920, '2026-11-04T10:00:00Z')
  pv.run(SITE, '/', '', 'US', 'Chrome', 390, '2026-11-04T10:00:00Z')
  assert.equal(countVisitors(db, '2026-11-04', '2026-11-05'), 4)
})

test('the key still rotates daily', () => {
  const { db, pv } = setup()
  pv.run(SITE, '/', '', 'US', 'Chrome', 1920, '2026-11-04T10:00:00Z')
  pv.run(SITE, '/', '', 'US', 'Chrome', 1920, '2026-11-05T10:00:00Z')
  assert.equal(countVisitors(db, '2026-11-04', '2026-11-06'), 2)
})

test('an event goal fired on several pages by one visitor converts once, never above 100%', async () => {
  const { d1, pv, ev } = setup()
  for (const path of ['/a', '/b', '/c']) {
    pv.run(SITE, path, '', 'US', 'Chrome', 1920, '2026-11-04T10:00:00Z')
    ev.run(SITE, 'cta_click', path, '', 'US', '2026-11-04T10:00:00Z')
  }
  const [summary] = await computeGoalSummaries({
    db: d1 as unknown as D1Database,
    siteId: SITE,
    goals: [{ id: 'g1', name: 'CTA', match_pattern: 'event:cta_click', created_at: '2026-11-01' }],
    uvExpr: PAGEVIEW_VISITOR_KEY_SQL,
    startISO: '2026-11-04',
    endISO: '2026-11-05',
    previousStartISO: '2026-11-03',
    previousEndISO: '2026-11-04',
    totalVisitors: 1,
    previousTotalVisitors: 0,
  })
  assert.equal(summary.conversions, 1)
  assert.equal(summary.conversionRatePct, 100)
})

test('neither visitor key includes the page path', () => {
  assert.doesNotMatch(PAGEVIEW_VISITOR_KEY_SQL, /\bpath\b/)
  assert.doesNotMatch(EVENT_VISITOR_KEY_SQL, /\bpath\b/)
})
