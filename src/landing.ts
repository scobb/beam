import { DEFAULT_PUBLIC_BASE_URL, publicHost, publicUrl } from './lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

export function landingPage(
  publicBaseUrlOrGoogleVerificationCode?: string,
  googleVerificationCodeOrTotalPageviews?: string | number,
  totalPageviewsOrSelfSiteId?: number | string,
  selfSiteIdMaybe?: string
): string {
  const hasBaseUrlFirstArg = typeof publicBaseUrlOrGoogleVerificationCode === 'string'
    && /^https?:\/\//i.test(publicBaseUrlOrGoogleVerificationCode)
  const publicBaseUrl = hasBaseUrlFirstArg ? publicBaseUrlOrGoogleVerificationCode : DEFAULT_PUBLIC_BASE_URL
  const googleVerificationCode = hasBaseUrlFirstArg
    ? (typeof googleVerificationCodeOrTotalPageviews === 'string' ? googleVerificationCodeOrTotalPageviews : undefined)
    : (typeof publicBaseUrlOrGoogleVerificationCode === 'string' ? publicBaseUrlOrGoogleVerificationCode : undefined)
  const totalPageviews = hasBaseUrlFirstArg
    ? (typeof totalPageviewsOrSelfSiteId === 'number' ? totalPageviewsOrSelfSiteId : undefined)
    : (typeof googleVerificationCodeOrTotalPageviews === 'number' ? googleVerificationCodeOrTotalPageviews : undefined)
  const selfSiteId = hasBaseUrlFirstArg
    ? selfSiteIdMaybe
    : (typeof totalPageviewsOrSelfSiteId === 'string' ? totalPageviewsOrSelfSiteId : undefined)
  const BEAM_SITE_ID = selfSiteId ?? BEAM_SITE_ID_FALLBACK
  const baseHost = publicHost(publicBaseUrl)
  const homeUrl = publicUrl(publicBaseUrl, '/')
  const ogImageUrl = publicUrl(publicBaseUrl, '/og/landing')
  const trackingScriptUrl = publicUrl(publicBaseUrl, '/js/beam.js')
  const softwareApplicationJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Beam',
    description: "Lightweight, cookie-free, GDPR-compliant web analytics built on Cloudflare's edge network.",
    applicationCategory: 'WebApplication',
    operatingSystem: 'Any',
    url: homeUrl,
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD', description: '1 site, 50,000 pageviews/month' },
      { '@type': 'Offer', name: 'Pro', price: '5', priceCurrency: 'USD', description: 'Unlimited sites, 500,000 pageviews/month' }
    ],
  })
  const organizationJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Keylight Digital LLC',
    url: homeUrl,
    contactPoint: { '@type': 'ContactPoint', email: 'ralph@keylightdigital.dev', contactType: 'customer support' },
  })
  const counterSection = totalPageviews !== undefined && totalPageviews >= 1000
    ? `
  <!-- Live counter -->
  <div class="mt-4 rounded-xl border border-indigo-100 bg-white py-4 text-center">
      <p class="text-indigo-700 font-semibold text-lg">
        <span class="text-2xl font-extrabold">${formatCount(totalPageviews)}</span>
        &nbsp;pageviews tracked and counting
      </p>
      <p class="text-indigo-500 text-sm mt-1">across all Beam-powered sites</p>
  </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam — Privacy-First Web Analytics</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="description" content="Lightweight, cookie-free, GDPR-compliant web analytics for your website. No tracking, no cookies, just clean data." />
  <meta property="og:title" content="Beam — Privacy-First Web Analytics" />
  <meta property="og:description" content="Lightweight, cookie-free, GDPR-compliant web analytics for your website. No tracking, no cookies, just clean data." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${homeUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Beam — Privacy-First Web Analytics" />
  <meta name="twitter:description" content="Lightweight, cookie-free, GDPR-compliant web analytics. No cookies, no consent banners." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${homeUrl}" />
  ${googleVerificationCode ? `<meta name="google-site-verification" content="${googleVerificationCode}" />` : ''}
  <meta property="og:image" content="${ogImageUrl}" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${softwareApplicationJsonLd}</script>
  <script type="application/ld+json">${organizationJsonLd}</script>
  <script defer src="${trackingScriptUrl}" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">

  <!-- Navigation -->
  <nav class="border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <span class="text-xl font-bold text-indigo-600">Beam</span>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/demo" class="font-medium text-emerald-700 hover:text-emerald-800">Live Demo</a>
        <a href="/how-it-works" class="text-gray-600 hover:text-gray-900">How it works</a>
        <a href="/migrate" class="text-gray-600 hover:text-gray-900">Migration Hub</a>
        <a href="/tools/stack-scanner" class="text-gray-600 hover:text-gray-900">Stack Scanner</a>
        <a href="/changelog" class="text-gray-600 hover:text-gray-900">Changelog</a>
        <a href="/login" class="text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" data-beam-cta="nav_get_started" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <section class="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
    <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
      Privacy-first web analytics
    </h1>
    <p class="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
      Simple, fast, and GDPR-compliant analytics for your website. No cookies, no tracking,
      no consent banners. Just the metrics you need.
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <a href="/signup" data-beam-cta="hero_signup" class="inline-block bg-indigo-600 text-white text-base sm:text-lg font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-indigo-700 transition-colors">
        Start tracking in 60 seconds &mdash; free
      </a>
      <a href="/demo" data-beam-cta="hero_demo" class="inline-block bg-emerald-600 text-white text-base sm:text-lg font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-emerald-700 transition-colors">
        Try the live demo
      </a>
    </div>
    <p class="mt-4 text-sm text-gray-400">No credit card required &middot; Cancel anytime</p>
  </section>

  <!-- Credibility bar -->
  <section class="bg-indigo-50 border-y border-indigo-100 py-6">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        <div class="bg-white rounded-xl border border-indigo-100 p-4">
          <p class="text-sm sm:text-base font-semibold text-indigo-700">65+ features</p>
        </div>
        <div class="bg-white rounded-xl border border-indigo-100 p-4">
          <p class="text-sm sm:text-base font-semibold text-indigo-700">Sub-2KB script</p>
        </div>
        <div class="bg-white rounded-xl border border-indigo-100 p-4">
          <p class="text-sm sm:text-base font-semibold text-indigo-700">$0 infrastructure cost</p>
        </div>
        <div class="bg-white rounded-xl border border-indigo-100 p-4">
          <p class="text-sm sm:text-base font-semibold text-indigo-700">GDPR compliant</p>
        </div>
      </div>
      ${counterSection}
    </div>
  </section>

  <!-- How it works -->
  <section class="py-20">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 class="text-3xl font-bold text-center mb-4">How it works</h2>
      <p class="text-center text-gray-500 mb-14">Set up in minutes. No configuration required.</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-10">

        <div class="text-center">
          <div class="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">1</div>
          <h3 class="font-semibold text-lg mb-2">Add our script tag</h3>
          <p class="text-gray-500 text-sm">Paste one line of HTML into your site's <code class="bg-gray-100 px-1 rounded text-xs">&lt;head&gt;</code>. That's it — or install via <a href="https://www.npmjs.com/package/@keylightdigital/beam" class="text-indigo-600 hover:underline">npm</a> for build-tool workflows.</p>
          <p class="text-gray-400 text-xs mt-2">Browse all setup guides at <a href="/for" class="text-indigo-500 hover:underline">/for</a>, including <a href="/for/nextjs" class="text-indigo-500 hover:underline">Next.js</a>, <a href="/for/wordpress" class="text-indigo-500 hover:underline">WordPress</a>, <a href="/for/hugo" class="text-indigo-500 hover:underline">Hugo</a>, <a href="/for/webflow" class="text-indigo-500 hover:underline">Webflow</a>, <a href="/for/shopify" class="text-indigo-500 hover:underline">Shopify</a>, <a href="/for/ghost" class="text-indigo-500 hover:underline">Ghost</a>, <a href="/for/framer" class="text-indigo-500 hover:underline">Framer</a>, and <a href="/for/carrd" class="text-indigo-500 hover:underline">Carrd</a>.</p>
        </div>

        <div class="text-center">
          <div class="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">2</div>
          <h3 class="font-semibold text-lg mb-2">Data flows to your dashboard</h3>
          <p class="text-gray-500 text-sm">Pageviews, referrers, devices, and countries are captured instantly — with no cookies and no personal data stored.</p>
        </div>

        <div class="text-center">
          <div class="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-extrabold mx-auto mb-5">3</div>
          <h3 class="font-semibold text-lg mb-2">Make decisions with clarity</h3>
          <p class="text-gray-500 text-sm">A clean, fast dashboard shows you what's working. No overwhelming reports, no dark patterns — just the data you need.</p>
        </div>

      </div>
    </div>
  </section>

  <!-- Interactive demo preview -->
  <section class="bg-gray-50 py-20">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <div class="text-center mb-12">
        <p class="text-sm font-semibold text-emerald-700 uppercase tracking-widest mb-3">See it in action</p>
        <h2 class="text-3xl font-bold mb-4">Watch real analytics data come to life</h2>
        <p class="text-gray-500 max-w-2xl mx-auto">Beam's strongest conversion asset is the product itself. Open the live demo to explore realistic traffic, filters, channels, events, and trends before you sign up.</p>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <div class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div class="rounded-xl border border-gray-200 overflow-hidden">
            <div class="bg-gray-900 text-gray-200 text-xs px-4 py-2 flex items-center justify-between">
              <span>${baseHost}/demo</span>
              <span class="text-emerald-300">Live sample data</span>
            </div>
            <div class="p-4 sm:p-5">
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">Pageviews</p>
                  <p class="text-xl font-bold text-gray-900">24.8K</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">Visitors</p>
                  <p class="text-xl font-bold text-gray-900">18.2K</p>
                </div>
              </div>
              <div class="space-y-2">
                <div class="h-3 rounded bg-indigo-100"><div class="h-3 rounded bg-indigo-500 w-5/6"></div></div>
                <div class="h-3 rounded bg-indigo-100"><div class="h-3 rounded bg-indigo-500 w-3/5"></div></div>
                <div class="h-3 rounded bg-indigo-100"><div class="h-3 rounded bg-indigo-500 w-2/3"></div></div>
                <div class="h-3 rounded bg-indigo-100"><div class="h-3 rounded bg-indigo-500 w-1/2"></div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 class="text-xl font-semibold mb-3">Interactive Demo Preview</h3>
            <p class="text-gray-500 text-sm leading-relaxed mb-6">Filter by range, drill into top pages and referrers, and test segmentation controls exactly like a real customer account. No signup wall. No fake screenshots.</p>
            <ul class="space-y-3 text-sm text-gray-600 mb-6">
              <li class="flex items-start gap-2"><span class="text-emerald-600 font-bold">✓</span> Explore today, 7-day, and 30-day ranges</li>
              <li class="flex items-start gap-2"><span class="text-emerald-600 font-bold">✓</span> Verify mobile and desktop dashboard behavior</li>
              <li class="flex items-start gap-2"><span class="text-emerald-600 font-bold">✓</span> See privacy-first analytics without cookies</li>
            </ul>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="/demo" data-beam-cta="demo_section_demo" class="inline-flex justify-center items-center bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl hover:bg-emerald-700 transition-colors">
              Try the live demo
            </a>
            <a href="/signup" data-beam-cta="demo_section_signup" class="inline-flex justify-center items-center border border-indigo-600 text-indigo-600 font-semibold px-5 py-3 rounded-xl hover:bg-indigo-50 transition-colors">
              Create a free account
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Feature highlights -->
  <section class="py-20">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 class="text-3xl font-bold text-center mb-14">Everything you need, nothing you don't</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="text-3xl mb-4">🍪</div>
          <h3 class="font-semibold text-lg mb-2">No Cookies</h3>
          <p class="text-gray-500 text-sm">Fully cookie-free. No consent banners required. Your visitors stay private.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="text-3xl mb-4">🇪🇺</div>
          <h3 class="font-semibold text-lg mb-2">GDPR Compliant</h3>
          <p class="text-gray-500 text-sm">No personal data collected or stored. Fully compliant with GDPR, CCPA, and PECR.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="text-3xl mb-4">⚡</div>
          <h3 class="font-semibold text-lg mb-2">Lightweight Script</h3>
          <p class="text-gray-500 text-sm">Under 2KB. Loads asynchronously and never slows down your site.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="text-3xl mb-4">📊</div>
          <h3 class="font-semibold text-lg mb-2">Real-Time Dashboard</h3>
          <p class="text-gray-500 text-sm">See your traffic as it happens. Pageviews, referrers, countries, and more.</p>
        </div>

      </div>
    </div>
  </section>

  <!-- Built with -->
  <section class="bg-gray-50 py-16">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <div class="text-center mb-10">
        <p class="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Built with</p>
        <h2 class="text-2xl font-bold mb-4">Built on Cloudflare's global edge network</h2>
        <p class="text-gray-500 max-w-2xl mx-auto">Your analytics data is processed and stored on Cloudflare's infrastructure — the same network that powers millions of websites worldwide.</p>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p class="text-sm font-semibold text-gray-800">Cloudflare Workers</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p class="text-sm font-semibold text-gray-800">TypeScript</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p class="text-sm font-semibold text-gray-800">Cloudflare D1</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <a href="https://github.com/scobb/beam.js" class="text-sm font-semibold text-indigo-700 hover:underline">Open-source tracking script</a>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div class="text-2xl mb-3">🌍</div>
          <h3 class="font-semibold mb-1">Global edge network</h3>
          <p class="text-gray-500 text-sm">300+ locations worldwide for ultra-low latency data collection.</p>
        </div>
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div class="text-2xl mb-3">🔒</div>
          <h3 class="font-semibold mb-1">Encrypted storage</h3>
          <p class="text-gray-500 text-sm">All data encrypted at rest and in transit. Nothing personal is ever stored.</p>
        </div>
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div class="text-2xl mb-3">✅</div>
          <h3 class="font-semibold mb-1">99.99% uptime</h3>
          <p class="text-gray-500 text-sm">Cloudflare's SLA-backed reliability means your analytics never go dark.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing" class="py-20">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 class="text-3xl font-bold text-center mb-4">Simple, honest pricing</h2>
      <p class="text-center text-gray-500 mb-6">No hidden fees. No data selling. Cancel anytime.</p>
      <p class="text-center text-sm text-gray-400 mb-8">Already paying for analytics? <a href="/switch" class="text-indigo-600 hover:underline font-medium">See how much you'd save by switching →</a></p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">

        <!-- Free tier -->
        <div class="border border-gray-200 rounded-2xl p-8">
          <h3 class="text-xl font-bold mb-1">Free</h3>
          <p class="text-4xl font-extrabold mt-4 mb-6">$0<span class="text-base font-normal text-gray-400">/mo</span></p>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 1 website</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 50,000 pageviews / month</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> All core features</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> No credit card required</li>
          </ul>
          <a href="/signup" data-beam-cta="pricing_free_signup" class="block text-center border border-indigo-600 text-indigo-600 font-semibold py-3 rounded-xl hover:bg-indigo-50 transition-colors">
            Start tracking in 60 seconds &mdash; free
          </a>
          <p class="text-center text-xs text-gray-400 mt-3">No credit card required</p>
        </div>

        <!-- Pro tier -->
        <div class="border-2 border-indigo-600 rounded-2xl p-8 relative">
          <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">POPULAR</span>
          <h3 class="text-xl font-bold mb-1">Pro</h3>
          <p class="text-4xl font-extrabold mt-4 mb-6">$5<span class="text-base font-normal text-gray-400">/mo</span></p>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Unlimited websites</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 500,000 pageviews / month</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> All core features</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Priority support</li>
          </ul>
          <a href="/signup" data-beam-cta="pricing_pro_signup" class="block text-center bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors">
            Start free trial
          </a>
        </div>

      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="bg-gray-50 py-20">
    <div class="max-w-3xl mx-auto px-4 sm:px-6">
      <h2 class="text-3xl font-bold text-center mb-14">Frequently asked questions</h2>
      <div class="space-y-6">

        <details class="bg-white border border-gray-200 rounded-xl p-6 group" open>
          <summary class="font-semibold cursor-pointer list-none flex items-center justify-between">
            Do I need a cookie banner?
            <span class="text-gray-400 group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <p class="mt-4 text-gray-500 text-sm leading-relaxed">
            No. Beam is completely cookie-free. We don't use any cookies or persistent identifiers, so there's nothing to disclose under GDPR, CCPA, or the ePrivacy Directive. You can remove your cookie banner entirely if Beam is your only analytics tool.
          </p>
        </details>

        <details class="bg-white border border-gray-200 rounded-xl p-6 group">
          <summary class="font-semibold cursor-pointer list-none flex items-center justify-between">
            How does it count visitors without cookies?
            <span class="text-gray-400 group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <p class="mt-4 text-gray-500 text-sm leading-relaxed">
            We use a daily hash derived from non-personal signals (date, path, country, browser family, and screen width) to estimate unique visitors. No IP addresses or user IDs are ever stored. The hash resets each day, making it impossible to track someone across sessions.
          </p>
        </details>

        <details class="bg-white border border-gray-200 rounded-xl p-6 group">
          <summary class="font-semibold cursor-pointer list-none flex items-center justify-between">
            Can I switch from Google Analytics?
            <span class="text-gray-400 group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <p class="mt-4 text-gray-500 text-sm leading-relaxed">
            Yes, and it takes about 60 seconds. Replace your GA script with Beam's single script tag and you're done. Beam won't replicate every GA report, but it gives you the metrics that actually matter — pageviews, referrers, top pages, countries, and devices — without the complexity or privacy trade-offs.
          </p>
        </details>

        <details class="bg-white border border-gray-200 rounded-xl p-6 group">
          <summary class="font-semibold cursor-pointer list-none flex items-center justify-between">
            Is there a free plan?
            <span class="text-gray-400 group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <p class="mt-4 text-gray-500 text-sm leading-relaxed">
            Yes. The free plan includes 1 website and up to 50,000 pageviews per month — no credit card required. If you need more, the Pro plan is $5/month for unlimited sites and 500,000 pageviews. You can upgrade anytime from your dashboard.
          </p>
        </details>

      </div>
    </div>
  </section>

  <!-- Also from Keylight Digital -->
  <section class="px-4 sm:px-6 pb-8">
    <div class="max-w-6xl mx-auto border-t border-gray-100 pt-8">
      <p class="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Also from Keylight Digital</p>
      <a href="https://nexus.keylightdigital.dev" class="inline-flex flex-wrap items-center gap-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <strong class="text-gray-700">Nexus</strong>
        <span>—</span>
        <span>AI agent observability. Trace, monitor, and debug your AI agents.</span>
        <span class="text-gray-400">↗</span>
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/how-it-works" class="hover:text-gray-600">How it works</a>
        <a href="/changelog" class="hover:text-gray-600">Changelog</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/switch" class="hover:text-gray-600">Savings calculator</a>
        <a href="/alternatives" class="hover:text-gray-600">Alternatives</a>
        <a href="/migrate" class="hover:text-gray-600">Migration hub</a>
        <a href="/for" class="hover:text-gray-600">Setup guides</a>
        <a href="/for/hugo" class="hover:text-gray-600">Hugo guide</a>
        <a href="/for/shopify" class="hover:text-gray-600">Shopify guide</a>
        <a href="/for/ghost" class="hover:text-gray-600">Ghost guide</a>
        <a href="/tools/stack-scanner" class="hover:text-gray-600">Stack scanner</a>
        <a href="https://github.com/scobb/beam.js" class="hover:text-gray-600">Open source tracking script</a>
        <a href="https://www.npmjs.com/package/@keylightdigital/beam" class="hover:text-gray-600">npm</a>
        <a href="/vs/google-analytics" class="hover:text-gray-600">vs Google Analytics</a>
        <a href="/vs/vercel-analytics" class="hover:text-gray-600">vs Vercel Analytics</a>
        <a href="/vs/cloudflare-web-analytics" class="hover:text-gray-600">vs Cloudflare Web Analytics</a>
        <a href="/vs/plausible" class="hover:text-gray-600">vs Plausible</a>
        <a href="/vs/fathom" class="hover:text-gray-600">vs Fathom</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
        <a href="/public/${BEAM_SITE_ID}" class="hover:text-gray-600">Live stats ↗</a>
      </div>
    </div>
  </footer>

<script>
  (function () {
    function sendTrack(name, props) {
      if (!window.beam || typeof window.beam.track !== 'function') return;
      window.beam.track(name, props);
      return true;
    }

    function trackEventually(name, props) {
      let sent = false;
      const attempt = () => {
        if (sent) return;
        sent = sendTrack(name, props) === true;
      };
      attempt();
      if (sent) return;
      setTimeout(attempt, 120);
      setTimeout(attempt, 350);
      setTimeout(attempt, 700);
    }

    const ctas = document.querySelectorAll('a[href="/signup"], a[href="/demo"]');
    for (const cta of ctas) {
      cta.addEventListener('click', function () {
        trackEventually('cta_click', {
          page: 'landing',
          target: this.getAttribute('href') || '',
          cta: this.getAttribute('data-beam-cta') || this.textContent?.trim().slice(0, 60) || 'unknown',
        });
      });
    }

    const pricingSection = document.getElementById('pricing');
    if (!pricingSection || !('IntersectionObserver' in window)) return;

    let trackedPricingView = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || trackedPricingView) continue;
        trackedPricingView = true;
        trackEventually('pricing_view', { page: 'landing', section: 'pricing' });
        observer.disconnect();
      }
    }, { threshold: 0.35 });

    observer.observe(pricingSection);
  })();
</script>
</body>
</html>`
}
