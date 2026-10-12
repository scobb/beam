/**
 * Guards for the unauthenticated public dashboard (`/public/:site_id`).
 *
 * Every filter link on that page is a new URL, and every URL runs the full
 * analytics batch. Crawlers walking those links (bingbot, PetalBot, DotBot and
 * unverified scrapers, observed 2026-10-12) drove D1 to 24.0B rows read in 32
 * days against 25B included — almost all of it renders of Beam's own public
 * dashboard. These helpers stop that before any query runs.
 */

export const PUBLIC_FILTER_KEYS = ['page', 'referrer', 'country', 'browser', 'device', 'channel'] as const

/**
 * Humans add filters one click at a time; crawler URLs stacked three to five.
 * Capping at two keeps the combination space bounded.
 */
export const MAX_PUBLIC_FILTERS = 2

/** How long a rendered public dashboard and its event queries are reused. */
export const PUBLIC_DASH_CACHE_TTL_SECONDS = 300

// `bot` must be followed by `/ ; ) -` so phone models like "Cubot X30" pass.
const CRAWLER_UA = /bot[\/;)\-]|\bbot\b|crawl|spider|slurp|scrap|bingpreview|facebookexternalhit|bytespider|headless|python-requests|python-urllib|curl\/|wget\/|go-http-client|okhttp|java\//i

export function activePublicFilters(query: (key: string) => string | undefined): string[] {
  return PUBLIC_FILTER_KEYS.filter(key => query(key) !== undefined)
}

/** Cloudflare-verified bots, plus anything that self-identifies as one. */
export function isCrawlerRequest(req: Request): boolean {
  const cf = (req as Request & { cf?: { verifiedBotCategory?: string } }).cf
  if (cf?.verifiedBotCategory) return true
  return CRAWLER_UA.test(req.headers.get('user-agent') ?? '')
}

/**
 * Cache key for a rendered dashboard: only the parameters the page reads, in a
 * fixed order, so `?country=US&range=7d` and `?range=7d&country=US` share it.
 */
export function publicDashCacheKey(origin: string, siteId: string, range: string, query: (key: string) => string | undefined): string {
  const params = new URLSearchParams({ range })
  for (const key of PUBLIC_FILTER_KEYS) {
    const value = query(key)
    if (value !== undefined) params.set(key, value)
  }
  return `${origin}/public/${encodeURIComponent(siteId)}?${params.toString()}`
}

function edgeCache(): Cache | null {
  // `caches.default` exists only in the Workers runtime; tests run without it.
  const store = (globalThis as { caches?: { default?: Cache } }).caches
  return store?.default ?? null
}

export async function readCachedResponse(key: string): Promise<Response | null> {
  const cache = edgeCache()
  if (!cache) return null
  return (await cache.match(key)) ?? null
}

/**
 * Stores a copy built from scratch, so headers added by middleware (notably
 * Set-Cookie from first-touch attribution) never enter the shared cache.
 */
export function cacheableCopy(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${PUBLIC_DASH_CACHE_TTL_SECONDS}`,
    },
  })
}

export async function writeCachedResponse(key: string, res: Response): Promise<void> {
  const cache = edgeCache()
  if (!cache) return
  await cache.put(key, res)
}

/** Memoises a JSON-serialisable result in the edge cache for the dashboard TTL. */
export async function cachedJson<T>(key: string, compute: () => Promise<T>, defer: (p: Promise<unknown>) => void): Promise<T> {
  const hit = await readCachedResponse(key)
  if (hit) return (await hit.json()) as T
  const value = await compute()
  if (edgeCache()) defer(writeCachedResponse(key, cacheableCopy(JSON.stringify(value), 'application/json')))
  return value
}
