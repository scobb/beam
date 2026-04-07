import { Hono } from 'hono'
import type { Env } from '../types'
import { maybeSendFirstActivityAlert, type ActivationAlertUserContext } from '../lib/activationAlerts'

const app = new Hono<{ Bindings: Env }>()

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ---------------------------------------------------------------------------
// Abuse-resistant controls (module-level, per-isolate)
// ---------------------------------------------------------------------------

// Per-IP rate limiter — in-memory, zero KV writes, per-isolate (lossy but free).
// Each Cloudflare isolate maintains its own counter independently.
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 100

// Global daily cap — in-memory, per-isolate.
// Once globalCapExceeded is true, all subsequent requests return 503 with
// zero KV/D1 operations.
let globalIsolateDayKey = ''
let globalIsolateCount = 0
let globalIsolateCapExceeded = false
const GLOBAL_DAILY_CAP_PER_ISOLATE = 500_000

// Free-user daily pageview cap (cost protection, not plan enforcement).
// Monthly cap (50K) handles plan enforcement; daily cap prevents a single-day burst.
const FREE_DAILY_CAP = 5000

function getUtcDayKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Zero KV writes. Prunes stale entries with 1% probability to bound memory.
 */
function checkIpRateLimit(ip: string): boolean {
  const now = Date.now()
  // Occasionally prune stale entries to prevent unbounded memory growth
  if (Math.random() < 0.01) {
    for (const [k, v] of ipRateLimitMap) {
      if (now >= v.resetAt) ipRateLimitMap.delete(k)
    }
  }
  const entry = ipRateLimitMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

/**
 * Returns true if within global daily cap.
 * Once cap is exceeded, returns false with zero KV/D1 ops for all remaining
 * requests in this isolate's lifetime (until next UTC day).
 */
function checkGlobalDailyCap(): boolean {
  const dayKey = getUtcDayKey()
  if (dayKey !== globalIsolateDayKey) {
    // New UTC day — reset counters
    globalIsolateDayKey = dayKey
    globalIsolateCount = 0
    globalIsolateCapExceeded = false
  }
  if (globalIsolateCapExceeded) return false
  globalIsolateCount++
  if (globalIsolateCount >= GLOBAL_DAILY_CAP_PER_ISOLATE) {
    globalIsolateCapExceeded = true
  }
  return true
}

/**
 * Extract the bare hostname from an Origin or Referer header value.
 * Strips www. prefix and lowercases.
 */
function extractOriginDomain(headerValue: string): string | null {
  try {
    return new URL(headerValue).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------

// Parse User-Agent to determine browser and device_type
function parseUserAgent(ua: string): { browser: string; device_type: string } {
  const uaLower = ua.toLowerCase()

  let browser = 'Other'
  if (uaLower.includes('edg/') || uaLower.includes('edge/')) {
    browser = 'Edge'
  } else if (uaLower.includes('chrome/') && !uaLower.includes('chromium')) {
    browser = 'Chrome'
  } else if (uaLower.includes('firefox/')) {
    browser = 'Firefox'
  } else if (uaLower.includes('safari/') && !uaLower.includes('chrome')) {
    browser = 'Safari'
  }

  let device_type = 'Desktop'
  if (uaLower.includes('tablet') || uaLower.includes('ipad')) {
    device_type = 'Tablet'
  } else if (
    uaLower.includes('mobile') ||
    uaLower.includes('android') ||
    uaLower.includes('iphone') ||
    uaLower.includes('ipod')
  ) {
    device_type = 'Mobile'
  }

  return { browser, device_type }
}

function sanitizeEventProperties(input: unknown): Record<string, string | number | boolean | null> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  const entries = Object.entries(input as Record<string, unknown>).slice(0, 20)
  const sanitized: Record<string, string | number | boolean | null> = {}

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().slice(0, 40)
    if (!key) continue

    if (
      rawValue === null ||
      typeof rawValue === 'boolean' ||
      typeof rawValue === 'number'
    ) {
      sanitized[key] = rawValue
      continue
    }

    if (typeof rawValue === 'string') {
      sanitized[key] = rawValue.slice(0, 200)
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

// Preflight
app.options('/api/collect', (c) => {
  return new Response(null, { status: 204, headers: corsHeaders })
})

app.post('/api/collect', async (c) => {
  // --- Fast pre-checks (zero I/O) ---

  // Reject payloads larger than 4KB
  const contentLength = parseInt(c.req.header('content-length') ?? '0', 10)
  if (contentLength > 4096) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Global daily cap (in-memory, zero KV/D1 once exceeded)
  if (!checkGlobalDailyCap()) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Per-IP rate limit (in-memory, zero KV writes)
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
  if (!checkIpRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Parse body ---
  let body: Record<string, unknown>
  try {
    const text = await c.req.text()
    if (text.length > 4096) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    body = JSON.parse(text)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { type, site_id, path, referrer, screen_width, language, timezone, utm_source, utm_medium, utm_campaign, event_name, properties } = body as {
    type?: string
    site_id?: string
    path?: string
    referrer?: string
    screen_width?: number
    language?: string
    timezone?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    event_name?: string
    properties?: unknown
  }

  if (!site_id) {
    return new Response(JSON.stringify({ error: 'site_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- D1: validate site and fetch owner plan ---
  const site = await c.env.DB.prepare(
    `SELECT
      s.id,
      s.name,
      s.domain,
      u.id as user_id,
      u.email,
      u.plan,
      COALESCE(u.first_touch_is_internal, 0) as first_touch_is_internal,
      u.first_touch_ref,
      u.first_touch_utm_source,
      u.first_touch_utm_medium,
      u.first_touch_utm_campaign,
      u.first_site_id,
      u.first_activity_alert_sent_at
    FROM sites s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?`
  ).bind(site_id).first<{
    id: string
    name: string
    domain: string
    user_id: string
    email: string
    plan: string
    first_touch_is_internal: number
    first_touch_ref: string | null
    first_touch_utm_source: string | null
    first_touch_utm_medium: string | null
    first_touch_utm_campaign: string | null
    first_site_id: string | null
    first_activity_alert_sent_at: string | null
  }>()
  if (!site) {
    return new Response(JSON.stringify({ error: 'Unknown site_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Origin/Referer validation ---
  // Protects against cross-site abuse where a third party sends fake pageviews
  // to someone else's site_id. Privacy browsers that strip Origin/Referer are
  // allowed through (empty header = legitimate privacy tool).
  const originHeader = c.req.header('origin') ?? c.req.header('referer') ?? ''
  if (originHeader) {
    const originDomain = extractOriginDomain(originHeader)
    if (originDomain && originDomain !== 'localhost' && originDomain !== '127.0.0.1') {
      const registeredDomain = (site.domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0] ?? '')
        .split(':')[0] ?? ''
      // Allow exact match or subdomain match (e.g., blog.example.com for example.com)
      if (originDomain !== registeredDomain && !originDomain.endsWith('.' + registeredDomain)) {
        return new Response(JSON.stringify({ error: 'Origin domain does not match registered site' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const isEvent = type === 'event'
  const timestamp = new Date().toISOString()

  // --- Free-user daily pageview cap (cost protection) ---
  // Runs before monthly check to short-circuit earlier on burst abuse.
  // Only applies to pageviews (not custom events) on free plans.
  if (!isEvent && site.plan !== 'pro') {
    const today = getUtcDayKey()
    const dailyCapKey = `dailyCap:${site.user_id}:${today}`
    const cachedDaily = await c.env.KV.get(dailyCapKey)

    if (cachedDaily !== null) {
      if (parseInt(cachedDaily, 10) >= FREE_DAILY_CAP) {
        return new Response(JSON.stringify({ error: 'Daily pageview limit reached. Upgrade to Pro for higher limits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Cache cold — query D1 for today's count. Cache result for 5 minutes to
      // avoid a D1 query on every request (read-then-write: only write on cache miss).
      const nowDate = new Date()
      const todayStartStr = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())).toISOString()
      const todayEndStr = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() + 1)).toISOString()
      const userSitesForCap = await c.env.DB.prepare('SELECT id FROM sites WHERE user_id = ?').bind(site.user_id).all<{ id: string }>()
      const capSiteIds = (userSitesForCap.results ?? []).map(s => s.id)
      let dailyCount = 0
      if (capSiteIds.length > 0) {
        const capPlaceholders = capSiteIds.map(() => '?').join(',')
        const capRes = await c.env.DB.prepare(
          `SELECT COUNT(*) as count FROM pageviews WHERE site_id IN (${capPlaceholders}) AND timestamp >= ? AND timestamp < ?`
        ).bind(...capSiteIds, todayStartStr, todayEndStr).first<{ count: number }>()
        dailyCount = capRes?.count ?? 0
      }
      // Write-once KV entry with 5-minute TTL (only written on cache miss, not every request)
      await c.env.KV.put(dailyCapKey, String(dailyCount), { expirationTtl: 300 })
      if (dailyCount >= FREE_DAILY_CAP) {
        return new Response(JSON.stringify({ error: 'Daily pageview limit reached. Upgrade to Pro for higher limits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  if (!isEvent) {
    // Monthly pageview limit (cached in KV to avoid D1 on every request)
    const pvLimit = site.plan === 'pro' ? 500000 : 50000
    const nowDate = new Date()
    const pvMonthKey = `${nowDate.getUTCFullYear()}-${String(nowDate.getUTCMonth() + 1).padStart(2, '0')}`
    const pvCacheKey = `monthlyUsage:${site.user_id}:${pvMonthKey}`
    const cachedCount = await c.env.KV.get(pvCacheKey)
    let monthlyCount: number
    if (cachedCount !== null) {
      monthlyCount = parseInt(cachedCount, 10)
    } else {
      const pvMonthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString()
      const pvMonthEnd = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 1)).toISOString()
      const userSites = await c.env.DB.prepare('SELECT id FROM sites WHERE user_id = ?').bind(site.user_id).all<{ id: string }>()
      const siteIds = (userSites.results ?? []).map(s => s.id)
      if (siteIds.length > 0) {
        const placeholders = siteIds.map(() => '?').join(',')
        const countRes = await c.env.DB.prepare(
          `SELECT COUNT(*) as count FROM pageviews WHERE site_id IN (${placeholders}) AND timestamp >= ? AND timestamp < ?`
        ).bind(...siteIds, pvMonthStart, pvMonthEnd).first<{ count: number }>()
        monthlyCount = countRes?.count ?? 0
      } else {
        monthlyCount = 0
      }
      await c.env.KV.put(pvCacheKey, String(monthlyCount), { expirationTtl: 60 })
    }

    if (monthlyCount >= pvLimit) {
      return new Response(JSON.stringify({ error: 'Monthly pageview limit exceeded. Upgrade your plan to continue collecting data.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Extract country from Cloudflare header
  const country = c.req.header('cf-ipcountry') ?? 'XX'

  // Parse User-Agent
  const ua = c.req.header('user-agent') ?? ''
  const { browser, device_type } = parseUserAgent(ua)

  if (isEvent) {
    const trimmedEventName = (event_name ?? '').trim().slice(0, 64)
    if (!trimmedEventName) {
      return new Response(JSON.stringify({ error: 'event_name is required for event payloads' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (site.plan !== 'pro') {
      const existingEvent = await c.env.DB.prepare(
        'SELECT 1 FROM custom_events WHERE site_id = ? AND event_name = ? LIMIT 1'
      ).bind(site_id, trimmedEventName).first<{ '1': number }>()

      if (!existingEvent) {
        const uniqueCount = await c.env.DB.prepare(
          'SELECT COUNT(DISTINCT event_name) as count FROM custom_events WHERE site_id = ?'
        ).bind(site_id).first<{ count: number }>()

        if ((uniqueCount?.count ?? 0) >= 5) {
          return new Response(JSON.stringify({ error: 'Free plans can track up to 5 unique event names per site. Upgrade to Pro for unlimited events.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    const sanitizedProperties = sanitizeEventProperties(properties)
    await c.env.DB.prepare(
      `INSERT INTO custom_events (site_id, event_name, properties, path, referrer, country, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        site_id,
        trimmedEventName,
        sanitizedProperties ? JSON.stringify(sanitizedProperties) : null,
        (path ?? '/').slice(0, 2048),
        (referrer ?? '').slice(0, 2048),
        country,
        timestamp
      )
      .run()

    const alertUser: ActivationAlertUserContext = {
      userId: site.user_id,
      email: site.email,
      firstTouchIsInternal: site.first_touch_is_internal,
      firstTouchRef: site.first_touch_ref,
      firstTouchUtmSource: site.first_touch_utm_source,
      firstTouchUtmMedium: site.first_touch_utm_medium,
      firstTouchUtmCampaign: site.first_touch_utm_campaign,
      firstSiteId: site.first_site_id,
      firstActivityAlertSentAt: site.first_activity_alert_sent_at,
    }
    c.executionCtx.waitUntil(
      maybeSendFirstActivityAlert(c.env, {
        user: alertUser,
        siteId: site.id,
        siteName: site.name,
        siteDomain: site.domain,
        occurredAt: timestamp,
        activityType: 'custom_event',
        eventName: trimmedEventName,
      })
    )
  } else {
    await c.env.DB.prepare(
      `INSERT INTO pageviews (site_id, path, referrer, country, device_type, browser, screen_width, language, timestamp, utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        site_id,
        (path ?? '/').slice(0, 2048),
        (referrer ?? '').slice(0, 2048),
        country,
        device_type,
        browser,
        typeof screen_width === 'number' ? Math.min(Math.max(0, Math.floor(screen_width)), 9999) : null,
        (language ?? '').slice(0, 20),
        timestamp,
        utm_source ? String(utm_source).slice(0, 200) : null,
        utm_medium ? String(utm_medium).slice(0, 200) : null,
        utm_campaign ? String(utm_campaign).slice(0, 200) : null
      )
      .run()

    // Active-visitor KV entry (5-minute TTL for real-time counter).
    // Read-then-write pattern: only write if the key does not already exist.
    // Reduces KV writes from 1/pageview to 1 per unique visitor per 5-min window.
    const visitorHash = `${country}_${browser}_${screen_width ?? 0}_${(language ?? '').slice(0, 10)}`
    const activeKey = `active:${site_id}:${visitorHash}`
    const existingActive = await c.env.KV.get(activeKey)
    if (!existingActive) {
      await c.env.KV.put(activeKey, '1', { expirationTtl: 300 })
    }

    const alertUser: ActivationAlertUserContext = {
      userId: site.user_id,
      email: site.email,
      firstTouchIsInternal: site.first_touch_is_internal,
      firstTouchRef: site.first_touch_ref,
      firstTouchUtmSource: site.first_touch_utm_source,
      firstTouchUtmMedium: site.first_touch_utm_medium,
      firstTouchUtmCampaign: site.first_touch_utm_campaign,
      firstSiteId: site.first_site_id,
      firstActivityAlertSentAt: site.first_activity_alert_sent_at,
    }
    c.executionCtx.waitUntil(
      maybeSendFirstActivityAlert(c.env, {
        user: alertUser,
        siteId: site.id,
        siteName: site.name,
        siteDomain: site.domain,
        occurredAt: timestamp,
        activityType: 'pageview',
      })
    )
  }

  return new Response(null, { status: 204, headers: corsHeaders })
})

export { app as collect }
