import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { handleScheduled } from '../src/scheduled'
import { createSqliteD1 } from './helpers/sqliteD1'

/**
 * Traffic alerts used to compare "today" at 09:00 UTC — nine hours of traffic —
 * against a full-day average, so an ordinary day read as a ~60% drop. On
 * 2026-10-12, 23 of 25 eligible production sites would have alerted, and the
 * paying customer had turned alerts off on 18 of their 19 sites.
 *
 * These run the real alert SQL against SQLite with every migration applied.
 * The rules themselves are unit-tested in alerts.test.ts.
 */

const DAILY = '0 9 * * *'
const WEEKLY = '0 9 * * 1'
const RUN_AT = Date.parse('2026-10-12T09:00:00.000Z') // a Monday, like the cron
const DAY_MS = 86400_000

type Db = ReturnType<typeof createSqliteD1>['db']
type Sent = { to: string; subject: string; text: string; html: string }

function setup(t: TestContext) {
  const { db, d1 } = createSqliteD1()
  const now = new Date().toISOString()
  db.prepare("INSERT INTO users (id, email, password_hash, plan, created_at, updated_at) VALUES ('u1', 'owner@example.com', 'x', 'pro', ?, ?)").run(now, now)
  db.prepare("INSERT INTO sites (id, user_id, domain, name, created_at) VALUES ('s1', 'u1', 'example.com', 'Example', ?)").run(now)

  const sent: Sent[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('resend.com')) {
      const body = JSON.parse(String(init?.body))
      sent.push({ to: body.to, subject: body.subject, text: body.text, html: body.html })
    }
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  t.after(() => { globalThis.fetch = realFetch })
  t.mock.timers.enable({ apis: ['Date'], now: RUN_AT })

  const kv = { get: async () => null, put: async () => undefined, list: async () => ({ keys: [] }), delete: async () => undefined }
  const env = { DB: d1, KV: kv, RESEND_API_KEY: 're_test', PUBLIC_BASE_URL: 'https://beam-privacy.com', BEAM_JWT_SECRET: 'test' }
  // Everything except the weekly digest — so a regression to any old alert
  // subject ("Traffic alert: … is down") still counts.
  const alerts = () => sent.filter(m => !/^Your weekly Beam digest/.test(m.subject))
  return { db, env, alerts }
}

/** `perDay` pageviews on a UTC day, spread evenly across the first `untilHour` hours. */
function seedDay(db: Db, day: string, perDay: number, untilHour = 24) {
  const insert = db.prepare("INSERT INTO pageviews (site_id, path, referrer, timestamp) VALUES ('s1', '/', 'https://news.ycombinator.com/item?id=1', ?)")
  for (let i = 0; i < perDay; i++) {
    const ms = Math.floor((i / perDay) * DAY_MS)
    if (ms >= untilHour * 3600_000) break
    insert.run(new Date(Date.parse(`${day}T00:00:00.000Z`) + ms).toISOString())
  }
}

/** Seeds `count(daysAgo)` for each of the `n` days before 2026-10-11 (the last complete day). */
function seedHistory(db: Db, n: number, count: (daysAgo: number) => number) {
  for (let d = 1; d <= n; d++) {
    seedDay(db, new Date(Date.parse('2026-10-11T00:00:00.000Z') - d * DAY_MS).toISOString().slice(0, 10), count(d))
  }
}

test('an ordinary day does not alert just because the run is at 09:00', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, () => 96)
  seedDay(db, '2026-10-11', 96)
  seedDay(db, '2026-10-12', 96, 9) // the partial day the old code compared

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(alerts(), [])
})

test('a quiet-but-alive day does not alert (the old rule called this a 79% drop)', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, () => 96)
  seedDay(db, '2026-10-11', 20)

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(alerts(), [])
})

test('tracking stopping on a daily-active site alerts once, with the last pageview date', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, () => 30)
  // nothing on 2026-10-11

  await handleScheduled(env as never, DAILY)
  const sent = alerts()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'owner@example.com')
  assert.equal(sent[0].subject, 'Tracking may have stopped: no pageviews from Example for 1 day')
  assert.match(sent[0].text, /Last pageview: 2026-10-10/)
  assert.match(sent[0].text, /it had pageviews every day/)
  assert.match(sent[0].html, /\/dashboard\/sites\/s1"/, 'links to the installation check')
})

test('the second silent day does not send a second email', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, d => (d === 1 ? 0 : 30)) // silent on 10-10 and 10-11

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(alerts(), [])
})

test('a big spike on the last complete day alerts with its top referrer', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, () => 96)
  seedDay(db, '2026-10-11', 300)

  await handleScheduled(env as never, DAILY)
  const sent = alerts()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].subject, 'Traffic spike: Example up 213%')
  assert.match(sent[0].text, /Pageviews on 2026-10-11: 300/)
  assert.match(sent[0].text, /Top referrer: news\.ycombinator\.com/)
})

test('a spike on a small site does not alert', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, () => 4)
  seedDay(db, '2026-10-11', 40)

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(alerts(), [])
})

test('the weekly trigger does not run alerts, so Mondays send one, not two', async (t) => {
  const { db, env, alerts } = setup(t)
  seedHistory(db, 35, () => 30)

  await handleScheduled(env as never, WEEKLY)
  assert.deepEqual(alerts(), [])
})

test('sites with alerts turned off get nothing', async (t) => {
  const { db, env, alerts } = setup(t)
  db.prepare("UPDATE sites SET alerts_enabled = 0 WHERE id = 's1'").run()
  seedHistory(db, 35, () => 30)

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(alerts(), [])
})
