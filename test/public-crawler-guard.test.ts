import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'

/**
 * Crawlers walking the public dashboard's filter links drove D1 to 24.0B rows
 * read in 32 days (2026-10-12). Each guard here must stop the work *before* the
 * first query, so the assertions are on the SQL issued, not just the status.
 */

const SITE_ID = 'site-under-test'
const BINGBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

const BREAKDOWN_ROW = {
  path: '/pricing', source: 'news.ycombinator.com', country: 'DE', browser: 'Firefox', device_type: 'Mobile',
  channel: 'Search', event_name: 'signup', visitors: 3, pageviews: 5, views: 5, count: 5, cnt: 5, date: '2026-10-10',
}

function recordingEnv(seen: string[], opts: { isPublic?: number } = {}) {
  const statement = (sql: string) => ({
    bind: () => statement(sql),
    first: async () => {
      if (/FROM sites WHERE id = \?/i.test(sql)) return { id: SITE_ID, name: 'Test', domain: 'test.dev', public: opts.isPublic ?? 1 }
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
        // One row per breakdown, on values *other* than the active filters, so
        // the page has filter links it could offer.
        return statements.map(() => ({ results: [BREAKDOWN_ROW] }))
      },
    },
    KV: {
      list: async () => ({ keys: [] }),
      get: async () => null,
      put: async () => undefined,
    },
  }
}

function get(path: string, ua = CHROME, cf?: Record<string, unknown>): Request {
  const req = new Request(`https://beam-privacy.com${path}`, { headers: { 'user-agent': ua } })
  if (cf) Object.defineProperty(req, 'cf', { value: cf })
  return req
}

/** A Map-backed stand-in for `caches.default`, installed for one test. */
function withEdgeCache(t: { after: (fn: () => void) => void }) {
  const store = new Map<string, Response>()
  const g = globalThis as { caches?: unknown }
  const previous = g.caches
  g.caches = {
    default: {
      match: async (key: string) => store.get(key)?.clone(),
      put: async (key: string, res: Response) => { store.set(key, res) },
    },
  }
  t.after(() => { g.caches = previous })
  const pending: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p) }, passThroughOnException: () => undefined }
  return { store, ctx, flush: () => Promise.all(pending.splice(0)) }
}

const touchesAnalytics = (sql: string) => /FROM (pageviews|custom_events)/i.test(sql)

test('verified bots get no filtered render and cost no queries', async () => {
  const seen: string[] = []
  const res = await app.request(get(`/public/${SITE_ID}?range=30d&country=US`, CHROME, { verifiedBotCategory: 'AI Crawler' }), undefined, recordingEnv(seen))
  assert.equal(res.status, 403)
  assert.deepEqual(seen, [], 'no statement may run for a blocked crawler')
})

test('self-identified crawlers get no filtered render', async () => {
  const seen: string[] = []
  const res = await app.request(get(`/public/${SITE_ID}?range=30d&page=%2Fdemo&browser=Chrome`, BINGBOT), undefined, recordingEnv(seen))
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.deepEqual(seen, [])
})

test('crawlers can still see the unfiltered dashboard', async () => {
  const seen: string[] = []
  const res = await app.request(get(`/public/${SITE_ID}?range=30d`, BINGBOT), undefined, recordingEnv(seen))
  assert.equal(res.status, 200)
})

test('a phone model containing "bot" is not mistaken for a crawler', async () => {
  const seen: string[] = []
  const cubot = 'Mozilla/5.0 (Linux; Android 11; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
  const res = await app.request(get(`/public/${SITE_ID}?range=7d&country=US`, cubot), undefined, recordingEnv(seen))
  assert.equal(res.status, 200)
})

test('more than two filters redirects to the unfiltered view without querying', async () => {
  const seen: string[] = []
  const res = await app.request(get(`/public/${SITE_ID}?range=30d&country=US&device=Desktop&page=%2Ffor%2Fshopify`), undefined, recordingEnv(seen))
  assert.equal(res.status, 301)
  assert.equal(res.headers.get('location'), `/public/${SITE_ID}?range=30d`)
  assert.deepEqual(seen, [])
})

test('two filters render, and the page offers no link to a third', async () => {
  const seen: string[] = []
  const res = await app.request(get(`/public/${SITE_ID}?range=7d&country=US&browser=Chrome`), undefined, recordingEnv(seen))
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, />DE</, 'breakdown rows rendered — otherwise this test proves nothing')
  const hrefs = [...html.matchAll(/href="(\?[^"]*)"/g)].map(m => m[1].replace(/&amp;/g, '&'))
  const channelLinks = JSON.parse(html.match(/const channelLinks = (\[.*?\]);/)?.[1] ?? 'null')
  assert.deepEqual(channelLinks, [null], 'the channel chart must not offer a third filter either')
  for (const href of hrefs) {
    const n = ['page', 'referrer', 'country', 'browser', 'device', 'channel'].filter(k => new URLSearchParams(href).has(k)).length
    assert.ok(n <= 2, `link exceeds the filter cap: ${href}`)
  }
})

test('filter links are nofollow and the page is noindex', async () => {
  const seen: string[] = []
  const res = await app.request(get(`/public/${SITE_ID}?range=7d&country=US`), undefined, recordingEnv(seen))
  const html = await res.text()
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/)
  assert.match(html, /title="Remove filter"/)
  // Every same-page link is another URL variant to crawl: filters, chips, ranges.
  const variantLinks = [...html.matchAll(/<a href="\?[^"]*"[^>]*>/g)].map(m => m[0])
  assert.ok(variantLinks.length >= 5, `expected filter and range links, saw ${variantLinks.length}`)
  for (const a of variantLinks) assert.match(a, /rel="nofollow"/, `missing nofollow: ${a}`)
})

test('robots.txt disallows public dashboards', async () => {
  const res = await app.request('https://beam-privacy.com/robots.txt', {}, recordingEnv([]))
  const body = await res.text()
  assert.match(body, /^Disallow: \/public\/$/m)
  assert.match(body, /^Sitemap: /m)
})

test('a repeat render is served from the edge cache with no analytics queries', async (t) => {
  const { ctx, flush } = withEdgeCache(t)
  const first: string[] = []
  const r1 = await app.request(get(`/public/${SITE_ID}?range=7d&country=US`), undefined, recordingEnv(first), ctx)
  assert.equal(r1.headers.get('x-beam-cache'), 'MISS')
  const body1 = await r1.text()
  await flush()

  // Same view, parameters reordered — must share the key.
  const second: string[] = []
  const r2 = await app.request(get(`/public/${SITE_ID}?country=US&range=7d`), undefined, recordingEnv(second), ctx)
  assert.equal(r2.headers.get('x-beam-cache'), 'HIT')
  assert.equal(await r2.text(), body1)
  assert.deepEqual(second.filter(touchesAnalytics), [], 'a cache hit must not touch pageviews or custom_events')
})

test('a dashboard made private stops serving from cache immediately', async (t) => {
  const { ctx, flush } = withEdgeCache(t)
  await app.request(get(`/public/${SITE_ID}?range=7d`), undefined, recordingEnv([]), ctx)
  await flush()

  const res = await app.request(get(`/public/${SITE_ID}?range=7d`), undefined, recordingEnv([], { isPublic: 0 }), ctx)
  assert.equal(res.status, 404)
})

test('filtered variants share one set of custom_events queries', async (t) => {
  const { ctx, flush } = withEdgeCache(t)
  const seen: string[] = []
  for (const q of ['country=US', 'browser=Chrome', 'device=Desktop']) {
    await app.request(get(`/public/${SITE_ID}?range=30d&${q}`), undefined, recordingEnv(seen), ctx)
    await flush()
  }
  const eventQueries = seen.filter(sql => /FROM custom_events WHERE site_id = \? AND timestamp >= \? AND timestamp < \?( GROUP BY| \/\*)/.test(sql))
  assert.equal(eventQueries.length, 3, `expected one render's worth of event statements, saw ${eventQueries.length}`)
})
