import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl, publicUrl } from '../lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function nav(): string {
  return `
  <nav class="border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/how-it-works" class="font-medium text-emerald-700 hover:text-emerald-800">How it works</a>
        <a href="/demo" class="text-gray-600 hover:text-gray-900">Live Demo</a>
        <a href="/migrate" class="text-gray-600 hover:text-gray-900">Migration Hub</a>
        <a href="/login" class="text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>`
}

function footer(): string {
  return `
  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/how-it-works" class="hover:text-gray-600">How it works</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/for" class="hover:text-gray-600">Setup guides</a>
        <a href="/tools/stack-scanner" class="hover:text-gray-600">Stack scanner</a>
        <a href="/demo" class="hover:text-gray-600">Live demo</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
      </div>
    </div>
  </footer>`
}

app.get('/how-it-works', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const canonicalUrl = publicUrl(baseUrl, '/how-it-works')
  const techArticleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'How Beam Works: Privacy-First Analytics at the Edge',
    description:
      'A technical architecture walkthrough of Beam: tracking script lifecycle, Cloudflare Worker ingestion, D1 storage, unique visitor hashing, and privacy guarantees.',
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      name: 'Keylight Digital LLC',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Beam',
      url: publicUrl(baseUrl, '/'),
    },
    mainEntityOfPage: canonicalUrl,
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How Beam Works - Privacy-First Edge Analytics Architecture</title>
  <meta name="description" content="Technical deep dive into Beam's architecture: sub-2KB tracking script, Cloudflare Worker collection, D1 analytics storage, privacy-safe visitor estimation, and dashboard delivery." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="How Beam Works - Privacy-First Edge Analytics Architecture" />
  <meta property="og:description" content="See exactly how Beam collects analytics at the edge without cookies or personal data." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${publicUrl(baseUrl, '/og/how-it-works')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="How Beam Works" />
  <meta name="twitter:description" content="Beam architecture: edge collection, D1 storage, privacy-safe unique visitor counting." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${techArticleJsonLd}</script>
  <script defer src="${publicUrl(baseUrl, '/js/beam.js')}" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Technical architecture</p>
  <h1 class="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">How Beam works on Cloudflare's edge</h1>
  <p class="mt-6 text-lg text-gray-600 max-w-3xl">
    This page explains the full lifecycle: what runs in the browser, what is processed at the edge,
    what gets written to D1, and how Beam estimates unique visitors without cookies or persistent identifiers.
  </p>

  <section class="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Request lifecycle</h2>
    <ol class="mt-4 space-y-3 text-gray-700">
      <li><span class="font-semibold">1.</span> Browser loads the sub-2KB script from <code class="rounded bg-white px-1.5 py-0.5 text-xs">/js/beam.js</code>.</li>
      <li><span class="font-semibold">2.</span> Script sends page payloads to <code class="rounded bg-white px-1.5 py-0.5 text-xs">/api/collect</code> via <code class="rounded bg-white px-1.5 py-0.5 text-xs">sendBeacon()</code> with fetch fallback.</li>
      <li><span class="font-semibold">3.</span> Worker validates payload size, site ownership, CORS, and per-IP rate limit (KV TTL window).</li>
      <li><span class="font-semibold">4.</span> Worker enriches request with Cloudflare headers (country) and lightweight UA parsing (browser/device).</li>
      <li><span class="font-semibold">5.</span> Sanitized row is written to D1 with UTC timestamp and queried by dashboard/public APIs.</li>
      <li><span class="font-semibold">6.</span> Dashboard computes aggregates, channels, goals, and insights from the same UTC range helpers.</li>
    </ol>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900">Data flow diagram</h2>
    <p class="mt-3 text-gray-600">One request path from page load to decision-ready dashboard views.</p>
    <div class="mt-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <svg viewBox="0 0 1080 320" class="w-full h-auto" role="img" aria-label="Beam data flow from website visitor to dashboard">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4f46e5" />
          </marker>
        </defs>

        <rect x="20" y="80" width="190" height="90" rx="12" fill="#eef2ff" stroke="#c7d2fe" />
        <text x="115" y="116" text-anchor="middle" font-size="20" font-weight="700" fill="#312e81">Visitor Page</text>
        <text x="115" y="144" text-anchor="middle" font-size="14" fill="#4b5563">beam.js script</text>

        <rect x="260" y="80" width="210" height="90" rx="12" fill="#ecfeff" stroke="#a5f3fc" />
        <text x="365" y="116" text-anchor="middle" font-size="20" font-weight="700" fill="#0f766e">/api/collect</text>
        <text x="365" y="144" text-anchor="middle" font-size="14" fill="#4b5563">validation + enrichment</text>

        <rect x="520" y="35" width="230" height="90" rx="12" fill="#f0fdf4" stroke="#bbf7d0" />
        <text x="635" y="71" text-anchor="middle" font-size="20" font-weight="700" fill="#166534">KV</text>
        <text x="635" y="99" text-anchor="middle" font-size="14" fill="#4b5563">rate limit + short cache</text>

        <rect x="520" y="195" width="230" height="90" rx="12" fill="#fff7ed" stroke="#fed7aa" />
        <text x="635" y="231" text-anchor="middle" font-size="20" font-weight="700" fill="#9a3412">D1</text>
        <text x="635" y="259" text-anchor="middle" font-size="14" fill="#4b5563">pageviews + events tables</text>

        <rect x="800" y="80" width="260" height="90" rx="12" fill="#f5f3ff" stroke="#ddd6fe" />
        <text x="930" y="116" text-anchor="middle" font-size="20" font-weight="700" fill="#5b21b6">Dashboard + Public Views</text>
        <text x="930" y="144" text-anchor="middle" font-size="14" fill="#4b5563">queries, charts, insights</text>

        <line x1="210" y1="125" x2="260" y2="125" stroke="#4f46e5" stroke-width="3" marker-end="url(#arrow)" />
        <line x1="470" y1="96" x2="520" y2="80" stroke="#4f46e5" stroke-width="3" marker-end="url(#arrow)" />
        <line x1="470" y1="154" x2="520" y2="240" stroke="#4f46e5" stroke-width="3" marker-end="url(#arrow)" />
        <line x1="750" y1="80" x2="800" y2="125" stroke="#4f46e5" stroke-width="3" marker-end="url(#arrow)" />
        <line x1="750" y1="240" x2="800" y2="125" stroke="#4f46e5" stroke-width="3" marker-end="url(#arrow)" />
      </svg>
    </div>
  </section>

  <section class="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
    <article class="rounded-2xl border border-gray-200 p-6">
      <h2 class="text-2xl font-bold text-gray-900">Privacy model</h2>
      <p class="mt-3 text-gray-600">Beam is intentionally strict about what is and is not collected.</p>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 class="font-semibold text-emerald-900">Collected</h3>
          <ul class="mt-2 space-y-1.5 text-sm text-emerald-800">
            <li>Pathname only (no full URL query/body)</li>
            <li>Referrer, screen width, language, timezone</li>
            <li>Country from Cloudflare header</li>
            <li>Browser family and device type</li>
          </ul>
        </div>
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <h3 class="font-semibold text-rose-900">Not collected</h3>
          <ul class="mt-2 space-y-1.5 text-sm text-rose-800">
            <li>No cookies or localStorage identifiers</li>
            <li>No raw IP addresses stored</li>
            <li>No user IDs, emails, or personal profiles</li>
            <li>No cross-site persistent tracking</li>
          </ul>
        </div>
      </div>
    </article>

    <article class="rounded-2xl border border-gray-200 p-6">
      <h2 class="text-2xl font-bold text-gray-900">Unique visitor estimation</h2>
      <p class="mt-3 text-gray-600">
        Beam approximates daily unique visitors using non-PII tuples:
        <code class="rounded bg-gray-100 px-2 py-0.5 text-xs">date + path + country + browser + screen_width</code>.
      </p>
      <ul class="mt-4 space-y-2 text-gray-700">
        <li><span class="font-semibold">Daily reset:</span> fingerprint components include date, so identifiers rotate every UTC day.</li>
        <li><span class="font-semibold">No identity graph:</span> the model is for trend quality, not person-level tracking.</li>
        <li><span class="font-semibold">Tradeoff:</span> counts are intentionally approximate to preserve privacy.</li>
      </ul>
    </article>
  </section>

  <section class="mt-12 rounded-2xl border border-gray-200 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Performance characteristics</h2>
    <div class="mt-5 overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Layer</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Design choice</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Why it matters</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr>
            <td class="px-4 py-3 font-medium text-gray-900">Tracking script</td>
            <td class="px-4 py-3 text-gray-700">Sub-2KB, async, beacon-first delivery</td>
            <td class="px-4 py-3 text-gray-600">Minimal impact on Core Web Vitals and page rendering.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 font-medium text-gray-900">Collection worker</td>
            <td class="px-4 py-3 text-gray-700">Edge execution with simple payload schema</td>
            <td class="px-4 py-3 text-gray-600">Low latency ingestion close to visitors worldwide.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 font-medium text-gray-900">Storage/query</td>
            <td class="px-4 py-3 text-gray-700">D1 + indexed UTC time windows</td>
            <td class="px-4 py-3 text-gray-600">Predictable aggregate queries for dashboards and digests.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 font-medium text-gray-900">Protection</td>
            <td class="px-4 py-3 text-gray-700">KV rate limiting + payload size caps</td>
            <td class="px-4 py-3 text-gray-600">Guards write paths against burst abuse and oversized bodies.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-12 rounded-2xl border border-indigo-200 bg-indigo-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Try the architecture in production</h2>
    <p class="mt-3 text-gray-700">Run the same flow end-to-end using the public demo or your own site in under two minutes.</p>
    <div class="mt-5 flex flex-col sm:flex-row gap-3">
      <a href="/demo" class="inline-flex justify-center items-center bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl hover:bg-emerald-700">Open live demo</a>
      <a href="/for" class="inline-flex justify-center items-center border border-indigo-600 text-indigo-700 font-semibold px-5 py-3 rounded-xl hover:bg-indigo-100">Open setup guides</a>
      <a href="/signup" class="inline-flex justify-center items-center border border-gray-300 text-gray-800 font-semibold px-5 py-3 rounded-xl hover:bg-white">Create free account</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`

  return c.html(html)
})

export const howItWorks = app
