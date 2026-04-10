import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl, publicHost } from '../lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function nav(): string {
  return `
  <nav class="border-b border-gray-100">
    <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex items-center gap-4">
        <a href="/login" class="text-sm text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" class="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>`
}

function footer(): string {
  return `
  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex items-center gap-6">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/how-it-works" class="hover:text-gray-600">How it works</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/vs/google-analytics" class="hover:text-gray-600">vs Google Analytics</a>
        <a href="/vs/plausible" class="hover:text-gray-600">vs Plausible</a>
        <a href="/vs/fathom" class="hover:text-gray-600">vs Fathom</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>`
}

app.get('/about', (c) => {
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const baseUrl = getPublicBaseUrl(c.env)
  const baseHost = publicHost(baseUrl)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>About Beam — Privacy-First Web Analytics by Keylight Digital LLC</title>
  <meta name="description" content="Beam is a lightweight, cookie-free, GDPR-compliant web analytics service built on Cloudflare's edge network. Built by Keylight Digital LLC." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/about" />
  <meta property="og:title" content="About Beam — Privacy-First Web Analytics" />
  <meta property="og:description" content="Beam is a lightweight, cookie-free, GDPR-compliant analytics service. No cookies, no consent banners, just clean data." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/about" />
  <meta name="twitter:card" content="summary" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-6">About Beam</h1>

  <div class="space-y-6 text-gray-700 leading-relaxed text-lg mb-14">
    <p>
      Beam is a privacy-first web analytics service built on Cloudflare's global edge network.
      It gives site owners the traffic data they need — pageviews, referrers, top pages, countries,
      browsers, and devices — without using cookies, storing personal data, or requiring a consent
      banner. The tracking script is under 2KB, loads asynchronously, and never slows down your site.
    </p>
    <p>
      We built Beam because most analytics tools force a trade-off between useful data and visitor
      privacy. Google Analytics shares your visitors' data with Google's advertising infrastructure.
      Privacy-focused alternatives like Plausible and Fathom are good products but can be expensive
      for smaller sites and indie developers. Beam offers the same cookie-free, GDPR-compliant
      approach starting completely free, with a Pro plan at $5/month.
    </p>
    <p>
      Beam is operated by <strong>Keylight Digital LLC</strong>, a software company focused on
      building useful, privacy-respecting products. If you have questions, feedback, or need support,
      reach us at <a href="mailto:ralph@keylightdigital.dev" class="text-indigo-600 hover:underline">ralph@keylightdigital.dev</a>.
    </p>
    <p>
      Need technical depth before evaluating? Read <a href="/how-it-works" class="text-indigo-600 hover:underline">How Beam works</a> for the full edge architecture, privacy model, and data flow.
    </p>
  </div>

  <!-- Key Features -->
  <section class="mb-14">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Key Features</h2>
    <ul class="space-y-3 text-gray-700">
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>No cookies</strong> — fully cookieless tracking, no consent banner required anywhere in the world</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>GDPR, CCPA, and PECR compliant</strong> — no personal data collected or stored</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>Lightweight script</strong> — under 2KB, loads asynchronously, zero impact on page performance</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>Real-time dashboard</strong> — pageviews, unique visitors, top pages, referrers, countries, browsers, and devices</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>CSV export</strong> — Pro users can export raw pageview data for custom analysis</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>Public dashboards</strong> — share your analytics publicly with a single link</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-green-500 font-bold mt-0.5">✓</span>
        <span><strong>Built on Cloudflare edge</strong> — fast data collection from anywhere in the world, high availability</span>
      </li>
    </ul>
  </section>

  <!-- Pricing Summary -->
  <section class="mb-14">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Pricing</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="border border-gray-200 rounded-xl p-6">
        <h3 class="text-lg font-bold mb-1">Free</h3>
        <p class="text-3xl font-extrabold mb-4">$0<span class="text-sm font-normal text-gray-400">/mo</span></p>
        <ul class="space-y-2 text-sm text-gray-600">
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 1 website</li>
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 50,000 pageviews / month</li>
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> All core analytics features</li>
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> No credit card required</li>
        </ul>
      </div>
      <div class="border-2 border-indigo-600 rounded-xl p-6">
        <h3 class="text-lg font-bold mb-1">Pro</h3>
        <p class="text-3xl font-extrabold mb-4">$5<span class="text-sm font-normal text-gray-400">/mo</span></p>
        <ul class="space-y-2 text-sm text-gray-600">
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Unlimited websites</li>
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 500,000 pageviews / month</li>
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> CSV data export</li>
          <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Priority support</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Company Info -->
  <section class="mb-14">
    <h2 class="text-2xl font-bold text-gray-900 mb-4">Company</h2>
    <div class="text-gray-700 space-y-2">
      <p><strong>Company:</strong> Keylight Digital LLC</p>
      <p><strong>Contact:</strong> <a href="mailto:ralph@keylightdigital.dev" class="text-indigo-600 hover:underline">ralph@keylightdigital.dev</a></p>
      <p><strong>Website:</strong> <a href="${baseUrl}" class="text-indigo-600 hover:underline">${baseHost}</a></p>
      <p><strong>GitHub:</strong> <a href="https://github.com/scobb/beam.js" class="text-indigo-600 hover:underline">Open source tracking script</a></p>
      <p><strong>npm:</strong> <a href="https://www.npmjs.com/package/@keylightdigital/beam" class="text-indigo-600 hover:underline">@keylightdigital/beam</a> — also available on npm for build-tool workflows</p>
    </div>
  </section>

  <!-- For Reviewers -->
  <section class="bg-gray-50 rounded-2xl p-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">For Reviewers</h2>
    <p class="text-gray-500 text-sm mb-6">Ready-to-copy product descriptions for directory submissions and reviews.</p>

    <div class="space-y-8">
      <div>
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">50-Word Blurb</h3>
        <div class="bg-white border border-gray-200 rounded-xl p-5 text-gray-700 leading-relaxed text-sm">
          Beam is a lightweight, cookie-free web analytics service. It collects pageviews, referrers,
          countries, and device data without cookies or personal data — no consent banner needed.
          GDPR-compliant out of the box, under 2KB script, real-time dashboard. Free tier available.
          Pro plan at $5/month. Built on Cloudflare's edge by Keylight Digital LLC.
        </div>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">150-Word Blurb</h3>
        <div class="bg-white border border-gray-200 rounded-xl p-5 text-gray-700 leading-relaxed text-sm">
          Beam is a privacy-first web analytics service that gives site owners the traffic data they
          need without compromising visitor privacy. Unlike Google Analytics, Beam uses no cookies and
          sends no data to third parties — making it GDPR, CCPA, and PECR compliant out of the box,
          with no consent banner required.<br /><br />
          The tracking script is under 2KB, loads asynchronously, and collects pageviews, referrers,
          top pages, country, device type, and browser — the metrics that actually matter. The
          dashboard is clean and focused: no complex event models or steep learning curves.<br /><br />
          Beam is built on Cloudflare's global edge network, giving it fast data collection worldwide
          and high availability. It's competitively priced: a free tier covering 1 site and 50,000
          pageviews/month, with a Pro plan at $5/month for unlimited sites and 500,000 pageviews.
          A privacy-respecting alternative to Google Analytics, Plausible, and Fathom.
        </div>
      </div>
    </div>
  </section>

</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

export const about = app
