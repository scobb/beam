import { Hono, type Context } from 'hono'
import { buildAnalyticsWindow } from '../lib/analytics'
import { buildTrafficChannelSql, type TrafficChannel } from '../lib/channels'
import { hashApiKey } from '../lib/apiKeys'
import { displayReferrerSource } from '../lib/goals'
import { getPublicBaseUrl } from '../lib/publicUrl'
import type { Env } from '../types'

const api = new Hono<{ Bindings: Env }>()
const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

type ApiAuth = {
  userId: string
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  })
}

function readBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  const scheme = parts[0] ?? ''
  const token = parts[1] ?? ''
  if (scheme.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

async function authenticateApiRequest(c: Context<{ Bindings: Env }>): Promise<ApiAuth | Response> {
  const token = readBearerToken(c.req.header('authorization'))
  if (!token) {
    return jsonError('Missing API key. Use Authorization: Bearer <api_key>.', 401)
  }
  if (token.length < 32 || token.length > 256) {
    return jsonError('Invalid API key.', 401)
  }

  const keyHash = await hashApiKey(token)
  const user = await c.env.DB.prepare(
    'SELECT id, plan FROM users WHERE api_key = ?'
  ).bind(keyHash).first<{ id: string; plan: string }>()

  if (!user) {
    return jsonError('Invalid API key.', 401)
  }

  if (user.plan !== 'pro') {
    return jsonError('API access is a Pro feature. Upgrade at /dashboard/billing.', 403)
  }

  const rlKey = `api-rl:${keyHash}`
  const currentRaw = await c.env.KV.get(rlKey)
  const current = currentRaw ? parseInt(currentRaw, 10) : 0
  if (current >= 60) {
    return jsonError('Rate limit exceeded. Maximum 60 requests per minute per API key.', 429)
  }
  await c.env.KV.put(rlKey, String(current + 1), { expirationTtl: 60 })

  return { userId: user.id }
}

api.get('/docs/api', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beam Stats API Docs</title>
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/docs/api" />
  <meta name="description" content="Beam Stats API reference. Query pageviews, events, and site data programmatically with a Bearer API key." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-gray-50 min-h-screen text-gray-900">
  <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10">
    <a href="/" class="text-indigo-600 font-semibold hover:underline">Beam</a>
    <h1 class="text-3xl font-bold mt-3">Beam Stats API</h1>
    <p class="mt-3 text-gray-600">Programmatic analytics access for Pro accounts. Authenticate with a billing-generated API key using <code class="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;api_key&gt;</code>.</p>

    <section class="mt-8 bg-white border border-gray-200 rounded-xl p-5">
      <h2 class="text-lg font-semibold">Authentication</h2>
      <p class="text-sm text-gray-600 mt-2">Generate or revoke your key at <a href="/dashboard/billing" class="text-indigo-600 hover:underline">/dashboard/billing</a>. Keys are shown only once when generated.</p>
      <pre class="mt-3 text-sm bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto"><code>Authorization: Bearer beam_your_api_key_here</code></pre>
      <p class="text-xs text-gray-500 mt-2">Rate limit: 60 requests/minute per API key. Free accounts receive HTTP 403 with upgrade guidance.</p>
    </section>

    <section class="mt-6 bg-white border border-gray-200 rounded-xl p-5">
      <h2 class="text-lg font-semibold">GET /api/v1/sites</h2>
      <p class="text-sm text-gray-600 mt-2">Returns all sites owned by the authenticated user.</p>
      <pre class="mt-3 text-sm bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto"><code>curl -s ${baseUrl}/api/v1/sites \\
  -H "Authorization: Bearer beam_your_api_key_here"</code></pre>
      <pre class="mt-3 text-sm bg-gray-100 rounded-lg p-4 overflow-x-auto"><code>{
  "sites": [
    { "id": "site_123", "domain": "example.com", "name": "Example" }
  ]
}</code></pre>
    </section>

    <section class="mt-6 bg-white border border-gray-200 rounded-xl p-5">
      <h2 class="text-lg font-semibold">GET /api/v1/sites/:id/stats?range=7d|30d|today</h2>
      <p class="text-sm text-gray-600 mt-2">Returns summary metrics and top traffic breakdowns for a site in the selected UTC range.</p>
      <pre class="mt-3 text-sm bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto"><code>curl -s "${baseUrl}/api/v1/sites/site_123/stats?range=7d" \\
  -H "Authorization: Bearer beam_your_api_key_here"</code></pre>
      <pre class="mt-3 text-sm bg-gray-100 rounded-lg p-4 overflow-x-auto"><code>{
  "range": "7d",
  "pageviews": 842,
  "uniqueVisitors": 311,
  "topPages": [{ "path": "/", "visitors": 220, "pageviews": 415 }],
  "topReferrers": [{ "source": "google.com", "visitors": 137 }],
  "topCountries": [{ "country": "US", "visitors": 182 }],
  "channels": {
    "Search": { "visitors": 137, "pageviews": 241 },
    "Direct": { "visitors": 98, "pageviews": 190 }
  }
}</code></pre>
    </section>

    <section class="mt-6 bg-white border border-gray-200 rounded-xl p-5">
      <h2 class="text-lg font-semibold">GET /api/v1/sites/:id/events?range=7d|30d|today</h2>
      <p class="text-sm text-gray-600 mt-2">Returns custom event counts with property breakdowns.</p>
      <pre class="mt-3 text-sm bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto"><code>curl -s "${baseUrl}/api/v1/sites/site_123/events?range=7d" \\
  -H "Authorization: Bearer beam_your_api_key_here"</code></pre>
      <pre class="mt-3 text-sm bg-gray-100 rounded-lg p-4 overflow-x-auto"><code>{
  "range": "7d",
  "events": [
    {
      "name": "signup_click",
      "count": 24,
      "properties": {
        "plan": { "pro": 11, "free": 13 },
        "source": { "pricing": 20 }
      }
    }
  ]
}</code></pre>
    </section>

    <section class="mt-6 text-sm text-gray-500">
      <p>All ranges and buckets use UTC boundaries. Need API access? Upgrade to Pro at <a href="/dashboard/billing" class="text-indigo-600 hover:underline">/dashboard/billing</a>.</p>
    </section>
  </main>
  <script>
    (function () {
      let sent = false;
      const attempt = function () {
        if (sent) return;
        if (!window.beam || typeof window.beam.track !== 'function') return;
        window.beam.track('docs_view', { page: 'docs_api' });
        sent = true;
      };
      attempt();
      if (sent) return;
      setTimeout(attempt, 120);
      setTimeout(attempt, 350);
      setTimeout(attempt, 700);
    })();
  </script>
</body>
</html>`

  return c.html(html)
})

api.get('/api/v1/sites', async (c) => {
  const auth = await authenticateApiRequest(c)
  if (auth instanceof Response) return auth

  const sites = await c.env.DB.prepare(
    'SELECT id, domain, name FROM sites WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(auth.userId).all<{ id: string; domain: string; name: string }>()

  return c.json({ sites: sites.results ?? [] })
})

api.get('/api/v1/sites/:id/stats', async (c) => {
  const auth = await authenticateApiRequest(c)
  if (auth instanceof Response) return auth

  const siteId = c.req.param('id')
  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, auth.userId).first<{ id: string }>()

  if (!site) {
    return jsonError('Site not found.', 404)
  }

  const window = buildAnalyticsWindow(new Date(), c.req.query('range'))
  const uvExpr = `strftime('%Y-%m-%d', timestamp) || '|' || COALESCE(path, '') || '|' || COALESCE(country, '') || '|' || COALESCE(browser, '') || '|' || CAST(COALESCE(screen_width, 0) AS TEXT)`
  const channelExpr = buildTrafficChannelSql()

  const batchRes = await c.env.DB.batch([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?')
      .bind(siteId, window.startISO, window.endISO),
    c.env.DB.prepare(`SELECT COUNT(DISTINCT ${uvExpr}) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`)
      .bind(siteId, window.startISO, window.endISO),
    c.env.DB.prepare(`SELECT path, COUNT(DISTINCT ${uvExpr}) as visitors, COUNT(*) as pageviews FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY path ORDER BY pageviews DESC LIMIT 20`)
      .bind(siteId, window.startISO, window.endISO),
    c.env.DB.prepare(`SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END as source, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY source ORDER BY visitors DESC LIMIT 20`)
      .bind(siteId, window.startISO, window.endISO),
    c.env.DB.prepare(`SELECT COALESCE(country, 'Unknown') as country, COUNT(DISTINCT ${uvExpr}) as visitors FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY country ORDER BY visitors DESC LIMIT 20`)
      .bind(siteId, window.startISO, window.endISO),
    c.env.DB.prepare(`SELECT ${channelExpr} as channel, COUNT(DISTINCT ${uvExpr}) as visitors, COUNT(*) as pageviews FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY channel ORDER BY visitors DESC`)
      .bind(siteId, window.startISO, window.endISO),
  ])

  const pageviews = (batchRes[0]?.results[0] as { count: number } | undefined)?.count ?? 0
  const uniqueVisitors = (batchRes[1]?.results[0] as { count: number } | undefined)?.count ?? 0
  const topPages = (batchRes[2]?.results ?? []) as { path: string; visitors: number; pageviews: number }[]
  const rawReferrers = (batchRes[3]?.results ?? []) as { source: string; visitors: number }[]
  const topReferrers = rawReferrers.map((row) => ({
    source: row.source === 'Direct' ? 'Direct' : displayReferrerSource(row.source),
    visitors: row.visitors,
  }))
  const topCountries = (batchRes[4]?.results ?? []) as { country: string; visitors: number }[]
  const channelRows = (batchRes[5]?.results ?? []) as { channel: TrafficChannel; visitors: number; pageviews: number }[]

  const channels: Record<string, { visitors: number; pageviews: number }> = {}
  for (const row of channelRows) {
    channels[row.channel] = { visitors: row.visitors, pageviews: row.pageviews }
  }

  return c.json({
    range: window.range,
    pageviews,
    uniqueVisitors,
    topPages,
    topReferrers,
    topCountries,
    channels,
  })
})

api.get('/api/v1/sites/:id/events', async (c) => {
  const auth = await authenticateApiRequest(c)
  if (auth instanceof Response) return auth

  const siteId = c.req.param('id')
  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ? AND user_id = ?'
  ).bind(siteId, auth.userId).first<{ id: string }>()

  if (!site) {
    return jsonError('Site not found.', 404)
  }

  const window = buildAnalyticsWindow(new Date(), c.req.query('range') ?? '7d')

  const batchRes = await c.env.DB.batch([
    c.env.DB.prepare(
      'SELECT event_name, COUNT(*) as count FROM custom_events WHERE site_id = ? AND timestamp >= ? AND timestamp < ? GROUP BY event_name ORDER BY count DESC, event_name ASC LIMIT 100'
    ).bind(siteId, window.startISO, window.endISO),
    c.env.DB.prepare(`
      SELECT ce.event_name as event_name, je.key as property_key, CAST(je.value AS TEXT) as property_value, COUNT(*) as count
      FROM custom_events ce, json_each(COALESCE(ce.properties, '{}')) je
      WHERE ce.site_id = ? AND ce.timestamp >= ? AND ce.timestamp < ?
      GROUP BY ce.event_name, je.key, property_value
      ORDER BY ce.event_name ASC, count DESC, je.key ASC, property_value ASC
      LIMIT 500
    `).bind(siteId, window.startISO, window.endISO),
  ])

  const eventRows = (batchRes[0]?.results ?? []) as { event_name: string; count: number }[]
  const propertyRows = (batchRes[1]?.results ?? []) as {
    event_name: string
    property_key: string
    property_value: string
    count: number
  }[]

  const propertiesByEvent: Record<string, Record<string, Record<string, number>>> = {}
  for (const row of propertyRows) {
    const eventProps = propertiesByEvent[row.event_name] ?? {}
    propertiesByEvent[row.event_name] = eventProps
    const valueCounts = eventProps[row.property_key] ?? {}
    eventProps[row.property_key] = valueCounts
    valueCounts[row.property_value] = row.count
  }

  const events = eventRows.map((row) => ({
    name: row.event_name,
    count: row.count,
    properties: propertiesByEvent[row.event_name] ?? {},
  }))

  return c.json({ range: window.range, events })
})

export { api }
