import { Hono } from 'hono'
import { withSentry, honoIntegration, captureException, instrumentD1WithSentry } from '@sentry/cloudflare'
import { scrubEventPII } from './lib/sentry'
import { landingPage } from './landing'
import { auth } from './routes/auth'
import { tracking } from './routes/tracking'
import { collect } from './routes/collect'
import { dashboard } from './routes/dashboard'
import { billing } from './routes/billing'
import { vs } from './routes/vs'
import { about } from './routes/about'
import { publicDash } from './routes/public'
import { blog } from './routes/blog'
import { legal } from './routes/legal'
import { changelog } from './routes/changelog'
import { digest } from './routes/digest'
import { demo } from './routes/demo'
import { api } from './routes/api'
import { forPages } from './routes/for'
import { wordpressPlugin } from './routes/wordpressPlugin'
import { migrate } from './routes/migrate'
import { tools } from './routes/tools'
import { og } from './routes/og'
import { howItWorks } from './routes/howItWorks'
import { launch } from './routes/launch'
import { authMiddleware } from './middleware/authMiddleware'
import { firstTouchAttributionMiddleware } from './middleware/attribution'
import { handleScheduled } from './scheduled'
import { getPublicBaseUrl, publicUrl } from './lib/publicUrl'
import type { Env, AuthUser } from './types'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

// Sentry error handler — captures unhandled exceptions from Hono routes
app.onError((err, c) => {
  captureException(err, { data: { method: c.req.method, path: c.req.path } })
  return c.text('Internal Server Error', 500)
})

// 301 redirect from legacy domain beam.keylightdigital.dev to beam-privacy.com
// In Cloudflare production all requests are https://; wrangler dev uses http://.
// Skip the redirect when running locally (http:) to keep tests and local dev usable.
app.use('*', async (c, next) => {
  const host = c.req.header('host') ?? ''
  const isHttps = c.req.url.startsWith('https://')
  if (isHttps && (host === 'beam.keylightdigital.dev' || host === 'www.beam.keylightdigital.dev')) {
    const url = new URL(c.req.url)
    url.host = 'beam-privacy.com'
    return c.redirect(url.toString(), 301)
  }
  await next()
})

// Capture first-touch attribution on public HTML routes and persist in a cookie.
app.use('*', firstTouchAttributionMiddleware)

// Landing page
app.get('/', async (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  let totalPageviews: number | undefined
  try {
    const cacheKey = 'platform:total_pageviews'
    const cached = await c.env.KV.get(cacheKey)
    if (cached !== null) {
      totalPageviews = parseInt(cached, 10)
    } else {
      const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM pageviews').first<{ count: number }>()
      totalPageviews = result?.count ?? 0
      await c.env.KV.put(cacheKey, String(totalPageviews), { expirationTtl: 3600 })
    }
  } catch {
    // silently fail — render page without counter
  }
  return c.html(landingPage(baseUrl, c.env.GOOGLE_SITE_VERIFICATION, totalPageviews, c.env.BEAM_SELF_SITE_ID))
})

// Google Search Console HTML verification file (served when GOOGLE_SITE_VERIFICATION env var is set)
app.get('/google:code{[a-f0-9]+}.html', (c) => {
  const code = c.env.GOOGLE_SITE_VERIFICATION
  if (!code) return c.notFound()
  const requestedCode = c.req.param('code')
  if (requestedCode !== code) return c.notFound()
  return new Response(`google-site-verification: ${code}`, {
    headers: { 'Content-Type': 'text/html' },
  })
})

// Favicon — indigo bar chart representing analytics
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#4f46e5"/>
  <rect x="5" y="18" width="5" height="9" rx="1.5" fill="#c7d2fe"/>
  <rect x="13.5" y="12" width="5" height="15" rx="1.5" fill="#a5b4fc"/>
  <rect x="22" y="6" width="5" height="21" rx="1.5" fill="#fff"/>
</svg>`

app.get('/favicon.svg', () => {
  return new Response(FAVICON_SVG, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800' },
  })
})

app.get('/favicon.ico', (c) => {
  return c.redirect('/favicon.svg', 301)
})

// OG image (branded SVG placeholder)
app.get('/og-image.svg', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#4f46e5"/>
  <text x="600" y="260" font-family="system-ui,sans-serif" font-size="96" font-weight="bold" fill="white" text-anchor="middle">Beam</text>
  <text x="600" y="360" font-family="system-ui,sans-serif" font-size="36" fill="#c7d2fe" text-anchor="middle">Privacy-first web analytics</text>
  <text x="600" y="430" font-family="system-ui,sans-serif" font-size="28" fill="#a5b4fc" text-anchor="middle">No cookies · No consent banners · GDPR compliant</text>
</svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } })
})

// IndexNow key file (for Bing/Yandex search engine submission)
const INDEX_NOW_KEY = '191276d6368947c3b5c4c043a96ec5ed'
app.get(`/${INDEX_NOW_KEY}.txt`, () =>
  new Response(INDEX_NOW_KEY, { headers: { 'Content-Type': 'text/plain' } })
)

// SEO
app.get('/robots.txt', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${publicUrl(baseUrl, '/sitemap.xml')}`)
})

// IndexNow key verification file — served at /{key}.txt for Bing/Yandex crawlers
app.get('/:key{[0-9a-f]{32,64}\\.txt}', (c) => {
  const key = c.env.INDEXNOW_KEY
  const reqKey = c.req.param('key').replace('.txt', '')
  if (!key || reqKey !== key) return c.notFound()
  return new Response(key, { headers: { 'Content-Type': 'text/plain' } })
})
app.get('/sitemap.xml', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const paths = [
    '/',
    '/alternatives',
    '/vs/google-analytics',
    '/vs/vercel-analytics',
    '/vs/cloudflare-web-analytics',
    '/vs/plausible',
    '/vs/fathom',
    '/vs/umami',
    '/vs/matomo',
    '/vs/simple-analytics',
    '/vs/rybbit',
    '/signup',
    '/login',
    '/about',
    '/how-it-works',
    '/privacy',
    '/terms',
    '/blog',
    '/blog/cookie-free-analytics-guide',
    '/blog/add-analytics-in-5-minutes',
    '/blog/nextjs-privacy-analytics',
    '/blog/google-analytics-alternatives-2026',
    '/blog/beam-analytics-shutdown-migration-guide',
    '/blog/plausible-alternative',
    '/changelog',
    '/demo',
    '/migrate',
    '/migrate/google-analytics',
    '/migrate/plausible',
    '/migrate/fathom',
    '/migrate/import-history',
    '/migrate/beam-analytics',
    '/beam-analytics-alternative',
    '/docs/api',
    '/for',
    '/wordpress-plugin',
    '/for/nextjs',
    '/for/wordpress',
    '/for/astro',
    '/for/hugo',
    '/for/remix',
    '/for/webflow',
    '/for/shopify',
    '/for/ghost',
    '/for/framer',
    '/for/carrd',
    '/tools/stack-scanner',
    '/switch',
  ] as const

  const meta: Record<string, { changefreq: string; priority: string }> = {
    '/': { changefreq: 'monthly', priority: '1.0' },
    '/alternatives': { changefreq: 'weekly', priority: '0.9' },
    '/vs/google-analytics': { changefreq: 'monthly', priority: '0.8' },
    '/vs/vercel-analytics': { changefreq: 'monthly', priority: '0.8' },
    '/vs/cloudflare-web-analytics': { changefreq: 'monthly', priority: '0.8' },
    '/vs/plausible': { changefreq: 'monthly', priority: '0.8' },
    '/vs/fathom': { changefreq: 'monthly', priority: '0.8' },
    '/vs/umami': { changefreq: 'monthly', priority: '0.8' },
    '/vs/matomo': { changefreq: 'monthly', priority: '0.8' },
    '/vs/simple-analytics': { changefreq: 'monthly', priority: '0.8' },
    '/vs/rybbit': { changefreq: 'monthly', priority: '0.8' },
    '/signup': { changefreq: 'yearly', priority: '0.7' },
    '/login': { changefreq: 'yearly', priority: '0.5' },
    '/about': { changefreq: 'monthly', priority: '0.6' },
    '/how-it-works': { changefreq: 'monthly', priority: '0.8' },
    '/privacy': { changefreq: 'yearly', priority: '0.5' },
    '/terms': { changefreq: 'yearly', priority: '0.5' },
    '/blog': { changefreq: 'weekly', priority: '0.7' },
    '/blog/cookie-free-analytics-guide': { changefreq: 'monthly', priority: '0.7' },
    '/blog/add-analytics-in-5-minutes': { changefreq: 'monthly', priority: '0.7' },
    '/blog/nextjs-privacy-analytics': { changefreq: 'monthly', priority: '0.7' },
    '/blog/google-analytics-alternatives-2026': { changefreq: 'monthly', priority: '0.8' },
    '/blog/beam-analytics-shutdown-migration-guide': { changefreq: 'weekly', priority: '0.9' },
    '/blog/plausible-alternative': { changefreq: 'monthly', priority: '0.8' },
    '/changelog': { changefreq: 'weekly', priority: '0.6' },
    '/demo': { changefreq: 'weekly', priority: '0.7' },
    '/migrate': { changefreq: 'weekly', priority: '0.8' },
    '/migrate/google-analytics': { changefreq: 'weekly', priority: '0.8' },
    '/migrate/plausible': { changefreq: 'weekly', priority: '0.8' },
    '/migrate/fathom': { changefreq: 'weekly', priority: '0.8' },
    '/migrate/import-history': { changefreq: 'monthly', priority: '0.8' },
    '/migrate/beam-analytics': { changefreq: 'weekly', priority: '0.9' },
    '/beam-analytics-alternative': { changefreq: 'weekly', priority: '0.8' },
    '/docs/api': { changefreq: 'monthly', priority: '0.6' },
    '/for': { changefreq: 'weekly', priority: '0.8' },
    '/wordpress-plugin': { changefreq: 'weekly', priority: '0.8' },
    '/for/nextjs': { changefreq: 'monthly', priority: '0.8' },
    '/for/wordpress': { changefreq: 'monthly', priority: '0.8' },
    '/for/astro': { changefreq: 'monthly', priority: '0.8' },
    '/for/hugo': { changefreq: 'monthly', priority: '0.8' },
    '/for/remix': { changefreq: 'monthly', priority: '0.8' },
    '/for/webflow': { changefreq: 'monthly', priority: '0.8' },
    '/for/shopify': { changefreq: 'monthly', priority: '0.8' },
    '/for/ghost': { changefreq: 'monthly', priority: '0.8' },
    '/for/framer': { changefreq: 'monthly', priority: '0.8' },
    '/for/carrd': { changefreq: 'monthly', priority: '0.8' },
    '/tools/stack-scanner': { changefreq: 'weekly', priority: '0.8' },
    '/switch': { changefreq: 'monthly', priority: '0.8' },
  }

  const urls = paths
    .map((path) => {
      const entry = meta[path]!
      return `  <url>
    <loc>${publicUrl(baseUrl, path)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
})

// Auth routes (signup/login pages + API endpoints)
app.route('/', auth)

// Tracking script
app.route('/', tracking)

// Data collection endpoint
app.route('/', collect)

// Dashboard — protected by auth middleware
app.use('/dashboard/*', authMiddleware)
app.route('/', dashboard)
app.route('/', billing)
app.route('/', vs)
app.route('/', about)
app.route('/', blog)
app.route('/', legal)
app.route('/', changelog)
app.route('/', demo)
app.route('/', api)
app.route('/', forPages)
app.route('/', wordpressPlugin)
app.route('/', migrate)
app.route('/', tools)
app.route('/', og)
app.route('/', howItWorks)
app.route('/', launch)

// Public shareable dashboards (no auth required)
app.route('/', publicDash)

// Digest unsubscribe (public, token-authenticated)
app.route('/', digest)

// Instrument D1 with Sentry for query tracing (no-op if Sentry is disabled)
app.use('*', async (c, next) => {
  c.env.DB = instrumentD1WithSentry(c.env.DB)
  await next()
})

// Named export for unit tests (Hono app with .request() method)
export { app }

// Cloudflare Workers handler — wrap with Sentry if SENTRY_DSN is configured
export default withSentry(
  (env: Env) => {
    if (!env.SENTRY_DSN) return undefined
    return {
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT ?? 'development',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      integrations: [honoIntegration()],
      beforeSend: scrubEventPII,
    }
  },
  {
    fetch: app.fetch.bind(app),
    scheduled: async (controller: ScheduledController, env: Env) => {
      await handleScheduled(env, controller.cron)
    },
  } satisfies ExportedHandler<Env>
)
