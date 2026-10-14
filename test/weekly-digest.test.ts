import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { handleScheduled, isReservedEmail } from '../src/scheduled'
import { createSqliteD1 } from './helpers/sqliteD1'

/**
 * The weekly digest had its own trigger, '0 9 * * 1', on the same minute as the
 * daily one. Cloudflare fires only one trigger per minute, so on every Monday
 * checked only the daily one ran and no digest was ever sent. It now goes out
 * from the daily run on Mondays.
 */

const DAILY = '0 9 * * *'
const MONDAY = Date.parse('2026-10-19T09:00:00.000Z')
const TUESDAY = Date.parse('2026-10-20T09:00:00.000Z')
const DAY_MS = 86400_000

type Db = ReturnType<typeof createSqliteD1>['db']
type Sent = { to: string; subject: string; text: string; html: string }

function setup(t: TestContext, runAt = MONDAY) {
  const { db, d1 } = createSqliteD1()
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
  t.mock.timers.enable({ apis: ['Date'], now: runAt })

  const kv = { get: async () => null, put: async () => undefined, list: async () => ({ keys: [] }), delete: async () => undefined }
  const env = { DB: d1, KV: kv, RESEND_API_KEY: 're_test', PUBLIC_BASE_URL: 'https://beam-privacy.com', BEAM_JWT_SECRET: 'test' }
  const digests = () => sent.filter(m => /^Your weekly Beam digest/.test(m.subject))
  return { db, env, digests, runAt }
}

function addUser(db: Db, id: string, email: string, optOut = 0) {
  const now = new Date().toISOString()
  db.prepare("INSERT INTO users (id, email, password_hash, plan, digest_opt_out, created_at, updated_at) VALUES (?, ?, 'x', 'pro', ?, ?, ?)").run(id, email, optOut, now, now)
}

function addSite(db: Db, id: string, userId: string, name: string) {
  db.prepare('INSERT INTO sites (id, user_id, domain, name, created_at) VALUES (?, ?, ?, ?, ?)').run(id, userId, name, name, new Date().toISOString())
}

/** `n` pageviews spread over the six days before `runAt`. */
function addTraffic(db: Db, siteId: string, n: number, runAt: number) {
  const insert = db.prepare("INSERT INTO pageviews (site_id, path, referrer, timestamp) VALUES (?, '/', 'https://news.ycombinator.com/item?id=1', ?)")
  for (let i = 0; i < n; i++) insert.run(siteId, new Date(runAt - DAY_MS - (i % 6) * DAY_MS).toISOString())
}

test('the daily trigger sends digests on Mondays', async (t) => {
  const { db, env, digests, runAt } = setup(t)
  addUser(db, 'u1', 'owner@gmail.com')
  addSite(db, 's1', 'u1', 'Example')
  addTraffic(db, 's1', 12, runAt)

  await handleScheduled(env as never, DAILY)
  const sent = digests()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'owner@gmail.com')
  assert.equal(sent[0].subject, 'Your weekly Beam digest — Example')
  assert.match(sent[0].text, /Pageviews: 12/)
})

test('the daily trigger sends no digest on other days', async (t) => {
  const { db, env, digests, runAt } = setup(t, TUESDAY)
  addUser(db, 'u1', 'owner@gmail.com')
  addSite(db, 's1', 'u1', 'Example')
  addTraffic(db, 's1', 12, runAt)

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(digests(), [])
})

test('several sites make one email, leaving out sites with no traffic', async (t) => {
  const { db, env, digests, runAt } = setup(t)
  addUser(db, 'u1', 'owner@gmail.com')
  addSite(db, 's1', 'u1', 'Lisbon')
  addSite(db, 's2', 'u1', 'Berlin')
  addSite(db, 's3', 'u1', 'Never installed')
  addTraffic(db, 's1', 5, runAt)
  addTraffic(db, 's2', 40, runAt)

  await handleScheduled(env as never, DAILY)
  const sent = digests()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].subject, 'Your weekly Beam digest — 2 sites')
  assert.match(sent[0].text, /45 pageviews in the last 7 days/)
  assert.match(sent[0].text, /Berlin: 40 pageviews[\s\S]*Lisbon: 5 pageviews/, 'busiest site first')
  assert.match(sent[0].text, /top source news\.ycombinator\.com/)
  assert.doesNotMatch(sent[0].text, /Never installed/)
  assert.match(sent[0].html, /\/dashboard\/sites\/s2"/)
})

test('a user whose sites had no traffic gets no digest', async (t) => {
  const { db, env, digests } = setup(t)
  addUser(db, 'u1', 'owner@gmail.com')
  addSite(db, 's1', 'u1', 'Example')

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(digests(), [])
})

test('opted-out users and reserved test addresses get no digest', async (t) => {
  const { db, env, digests, runAt } = setup(t)
  addUser(db, 'u1', 'owner@gmail.com', 1)
  addUser(db, 'u2', 'smoke-123@example.com')
  addSite(db, 's1', 'u1', 'Opted out')
  addSite(db, 's2', 'u2', 'Smoke')
  addTraffic(db, 's1', 12, runAt)
  addTraffic(db, 's2', 12, runAt)

  await handleScheduled(env as never, DAILY)
  assert.deepEqual(digests(), [])
})

test('site names, paths and referrers are escaped in the HTML', async (t) => {
  const { db, env, digests, runAt } = setup(t)
  addUser(db, 'u1', 'owner@gmail.com')
  addSite(db, 's1', 'u1', '<img src=x onerror=alert(1)>')
  db.prepare("INSERT INTO pageviews (site_id, path, referrer, timestamp) VALUES ('s1', '/<script>', '<b>ref</b>', ?)").run(new Date(runAt - DAY_MS).toISOString())

  await handleScheduled(env as never, DAILY)
  const [mail] = digests()
  assert.ok(mail)
  assert.doesNotMatch(mail.html, /<img src=x|<script>|<b>ref/)
  assert.match(mail.html, /&lt;img src=x/)
})

test('isReservedEmail matches RFC 2606 names only', () => {
  for (const e of ['a@example.com', 'a@EXAMPLE.org', 'a@foo.example', 'a@x.test', 'a@x.invalid', 'a@localhost']) assert.ok(isReservedEmail(e), e)
  for (const e of ['a@gmail.com', 'a@me.com', 'a@example.co.uk', 'a@myexample.com', 'a@testing.io']) assert.ok(!isReservedEmail(e), e)
})

test('no two cron triggers share a minute, in any wrangler config', () => {
  for (const file of ['wrangler.toml', 'wrangler-noroutesdeploy.toml', 'wrangler.deploy.toml', 'wrangler.deploy-fallback.toml']) {
    const crons = JSON.parse(readFileSync(file, 'utf8').match(/^crons\s*=\s*(\[.*\])/m)![1]) as string[]
    const minutes = crons.map(c => c.split(/\s+/).slice(0, 2).join(' '))
    assert.equal(new Set(minutes).size, minutes.length, `${file}: ${crons.join(', ')}`)
  }
})
