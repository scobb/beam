import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'

/**
 * Regression guard for the two queries that dominated D1 reads in production:
 *   - `COUNT(*) FROM pageviews WHERE site_id = ?`  — 2.2B rows/month (25% of all reads)
 *   - the `json_each` event-properties cross join  — 2.52B rows/month (29.8% of runtime)
 *
 * Both were in the public dashboard's page-load batch. Neither may return to it.
 */

const SITE_ID = 'site-under-test'

function recordingEnv(seen: string[]) {
  const statement = (sql: string) => ({
    bind: () => statement(sql),
    first: async () => {
      if (/FROM sites WHERE id = \?/i.test(sql)) return { id: SITE_ID, name: 'Test', domain: 'test.dev', public: 1 }
      return { count: 0 }
    },
    all: async () => ({ results: [] }),
    run: async () => ({}),
  })

  return {
    PUBLIC_BASE_URL: 'https://beam-privacy.com',
    DB: {
      prepare(sql: string) {
        seen.push(sql)
        return statement(sql)
      },
      async batch(statements: unknown[]) {
        return statements.map(() => ({ results: [] }))
      },
    },
    KV: {
      list: async () => ({ keys: [] }),
      get: async () => null,
      put: async () => undefined,
    },
  }
}

test('public dashboard page load issues no all-time pageview count', async () => {
  const seen: string[] = []
  const res = await app.request(`http://localhost/public/${SITE_ID}`, {}, recordingEnv(seen))
  assert.equal(res.status, 200)

  const offenders = seen.filter(sql => /COUNT\s*\(\s*\*\s*\)\s+as count FROM pageviews WHERE site_id = \?\s*$/i.test(sql.trim()))
  assert.deepEqual(offenders, [], 'unbounded all-time COUNT(*) is back in the page-load path')
})

test('public dashboard page load issues no json_each event-properties query', async () => {
  const seen: string[] = []
  const res = await app.request(`http://localhost/public/${SITE_ID}`, {}, recordingEnv(seen))
  assert.equal(res.status, 200)

  const offenders = seen.filter(sql => /json_each/i.test(sql))
  assert.deepEqual(offenders, [], 'the json_each cross join must stay behind the on-demand endpoint')
})

test('public dashboard probes pageview existence with LIMIT 1', async () => {
  const seen: string[] = []
  await app.request(`http://localhost/public/${SITE_ID}`, {}, recordingEnv(seen))

  const probes = seen.filter(sql => /FROM pageviews WHERE site_id = \? LIMIT 1/i.test(sql))
  assert.equal(probes.length, 1, 'expected exactly one bounded existence probe')
})

test('event properties are reachable on demand', async () => {
  const seen: string[] = []
  const res = await app.request(`http://localhost/public/${SITE_ID}/event-properties?range=7d`, {}, recordingEnv(seen))

  assert.equal(res.status, 200)
  assert.equal(seen.filter(sql => /json_each/i.test(sql)).length, 1, 'the panel must still be able to fetch its data')
})
