import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl } from '../lib/publicUrl'

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
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/alternatives" class="hover:text-gray-600">Alternatives hub</a>
        <a href="/migrate" class="hover:text-gray-600">Migration hub</a>
        <a href="/vs/google-analytics" class="hover:text-gray-600">vs Google Analytics</a>
        <a href="/vs/vercel-analytics" class="hover:text-gray-600">vs Vercel Analytics</a>
        <a href="/vs/cloudflare-web-analytics" class="hover:text-gray-600">vs Cloudflare Web Analytics</a>
        <a href="/vs/plausible" class="hover:text-gray-600">vs Plausible</a>
        <a href="/vs/fathom" class="hover:text-gray-600">vs Fathom</a>
        <a href="/vs/umami" class="hover:text-gray-600">vs Umami</a>
        <a href="/vs/matomo" class="hover:text-gray-600">vs Matomo</a>
        <a href="/vs/simple-analytics" class="hover:text-gray-600">vs Simple Analytics</a>
        <a href="/vs/rybbit" class="hover:text-gray-600">vs Rybbit</a>
        <a href="/beam-analytics-alternative" class="hover:text-gray-600">Beam Analytics Alternative</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>`
}

function comparisonTable(rows: { feature: string; beam: string; competitor: string; beamWins?: boolean }[]): string {
  return `
  <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
    <thead class="bg-gray-50">
      <tr>
        <th class="text-left px-4 py-3 font-semibold text-gray-700">Feature</th>
        <th class="text-center px-4 py-3 font-semibold text-indigo-600">Beam</th>
        <th class="text-center px-4 py-3 font-semibold text-gray-500">${rows[0]?.feature === 'HEADER_MARKER' ? '' : 'Competitor'}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
      ${rows.map(r => `
      <tr class="bg-white hover:bg-gray-50">
        <td class="px-4 py-3 text-gray-700 font-medium">${r.feature}</td>
        <td class="px-4 py-3 text-center">${r.beamWins !== false ? `<span class="text-green-600 font-semibold">${r.beam}</span>` : `<span class="text-gray-700">${r.beam}</span>`}</td>
        <td class="px-4 py-3 text-center text-gray-500">${r.competitor}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
}

function ctaSection(): string {
  return `
  <section class="bg-indigo-50 rounded-2xl p-10 text-center mt-16">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">Ready to switch to Beam?</h2>
    <p class="text-gray-600 mb-6">Start free. No credit card required. Up and running in under 5 minutes.</p>
    <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors">
      Get Started Free
    </a>
  </section>`
}

function relatedComparisons(links: { href: string; label: string; description: string }[]): string {
  return `
  <section class="mt-14">
    <h2 class="text-xl font-bold text-gray-900 mb-4">Compare more options</h2>
    <div class="grid gap-4 md:grid-cols-3">
      ${links.map((link) => `
        <a href="${link.href}" class="block rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-200 hover:shadow-sm transition">
          <p class="font-semibold text-gray-900">${link.label}</p>
          <p class="mt-2 text-sm text-gray-600">${link.description}</p>
        </a>
      `).join('')}
    </div>
  </section>`
}

type AlternativeOption = {
  href: string
  label: string
  intro: string
  beamStronger: string
  alternativeBetter: string
}

function alternativesCards(options: AlternativeOption[]): string {
  return `
  <section class="mt-10">
    <div class="grid gap-5 md:grid-cols-2">
      ${options.map((option) => `
      <article class="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 class="text-xl font-bold text-gray-900">
          <a href="${option.href}" class="hover:text-indigo-700">${option.label}</a>
        </h2>
        <p class="mt-3 text-sm text-gray-600 leading-relaxed">${option.intro}</p>
        <div class="mt-4 space-y-3 text-sm leading-relaxed">
          <p class="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
            <span class="font-semibold">Beam is stronger when:</span> ${option.beamStronger}
          </p>
          <p class="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
            <span class="font-semibold">Alternative is better when:</span> ${option.alternativeBetter}
          </p>
        </div>
        <a href="${option.href}" class="mt-5 inline-block text-sm font-semibold text-indigo-700 hover:text-indigo-800">Read detailed comparison →</a>
      </article>
      `).join('')}
    </div>
  </section>`
}

app.get('/alternatives', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const options: AlternativeOption[] = [
    {
      href: '/vs/google-analytics',
      label: 'Beam vs Google Analytics',
      intro: 'The default analytics choice, with deep ecosystem integrations and complexity.',
      beamStronger: 'you want cookie-free analytics without consent banner friction and without Google data-sharing concerns.',
      alternativeBetter: 'you depend on advanced attribution, Ads integrations, or enterprise reporting already tied to GA4.',
    },
    {
      href: '/vs/cloudflare-web-analytics',
      label: 'Beam vs Cloudflare Web Analytics',
      intro: 'Cloudflare\'s built-in zero-cost traffic dashboard for zones already running on Cloudflare.',
      beamStronger: 'you need goals/events, clearer source breakdowns, and plain-English change alerts to drive decisions.',
      alternativeBetter: 'you want the simplest free baseline with no extra account or dashboard beyond Cloudflare itself.',
    },
    {
      href: '/vs/vercel-analytics',
      label: 'Beam vs Vercel Analytics',
      intro: 'Vercel\'s native analytics stack for Next.js teams already shipping on Vercel.',
      beamStronger: 'you want a privacy-first analytics workflow that is portable across hosting providers and non-Next.js properties.',
      alternativeBetter: 'your team is all-in on Vercel + Next.js and you mainly need the shortest path to built-in traffic dashboards.',
    },
    {
      href: '/vs/plausible',
      label: 'Beam vs Plausible',
      intro: 'A respected privacy-first hosted product with mature positioning in the indie market.',
      beamStronger: 'you need similar privacy outcomes at lower entry pricing with a practical free tier.',
      alternativeBetter: 'you want Plausible-specific features like mature funnels/goals and an established open-source ecosystem.',
    },
    {
      href: '/vs/fathom',
      label: 'Beam vs Fathom',
      intro: 'A polished premium hosted privacy analytics product with strong brand trust.',
      beamStronger: 'cost sensitivity matters and you want straightforward metrics with a lower monthly bill.',
      alternativeBetter: 'you value Fathom brand preference and are comfortable paying a premium for its current positioning.',
    },
    {
      href: '/vs/umami',
      label: 'Beam vs Umami',
      intro: 'An open-source analytics project with self-hosting flexibility and a hosted option.',
      beamStronger: 'you want managed hosting and minimal ops work while staying privacy-first.',
      alternativeBetter: 'you need full self-host control, source-level customization, or tighter infra ownership.',
    },
    {
      href: '/vs/matomo',
      label: 'Beam vs Matomo',
      intro: 'A heavyweight suite that can replace broad GA-style workflows with enterprise depth.',
      beamStronger: 'you prioritize simplicity, faster setup, and cleaner day-to-day reporting for smaller teams.',
      alternativeBetter: 'you require advanced enterprise capabilities like heatmaps, sessions, and deeper on-prem governance.',
    },
    {
      href: '/vs/simple-analytics',
      label: 'Beam vs Simple Analytics',
      intro: 'A minimalist privacy-focused hosted product with strong branding and polished UX.',
      beamStronger: 'price-to-value is your main decision factor and you still want core privacy analytics coverage.',
      alternativeBetter: 'you prefer Simple Analytics-specific product ergonomics and are fine with its higher price tiers.',
    },
    {
      href: '/vs/rybbit',
      label: 'Beam vs Rybbit',
      intro: 'A fast-growing open-source/self-hosted option with advanced product analytics features.',
      beamStronger: 'you want zero infrastructure and lower managed cost for day-to-day site analytics.',
      alternativeBetter: 'you need session replay/funnel workflows and can operate self-hosted infrastructure.',
    },
    {
      href: '/beam-analytics-alternative',
      label: 'Beam Analytics Shutdown Migration',
      intro: 'A migration-focused page for teams moving off the legacy beamanalytics.io shutdown timeline.',
      beamStronger: 'you need a current managed replacement and a clear implementation checklist before cutoff dates.',
      alternativeBetter: 'you are still validating migration timing and only need export/archival guidance right now.',
    },
  ]

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam Alternatives Hub — Compare Privacy-First Analytics Options</title>
  <meta name="description" content="Compare Beam with Google Analytics, Cloudflare Web Analytics, Plausible, Fathom, Umami, Matomo, Simple Analytics, and Rybbit. Honest fit guidance plus migration options." />
  <meta name="keywords" content="analytics alternatives, google analytics alternative, plausible alternative, fathom alternative, privacy-first analytics comparison" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/alternatives" />
  <meta property="og:title" content="Beam Alternatives Hub — Compare Privacy-First Analytics Options" />
  <meta property="og:description" content="One page to evaluate analytics alternatives and jump to the detailed comparison that fits your decision." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/alternatives" />
  <meta property="og:image" content="${baseUrl}/og/alternatives" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam Alternatives Hub" />
  <meta name="twitter:description" content="Honest Beam comparisons across GA, Cloudflare Web Analytics, Plausible, Fathom, Umami, Matomo, Simple Analytics, and Rybbit." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Beam Alternatives Hub',
    itemListElement: options.map((option, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: option.label,
      url: `${baseUrl}${option.href}`,
    })),
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-5xl mx-auto px-6 py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Comparison Hub</p>
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight text-gray-900">Beam Alternatives: Find the Right Analytics Fit</h1>
  <p class="mt-5 text-lg text-gray-600 max-w-3xl">
    This hub is for teams actively evaluating analytics options. Every comparison below is intentionally honest: where Beam wins, where another tool is stronger, and which detailed page to read next.
  </p>

  ${alternativesCards(options)}

  <section class="mt-12 rounded-2xl bg-gray-50 p-8">
    <h2 class="text-2xl font-bold text-gray-900">Need to test before deciding?</h2>
    <p class="mt-3 text-gray-700">Use the demo, then follow setup docs or migration guidance to validate implementation in your own stack.</p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="/demo" class="inline-block rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Try the demo</a>
      <a href="/signup" class="inline-block rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">Create free account</a>
      <a href="/switch" class="inline-block rounded-xl border border-indigo-600 px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-50">Calculate your savings</a>
    </div>
    <p class="mt-4 text-sm text-gray-600">
      Implementation help:
      <a href="/migrate" class="text-indigo-700 hover:underline">migration hub</a>,
      <a href="/for" class="text-indigo-700 hover:underline">setup guides hub</a>,
      <a href="/for/nextjs" class="text-indigo-700 hover:underline">Next.js guide</a>,
      <a href="/beam-analytics-alternative" class="text-indigo-700 hover:underline">shutdown migration checklist</a>.
    </p>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Google Analytics ────────────────────────────────────────────────────────

app.get('/vs/google-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Google Analytics — Privacy-First Alternative</title>
  <meta name="description" content="Comparing Beam vs Google Analytics: cookie-free, GDPR-compliant, no data sharing with Google. Beam gives you clean analytics without the privacy baggage." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/google-analytics" />
  <meta property="og:title" content="Beam vs Google Analytics — Privacy-First Alternative" />
  <meta property="og:description" content="Cookie-free, GDPR-compliant analytics for $0/mo. No data sent to Google. Switch to Beam." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/google-analytics" />
  <meta property="og:image" content="${baseUrl}/og/vs-google-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Google Analytics" />
  <meta name="twitter:description" content="Cookie-free, GDPR-compliant analytics. No data sent to Google." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Is Beam a good replacement for Google Analytics?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Beam tracks pageviews, referrers, top pages, countries, browsers, and devices — without any cookies or data sent to Google. No consent banner required." } },
      { "@type": "Question", "name": "Does Beam require a cookie consent banner?", "acceptedAnswer": { "@type": "Answer", "text": "No. Beam is cookieless and collects no personal data, so no consent banner is required under GDPR, CCPA, or PECR." } },
      { "@type": "Question", "name": "Is Beam free?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Beam has a free tier covering 1 site and up to 50,000 pageviews per month. The Pro plan is $5/month for unlimited sites and up to 500,000 pageviews." } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Google Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Google Analytics is the default choice for millions of sites — but it comes with serious privacy trade-offs. Beam gives you the numbers you need without sending your visitors' data to Google.</p>
  <div class="mb-12 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 sm:p-6">
    <p class="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Need implementation steps?</p>
    <p class="mt-2 text-gray-700">Use the dedicated <a href="/migrate/google-analytics" class="text-indigo-700 hover:underline">Google Analytics migration checklist</a> to remove GA tags, install Beam, and verify first pageviews/events.</p>
  </div>

  ${comparisonTable([
    { feature: 'Pricing', beam: 'Free / $5/mo', competitor: 'Free (data is the product)', beamWins: true },
    { feature: 'Cookies used', beam: 'None', competitor: 'Yes (1st-party by default)', beamWins: true },
    { feature: 'GDPR compliant', beam: 'Yes — out of the box', competitor: 'Requires consent banner + DPA', beamWins: true },
    { feature: 'CCPA compliant', beam: 'Yes', competitor: 'Requires configuration', beamWins: true },
    { feature: 'Consent banner needed', beam: 'No', competitor: 'Yes', beamWins: true },
    { feature: 'Data ownership', beam: 'Your data, your servers', competitor: 'Google owns and processes data', beamWins: true },
    { feature: 'Script size', beam: '< 2 KB', competitor: '~50 KB (GA4)', beamWins: true },
    { feature: 'Setup complexity', beam: 'One script tag', competitor: 'Tag Manager or gtag.js + config', beamWins: true },
    { feature: 'Dashboard simplicity', beam: 'Clean, focused metrics', competitor: 'Highly complex (steep learning curve)', beamWins: true },
    { feature: 'Real-time data', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Ad integration', beam: 'Not applicable', competitor: 'Deep Google Ads integration', beamWins: false },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Google Analytics 4 is powerful, but that power comes at a cost. Every pageview your visitors
      generate is sent to Google's servers, where it feeds into their advertising infrastructure.
      Even with IP anonymization enabled, GA4 still requires a cookie consent banner in the EU under
      GDPR — meaning a significant share of your visitors will opt out and disappear from your data.
    </p>
    <p>
      Beam takes the opposite approach. The tracking script collects only what you need — page paths,
      referrers, country, device type, and browser — without any cookies or persistent identifiers.
      There's no PII involved, so no consent banner is required anywhere in the world. Your analytics
      data stays on Cloudflare's infrastructure and is never shared with third parties.
    </p>
    <p>
      For most site owners, Google Analytics offers far more complexity than they need. Beam's
      dashboard surfaces the metrics that actually matter — visitors, pageviews, top pages, referrers,
      and geographic breakdown — in a clean interface you can understand at a glance. If you're tired
      of wrestling with GA4's event model or worried about privacy compliance, Beam is a straightforward
      drop-in replacement.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam with the best-known indie privacy analytics SaaS.' },
    { href: '/vs/umami', label: 'Beam vs Umami', description: 'See the trade-off between self-hosted open source flexibility and hosted simplicity.' },
    { href: '/vs/matomo', label: 'Beam vs Matomo', description: 'Understand where a heavyweight self-hosted suite is overkill for simple analytics.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Cloudflare Web Analytics ───────────────────────────────────────────────

app.get('/vs/cloudflare-web-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Cloudflare Web Analytics — Decision-Ready Analytics on Cloudflare</title>
  <meta name="description" content="Compare Beam and Cloudflare Web Analytics on setup, privacy, events/goals, source clarity, alerts, and pricing. Honest guidance on when each is the better fit." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/cloudflare-web-analytics" />
  <meta property="og:title" content="Beam vs Cloudflare Web Analytics" />
  <meta property="og:description" content="Cloudflare is the simplest free baseline. Beam adds source clarity, goals/events, and change alerts for decision-making." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/cloudflare-web-analytics" />
  <meta property="og:image" content="${baseUrl}/og/vs-cloudflare-web-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Cloudflare Web Analytics" />
  <meta name="twitter:description" content="Cloudflare is the easier baseline; Beam is stronger when you need actionable analytics." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Is Cloudflare Web Analytics free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Cloudflare Web Analytics is included for Cloudflare zones and is often the easiest no-cost baseline for simple traffic visibility.' } },
      { '@type': 'Question', name: 'Why choose Beam over Cloudflare Web Analytics?', acceptedAnswer: { '@type': 'Answer', text: 'Choose Beam when you need decision-ready analytics beyond baseline counts: goals and custom events, stronger source/channel clarity, and change alerts that flag shifts automatically.' } },
      { '@type': 'Question', name: 'When is Cloudflare Web Analytics the better choice?', acceptedAnswer: { '@type': 'Answer', text: 'If your site already runs on Cloudflare and you only need a lightweight free heartbeat metric with minimal setup, Cloudflare Web Analytics is often the simplest answer.' } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Cloudflare Web Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Cloudflare Web Analytics is a strong default for teams already on Cloudflare: it is free, private, and easy to enable. Beam serves a different use case: helping teams move from passive traffic checks to clearer decisions with goals, source context, and alerts.</p>

  ${comparisonTable([
    { feature: 'Setup model', beam: 'Create Beam site + paste script', competitor: 'Toggle in Cloudflare dashboard', beamWins: false },
    { feature: 'Privacy posture', beam: 'Cookieless, no PII, no consent banner', competitor: 'Cookieless, privacy-focused', beamWins: false },
    { feature: 'Goals and custom events', beam: 'Yes', competitor: 'No goals/events workflow', beamWins: true },
    { feature: 'Traffic channels', beam: 'Organic, direct, referral, paid, social, email', competitor: 'High-level source views', beamWins: true },
    { feature: 'Change alerts and insights', beam: 'Daily anomaly alerts + weekly digest insights', competitor: 'No built-in alerting workflow', beamWins: true },
    { feature: 'API access', beam: 'REST API for pageviews, events, and goals', competitor: 'No public analytics API', beamWins: true },
    { feature: 'Embeddable badges', beam: 'Public share links + embeddable stat badges', competitor: 'No share or embed support', beamWins: true },
    { feature: 'Pricing', beam: 'Free tier + $5/mo Pro (500K pv)', competitor: 'Included with Cloudflare', beamWins: false },
    { feature: 'Best fit', beam: 'Teams needing decision-ready analytics', competitor: 'Teams wanting the lightest free baseline', beamWins: false },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Cloudflare Web Analytics is credible for what it is designed to be: a lightweight, privacy-first
      dashboard directly inside Cloudflare. If your goal is a quick pulse-check and your traffic stack
      already lives in Cloudflare, it is hard to beat the setup speed and zero incremental cost.
    </p>
    <p>
      Beam is a better fit when your team needs more than passive totals. It adds explicit goals and
      custom events, clearer traffic source/channel interpretation, and automated change detection so
      you can catch meaningful shifts without watching charts all day.
    </p>
    <p>
      The practical decision is simple. Choose Cloudflare Web Analytics for the easiest free baseline.
      Choose Beam when you need analytics that actively support decisions on content, campaigns, and
      conversion behavior while staying privacy-first and lightweight.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/google-analytics', label: 'Beam vs Google Analytics', description: 'See how Beam compares when privacy and consent friction are core concerns.' },
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam with another hosted privacy-first analytics option.' },
    { href: '/vs/umami', label: 'Beam vs Umami', description: 'Evaluate hosted simplicity against open-source self-hosting flexibility.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Vercel Analytics ───────────────────────────────────────────────────────

app.get('/vs/vercel-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Vercel Analytics — Privacy-First Analytics Beyond Hosting Lock-In</title>
  <meta name="description" content="Compare Beam and Vercel Analytics on framework lock-in, privacy defaults, goals/events, channel clarity, dashboards, and pricing fit. Honest guidance for Next.js teams." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/vercel-analytics" />
  <meta property="og:title" content="Beam vs Vercel Analytics" />
  <meta property="og:description" content="Vercel is the easiest native path for Vercel-hosted Next.js apps. Beam is stronger when you want privacy-first analytics without ecosystem lock-in." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/vercel-analytics" />
  <meta property="og:image" content="${baseUrl}/og/vs-vercel-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Vercel Analytics" />
  <meta name="twitter:description" content="Compare framework lock-in, privacy posture, goals/events, source clarity, dashboards, and pricing fit." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Is Vercel Analytics the best option for every Next.js app?', acceptedAnswer: { '@type': 'Answer', text: 'It is often the easiest default for teams fully committed to Vercel hosting. If you need analytics portability across multiple stacks or providers, Beam is usually the better fit.' } },
      { '@type': 'Question', name: 'Does Beam still work well for Next.js?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Beam has a dedicated Next.js setup guide, supports both App Router and Pages Router, and keeps a cookie-free privacy posture with a lightweight script.' } },
      { '@type': 'Question', name: 'What is the core trade-off between Beam and Vercel Analytics?', acceptedAnswer: { '@type': 'Answer', text: 'Vercel Analytics wins on native Vercel integration speed. Beam wins on cross-platform flexibility, privacy-first positioning, and decision-ready traffic interpretation across stacks.' } },
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Vercel Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Vercel Analytics is a natural choice if your stack is entirely Vercel + Next.js. Beam targets teams that want privacy-first analytics they can carry across frameworks, hosts, and marketing properties without ecosystem lock-in.</p>

  ${comparisonTable([
    { feature: 'Framework lock-in', beam: 'Works across frameworks and hosts', competitor: 'Tightest fit in Vercel + Next.js workflows', beamWins: true },
    { feature: 'Privacy posture', beam: 'Cookieless, no PII, consent-banner friendly', competitor: 'Privacy-focused telemetry with Vercel-native defaults', beamWins: false },
    { feature: 'Custom events and goals', beam: 'Built-in custom events + goals workflows', competitor: 'Event tooling optimized for Vercel product stack', beamWins: true },
    { feature: 'Source/channel clarity', beam: 'Referrer + channel views designed for acquisition decisions', competitor: 'Traffic visibility inside Vercel dashboards', beamWins: true },
    { feature: 'Dashboard focus', beam: 'Decision-ready web analytics dashboard', competitor: 'Developer-centric observability + traffic in Vercel UI', beamWins: false },
    { feature: 'Pricing / free-tier fit', beam: 'Free tier + $5/mo managed upgrade path', competitor: 'Depends on Vercel plan context and Vercel-hosted usage', beamWins: true },
    { feature: 'Best fit', beam: 'Multi-site teams needing portability + privacy-first reporting', competitor: 'Teams fully standardized on Vercel hosting', beamWins: false },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Vercel Analytics is easier when your architecture and workflow already live inside Vercel. You can
      turn on analytics with very little operational overhead and keep traffic visibility close to the
      rest of your deployment tooling.
    </p>
    <p>
      Beam is stronger when analytics must survive infrastructure changes or span multiple properties
      that are not all running on Vercel. It keeps the same privacy-first approach while offering
      clearer acquisition/channel interpretation and goals/events that are focused on decision support
      instead of platform-specific telemetry.
    </p>
    <p>
      For Next.js teams specifically, Beam includes a dedicated setup path at
      <a href="/for/nextjs" class="text-indigo-700 hover:underline">/for/nextjs</a> and a
      <a href="/demo" class="text-indigo-700 hover:underline">live demo</a> so you can validate fit quickly before committing.
    </p>
  </div>

  <section class="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-8">
    <h2 class="text-2xl font-bold text-gray-900">When Vercel Analytics is the easier choice</h2>
    <p class="mt-3 text-gray-700">
      If your team is all-in on Vercel hosting, does not need cross-host portability, and primarily wants
      built-in analytics close to deployment tooling, Vercel Analytics is usually the shortest path.
      Beam is a better fit once portability, broader channel visibility, or independent analytics ownership
      becomes a requirement.
    </p>
  </section>

  ${relatedComparisons([
    { href: '/vs/google-analytics', label: 'Beam vs Google Analytics', description: 'Compare Beam with the default analytics incumbent when privacy and consent friction matter.' },
    { href: '/vs/cloudflare-web-analytics', label: 'Beam vs Cloudflare Web Analytics', description: 'See the trade-off between a free baseline and a decision-ready analytics workflow.' },
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam with another hosted privacy-first analytics option.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Plausible ───────────────────────────────────────────────────────────────

app.get('/vs/plausible', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Plausible Analytics — A More Affordable Privacy-First Option</title>
  <meta name="description" content="Beam vs Plausible Analytics: same privacy-first philosophy, half the price. Beam starts free and costs $5/mo for Pro vs Plausible's $9–$69/mo pricing." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/plausible" />
  <meta property="og:title" content="Beam vs Plausible Analytics — More Affordable Privacy Analytics" />
  <meta property="og:description" content="Plausible is great but costs $9+/mo. Beam gives you the same cookie-free, GDPR-compliant analytics starting free." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/plausible" />
  <meta property="og:image" content="${baseUrl}/og/vs-plausible" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Plausible Analytics" />
  <meta name="twitter:description" content="Same privacy-first analytics at a lower price. Beam starts free." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "How is Beam different from Plausible Analytics?", "acceptedAnswer": { "@type": "Answer", "text": "Both are privacy-first and cookieless. The main difference is pricing: Beam has a free tier and costs $5/mo for Pro, while Plausible starts at $9/mo with no free tier." } },
      { "@type": "Question", "name": "Is Beam as privacy-friendly as Plausible?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Like Plausible, Beam uses no cookies, collects no personal data, and requires no consent banner anywhere in the world." } },
      { "@type": "Question", "name": "Can Beam replace Plausible for my site?", "acceptedAnswer": { "@type": "Answer", "text": "For most use cases, yes. Beam covers pageviews, referrers, countries, browsers, and devices. Plausible has advanced features like custom events and funnels if you need them." } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Plausible Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Plausible is one of the most respected privacy-first analytics tools — and for good reason. But at $9–$69/mo, it can be expensive for smaller sites and indie developers. Beam offers the same core philosophy at a fraction of the cost.</p>

  ${comparisonTable([
    { feature: 'Entry price', beam: 'Free (up to 50K pv/mo)', competitor: '$9/mo (up to 10K pv/mo)', beamWins: true },
    { feature: 'Pro pricing', beam: '$5/mo (500K pv/mo)', competitor: '$9–$69/mo depending on pageviews', beamWins: true },
    { feature: 'Cookies used', beam: 'None', competitor: 'None', beamWins: false },
    { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Consent banner needed', beam: 'No', competitor: 'No', beamWins: false },
    { feature: 'Script size', beam: '< 2 KB', competitor: '< 1 KB', beamWins: false },
    { feature: 'Open source', beam: 'No (hosted SaaS)', competitor: 'Yes (AGPL)', beamWins: false },
    { feature: 'Self-hostable', beam: 'No', competitor: 'Yes (requires server)', beamWins: false },
    { feature: 'Built on', beam: 'Cloudflare edge network', competitor: 'Elixir / PostgreSQL', beamWins: false },
    { feature: 'Free tier', beam: 'Yes — 1 site, 50K pv/mo', competitor: 'No free tier (30-day trial)', beamWins: true },
    { feature: 'Dashboard clarity', beam: 'Clean, single-page view', competitor: 'Clean, single-page view', beamWins: false },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Plausible Analytics is genuinely excellent software. It pioneered the "simple, privacy-respecting
      analytics" category and has earned a loyal following among developers who care about privacy.
      Both Beam and Plausible collect no cookies, store no PII, and require no consent banners. If you're
      choosing between the two on privacy grounds alone, either is a solid choice.
    </p>
    <p>
      Where Beam stands apart is pricing. Plausible's plans start at $9/mo with no free tier — which
      is reasonable for established businesses, but steep for hobbyist projects, side hustles, or
      developers running multiple sites. Beam's free tier covers 1 site up to 50,000 pageviews per month,
      making it genuinely useful for smaller projects at no cost. The Pro plan at $5/mo is roughly
      half what Plausible charges for comparable pageview limits.
    </p>
    <p>
      Plausible has some advantages worth acknowledging: it's open source (you can self-host), has a
      more mature feature set (funnels, goals, custom events), and a larger community. If you need
      those features, Plausible is worth its price. But if you want clean, private, cookie-free
      analytics without paying $9+ per month per set of sites, Beam is the more affordable path.
    </p>
    <p>
      Already running Plausible in production? Use the dedicated
      <a href="/migrate/plausible" class="text-indigo-700 hover:underline">Plausible migration guide</a>
      for script replacement and install verification steps, then validate your pages with the
      <a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">stack scanner</a> and framework setup docs like
      <a href="/for/nextjs" class="text-indigo-700 hover:underline">/for/nextjs</a> or
      <a href="/for/wordpress" class="text-indigo-700 hover:underline">/for/wordpress</a>.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/fathom', label: 'Beam vs Fathom', description: 'See how Beam stacks up against the premium privacy analytics incumbent.' },
    { href: '/vs/simple-analytics', label: 'Beam vs Simple Analytics', description: 'Compare two minimalist privacy-first dashboards with different pricing models.' },
    { href: '/vs/umami', label: 'Beam vs Umami', description: 'Compare hosted convenience with the open-source self-hosting path.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Fathom ──────────────────────────────────────────────────────────────────

app.get('/vs/fathom', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Fathom Analytics — Privacy Analytics at Half the Price</title>
  <meta name="description" content="Beam vs Fathom Analytics: both are cookie-free and GDPR-compliant, but Fathom costs $15/mo. Beam gives you private analytics starting free, Pro at $5/mo." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/fathom" />
  <meta property="og:title" content="Beam vs Fathom Analytics — Privacy Analytics at Half the Price" />
  <meta property="og:description" content="Fathom Analytics costs $15/mo. Beam offers the same cookie-free, GDPR-compliant analytics for free or $5/mo." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/fathom" />
  <meta property="og:image" content="${baseUrl}/og/vs-fathom" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Fathom Analytics" />
  <meta name="twitter:description" content="Same cookie-free, GDPR-compliant analytics at a lower price." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Why is Beam cheaper than Fathom Analytics?", "acceptedAnswer": { "@type": "Answer", "text": "Beam is built on Cloudflare's edge infrastructure which has a generous free tier, allowing lower prices. Fathom starts at $15/mo; Beam's Pro plan is $5/mo with a free tier available." } },
      { "@type": "Question", "name": "Does Beam work without cookies like Fathom?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Both Beam and Fathom are completely cookieless and GDPR-compliant without requiring a consent banner." } },
      { "@type": "Question", "name": "Is Beam as reliable as Fathom?", "acceptedAnswer": { "@type": "Answer", "text": "Beam runs on Cloudflare's global edge network with high availability. Fathom offers a 99.99% uptime SLA. For most site owners, both provide reliable analytics collection." } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Fathom Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Fathom Analytics is a premium privacy-first analytics tool with a strong reputation for reliability and simplicity. But at $15/mo as an entry price, it's priced for established businesses. Beam delivers the same core privacy guarantees starting free.</p>
  <div class="mb-12 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 sm:p-6">
    <p class="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Need implementation steps?</p>
    <p class="mt-2 text-gray-700">Use the dedicated <a href="/migrate/fathom" class="text-indigo-700 hover:underline">Fathom migration guide</a> for script cutover, fit checks, and install verification. Follow with the <a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">stack scanner</a> and setup docs in <a href="/for" class="text-indigo-700 hover:underline">/for</a>.</p>
  </div>

  ${comparisonTable([
    { feature: 'Entry price', beam: 'Free (up to 50K pv/mo)', competitor: '$15/mo (unlimited sites, 100K pv/mo)', beamWins: true },
    { feature: 'Pro pricing', beam: '$5/mo (500K pv/mo)', competitor: '$15–$45+/mo', beamWins: true },
    { feature: 'Cookies used', beam: 'None', competitor: 'None', beamWins: false },
    { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'CCPA / PECR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Consent banner needed', beam: 'No', competitor: 'No', beamWins: false },
    { feature: 'Script size', beam: '< 2 KB', competitor: '< 2 KB', beamWins: false },
    { feature: 'Free tier', beam: 'Yes — 1 site, 50K pv/mo', competitor: 'No (7-day trial only)', beamWins: true },
    { feature: 'Uptime SLA', beam: 'Cloudflare edge (99.9%+)', competitor: '99.99% uptime guarantee', beamWins: false },
    { feature: 'Custom domains (script)', beam: 'No', competitor: 'Yes (bypass ad blockers)', beamWins: false },
    { feature: 'EU-based infrastructure', beam: 'Cloudflare global edge', competitor: 'EU servers available', beamWins: false },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Fathom Analytics is a well-built product with a clear focus on privacy, simplicity, and
      reliability. Like Beam, it uses no cookies, stores no PII, and is fully GDPR-compliant without
      requiring a consent banner. Both tools share the same core philosophy — give site owners the
      traffic data they need without compromising their visitors' privacy.
    </p>
    <p>
      The main difference is pricing. Fathom's entry plan starts at $15/mo, which includes unlimited
      sites and 100,000 pageviews. That's a reasonable deal if you're running multiple sites, but it's
      a lot to pay just to see how many people visit your blog or side project. Beam's free tier covers
      one site up to 50,000 pageviews per month — genuinely free, no trial period, no credit card. The
      $5/mo Pro plan covers up to 500,000 pageviews across unlimited sites, which is a significant
      saving compared to Fathom's entry price.
    </p>
    <p>
      Fathom does have some advantages: a longer track record, a custom domain feature that helps
      bypass ad blockers, and a 99.99% uptime guarantee. If those features matter to your use case,
      Fathom is worth the premium. For most site owners who just want clean, private analytics without
      overpaying, Beam offers the same core functionality at a much lower price point.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam with another cookieless hosted analytics product.' },
    { href: '/vs/matomo', label: 'Beam vs Matomo', description: 'See how Beam compares when you want simpler setup than a traditional suite.' },
    { href: '/vs/simple-analytics', label: 'Beam vs Simple Analytics', description: 'Compare Beam against another privacy-focused SaaS with a lightweight dashboard.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Umami ───────────────────────────────────────────────────────────────────

app.get('/vs/umami', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Umami Analytics — Hosted Simplicity vs Self-Hosted Flexibility</title>
  <meta name="description" content="Beam vs Umami Analytics: compare a hosted privacy-first analytics service with Umami's open-source self-hosted approach." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/umami" />
  <meta property="og:title" content="Beam vs Umami Analytics — Hosted Simplicity vs Self-Hosted Flexibility" />
  <meta property="og:description" content="Umami is open source and self-hostable. Beam is the faster hosted path if you want private analytics without running servers." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/umami" />
  <meta property="og:image" content="${baseUrl}/og/vs-umami" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Umami Analytics" />
  <meta name="twitter:description" content="Compare Beam with Umami's open-source self-hosted analytics model." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Is Umami free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Umami is open source and can be self-hosted for free, but you still pay for your own server, database, maintenance, and backups.' } },
      { '@type': 'Question', name: 'Why choose Beam over Umami?', acceptedAnswer: { '@type': 'Answer', text: 'Choose Beam if you want a hosted setup with no server maintenance, no Docker stack, and pricing that starts free. Choose Umami if open source control and self-hosting matter more than convenience.' } },
      { '@type': 'Question', name: 'Does Umami support more advanced analytics than Beam?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Umami supports custom events, funnels, retention, and more advanced product analytics features. Beam is intentionally simpler and focused on fast website analytics.' } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Umami Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Umami is one of the strongest open-source privacy analytics tools available. If you want to run your own stack, it's excellent. Beam is for the opposite buyer: someone who wants privacy-first analytics without touching infrastructure.</p>

  ${comparisonTable([
    { feature: 'Entry price', beam: 'Free (1 site, 50K pv/mo)', competitor: 'Software is free; hosting costs extra', beamWins: true },
    { feature: 'Hosting model', beam: 'Fully hosted SaaS', competitor: 'Self-hosted by default; cloud available', beamWins: true },
    { feature: 'Setup complexity', beam: 'Create account + paste script', competitor: 'Deploy app + database + updates', beamWins: true },
    { feature: 'Open source', beam: 'No', competitor: 'Yes', beamWins: false },
    { feature: 'Self-hostable', beam: 'No', competitor: 'Yes', beamWins: false },
    { feature: 'Cookies used', beam: 'None', competitor: 'None', beamWins: false },
    { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Tracking script', beam: '< 2 KB', competitor: '< 2 KB', beamWins: false },
    { feature: 'Advanced product analytics', beam: 'Not the focus', competitor: 'Funnels, retention, events', beamWins: false },
    { feature: 'Ongoing maintenance', beam: 'None for customers', competitor: 'You handle infra, updates, backups', beamWins: true },
    { feature: 'Best fit', beam: 'Simple hosted website analytics', competitor: 'Teams wanting open-source control', beamWins: true },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Umami has earned its reputation. It is open source, privacy-focused, and flexible enough to cover
      both simple website analytics and more product-style use cases. If you want full control of your
      deployment and are comfortable running your own application plus database, Umami is a serious option.
    </p>
    <p>
      The trade-off is operational cost, not just subscription cost. Even if the software itself is free,
      you still need somewhere to run it. Umami's own docs point users toward self-hosting on providers
      like DigitalOcean, where a starter server begins around $5/month before database, backups, and your
      own time. For a developer who enjoys owning the stack, that is fine. For everyone else, it is work.
    </p>
    <p>
      Beam is intentionally narrower. It skips the extra layers and gives you hosted, cookie-free analytics
      with a script tag and a clean dashboard. If your priority is "private analytics online in five minutes,"
      Beam is the simpler path. If your priority is open-source control and extensibility, Umami is stronger.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/matomo', label: 'Beam vs Matomo', description: 'Compare Beam with another self-hosted-first analytics product.' },
    { href: '/vs/simple-analytics', label: 'Beam vs Simple Analytics', description: 'See how Beam compares to a hosted minimalist privacy analytics SaaS.' },
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam against another indie-friendly hosted privacy analytics tool.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Matomo ──────────────────────────────────────────────────────────────────

app.get('/vs/matomo', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Matomo — Simpler Hosted Analytics vs Full Self-Hosted Suite</title>
  <meta name="description" content="Beam vs Matomo: compare fast, privacy-first hosted analytics with Matomo's free on-premise and paid cloud analytics suite." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/matomo" />
  <meta property="og:title" content="Beam vs Matomo — Simpler Hosted Analytics vs Full Self-Hosted Suite" />
  <meta property="og:description" content="Matomo offers deep analytics and a free self-hosted edition. Beam is the better fit if you want a simpler hosted analytics stack." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/matomo" />
  <meta property="og:image" content="${baseUrl}/og/vs-matomo" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Matomo" />
  <meta name="twitter:description" content="Compare Beam against Matomo's self-hosted and cloud analytics options." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Is Matomo free?', acceptedAnswer: { '@type': 'Answer', text: 'Matomo On-Premise is free to download and self-host. Matomo Cloud is paid and current official pricing starts around £17 per month on its public trial page.' } },
      { '@type': 'Question', name: 'Why would someone choose Beam instead of Matomo?', acceptedAnswer: { '@type': 'Answer', text: 'Beam is much simpler. It focuses on the core website analytics most teams actually use, with hosted setup, no cookie banners, and no self-hosting overhead.' } },
      { '@type': 'Question', name: 'Does Matomo do more than Beam?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Matomo is a larger analytics suite with more reporting depth, plugins, and enterprise-style controls. Beam is designed for speed, simplicity, and lower cost.' } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Matomo</h1>
  <p class="text-xl text-gray-500 mb-12">Matomo is one of the oldest privacy-focused analytics platforms and offers far more depth than Beam. That depth is useful for some teams, but for many sites it also means more setup, more moving parts, and more product than they need.</p>

  ${comparisonTable([
    { feature: 'Entry price', beam: 'Free / $5/mo Pro', competitor: 'Free self-hosted or paid cloud', beamWins: false },
    { feature: 'Cloud pricing', beam: '$5/mo for 500K pv', competitor: 'Cloud starts around £17/mo', beamWins: true },
    { feature: 'Hosting model', beam: 'Hosted SaaS', competitor: 'On-premise or cloud', beamWins: true },
    { feature: 'Open source', beam: 'No', competitor: 'Yes', beamWins: false },
    { feature: 'Self-hostable', beam: 'No', competitor: 'Yes', beamWins: false },
    { feature: 'Setup complexity', beam: 'Minimal', competitor: 'Moderate to high', beamWins: true },
    { feature: 'Product depth', beam: 'Core web analytics', competitor: 'Full analytics suite + plugins', beamWins: false },
    { feature: 'Privacy-first defaults', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Cookie banner required', beam: 'No', competitor: 'Can be no, with privacy-friendly setup', beamWins: true },
    { feature: 'Ideal customer', beam: 'Teams wanting simple reporting fast', competitor: 'Teams needing broad analytics depth and control', beamWins: true },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Matomo is closer to a platform than a lightweight analytics tool. It offers self-hosting, cloud
      hosting, deep reporting, plugins, tag management, and broader enterprise positioning. If you need
      advanced customization, internal governance, or full infrastructure control, Matomo brings a lot
      to the table that simpler tools intentionally leave out.
    </p>
    <p>
      The cost of that flexibility is complexity. Even Matomo's free self-hosted option still means
      running PHP, MySQL or MariaDB, storage, upgrades, and operational maintenance. The hosted cloud
      option removes some of that work, but it also moves Matomo into a much higher price bracket than
      Beam for a small team or independent site owner.
    </p>
    <p>
      Beam is the opposite philosophy. It is not trying to replace a full analytics suite. It is for
      site owners who want pageviews, referrers, countries, browsers, devices, and a clean dashboard
      without the operational drag. If Matomo feels powerful but heavy, Beam is the lighter answer.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/umami', label: 'Beam vs Umami', description: 'Compare Beam with another self-hosted-first privacy analytics stack.' },
    { href: '/vs/google-analytics', label: 'Beam vs Google Analytics', description: 'See the privacy and complexity trade-offs against the default market leader.' },
    { href: '/vs/simple-analytics', label: 'Beam vs Simple Analytics', description: 'Compare Beam with a hosted privacy-focused product at a higher price point.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Simple Analytics ────────────────────────────────────────────────────────

app.get('/vs/simple-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Simple Analytics — Minimalist Privacy Analytics at a Lower Price</title>
  <meta name="description" content="Beam vs Simple Analytics: both are privacy-first and cookie-free, but Beam offers a lower-cost hosted path for small sites and startups." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/simple-analytics" />
  <meta property="og:title" content="Beam vs Simple Analytics — Minimalist Privacy Analytics at a Lower Price" />
  <meta property="og:description" content="Compare Beam with Simple Analytics on pricing, privacy, setup, and the right fit for small teams." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/simple-analytics" />
  <meta property="og:image" content="${baseUrl}/og/vs-simple-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Simple Analytics" />
  <meta name="twitter:description" content="Both are cookieless. Beam is the lower-cost option for hosted privacy analytics." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Is Simple Analytics privacy-friendly?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Simple Analytics is cookieless, privacy-focused, and explicitly positions itself as GDPR compliant.' } },
      { '@type': 'Question', name: 'How does Beam compare on price?', acceptedAnswer: { '@type': 'Answer', text: 'Beam has a free tier and a $5/month Pro plan. Simple Analytics currently advertises a free plan plus a paid Simple plan starting around £15 per month.' } },
      { '@type': 'Question', name: 'Which is better for a small startup?', acceptedAnswer: { '@type': 'Answer', text: 'If cost sensitivity is the main issue, Beam is the better fit. If you want a more mature team product with features like role-based access and a larger brand footprint, Simple Analytics may be worth the higher price.' } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Simple Analytics</h1>
  <p class="text-xl text-gray-500 mb-12">Simple Analytics is one of the cleanest privacy analytics products on the market. It shares Beam's "less surveillance, less clutter" philosophy. The main difference is that Beam is built to be the lower-cost option for small teams and indie projects.</p>

  ${comparisonTable([
    { feature: 'Entry price', beam: 'Free (1 site, 50K pv/mo)', competitor: 'Free plan + £15/mo paid tier', beamWins: true },
    { feature: 'Pro pricing', beam: '$5/mo (500K pv/mo)', competitor: 'Paid plans start around £15/mo', beamWins: true },
    { feature: 'Cookies used', beam: 'None', competitor: 'None', beamWins: false },
    { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Hosted product', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Setup complexity', beam: 'Minimal', competitor: 'Minimal', beamWins: false },
    { feature: 'Retention on free plan', beam: 'Monthly usage limits', competitor: '30-day history on free', beamWins: true },
    { feature: 'Team features', beam: 'Basic single-user flow', competitor: 'Stronger team/admin features', beamWins: false },
    { feature: 'Best fit', beam: 'Budget-conscious teams wanting core analytics', competitor: 'Teams wanting a mature hosted privacy analytics product', beamWins: true },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <p>
      Beam and Simple Analytics are philosophically close. Both reject cookies, both avoid personal data
      collection, and both focus on dashboards that stay readable. If your main requirement is "give me
      privacy-friendly website analytics without Google Analytics baggage," either product is aligned with that goal.
    </p>
    <p>
      The practical difference is price and product maturity. Simple Analytics currently markets a free
      plan and a paid tier that starts around £15 per month, with stronger team and admin capabilities
      at higher tiers. Beam is intentionally simpler and cheaper: a free tier for small projects, and a
      $5/month Pro plan for teams that mainly want clean traffic reporting rather than a broader analytics workspace.
    </p>
    <p>
      If you want the leanest hosted option and care most about keeping spend down, Beam is the easier
      recommendation. If you are happy paying more for a more established product with extra collaboration
      features and a longer track record, Simple Analytics is a credible alternative.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam with another premium privacy-focused hosted analytics tool.' },
    { href: '/vs/fathom', label: 'Beam vs Fathom', description: 'See how Beam stacks up against another polished hosted privacy analytics product.' },
    { href: '/vs/umami', label: 'Beam vs Umami', description: 'Compare Beam against the open-source self-hosted path instead of another hosted SaaS.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Rybbit ──────────────────────────────────────────────────────────────────

app.get('/vs/rybbit', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam vs Rybbit — Managed Analytics vs Open-Source Self-Hosting</title>
  <meta name="description" content="Beam vs Rybbit: compare pricing, hosting model, privacy, and features. Beam is $5/mo managed edge analytics; Rybbit is self-hosted AGPL open source with session replay." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/vs/rybbit" />
  <meta property="og:title" content="Beam vs Rybbit — Managed Analytics vs Open-Source Self-Hosting" />
  <meta property="og:description" content="Beam is managed, $5/mo, zero infrastructure. Rybbit is fully open source with session replay but requires a self-hosted server." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/vs/rybbit" />
  <meta property="og:image" content="${baseUrl}/og/vs-rybbit" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam vs Rybbit Analytics" />
  <meta name="twitter:description" content="Managed edge analytics vs self-hosted open source. Compare Beam and Rybbit." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Is Rybbit free?", "acceptedAnswer": { "@type": "Answer", "text": "Rybbit is open source (AGPL-3) and free to self-host, but you need to run and maintain your own server. The hosted cloud version starts at $13/month." } },
      { "@type": "Question", "name": "Does Beam have session replay like Rybbit?", "acceptedAnswer": { "@type": "Answer", "text": "No. Session replay is a Rybbit advantage — it records visitor sessions so you can watch how users navigate your site. Beam focuses on aggregate privacy-first analytics without PII, so session replay is outside its scope." } },
      { "@type": "Question", "name": "Which is better for a small team that doesn't want to manage servers?", "acceptedAnswer": { "@type": "Answer", "text": "Beam. It runs on Cloudflare's edge network and requires zero infrastructure management. You add a script tag and the data flows automatically. Rybbit's self-hosted path requires a server, Docker, and ongoing maintenance." } }
    ]
  })}</script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Comparison</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam vs Rybbit</h1>
  <p class="text-xl text-gray-500 mb-12">Rybbit is a fast-growing open-source analytics platform that launched in 2025 and reached 11,000+ GitHub stars. It offers session replay, funnels, and full AGPL-3 transparency. Beam takes a different path: managed edge hosting, lower price, and zero infrastructure for teams that want clean analytics without running a server.</p>

  ${comparisonTable([
    { feature: 'Pricing (hosted)', beam: 'Free / $5/mo Pro', competitor: '$13/mo Standard, $26/mo Pro', beamWins: true },
    { feature: 'Self-hostable', beam: 'No', competitor: 'Yes (requires server + Docker)', beamWins: false },
    { feature: 'Open source', beam: 'Tracking script only (MIT)', competitor: 'Fully open source (AGPL-3)', beamWins: false },
    { feature: 'Infrastructure required', beam: 'None — fully managed', competitor: 'Server, database, and Docker', beamWins: true },
    { feature: 'Cookies used', beam: 'None', competitor: 'None', beamWins: false },
    { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Consent banner needed', beam: 'No', competitor: 'No', beamWins: false },
    { feature: 'Script size', beam: '< 2 KB', competitor: '< 2 KB', beamWins: false },
    { feature: 'Session replay', beam: 'No', competitor: 'Yes', beamWins: false },
    { feature: 'Funnels', beam: 'No', competitor: 'Yes', beamWins: false },
    { feature: 'Custom events', beam: 'Yes', competitor: 'Yes', beamWins: false },
    { feature: 'Built on', beam: 'Cloudflare edge (Workers + D1)', competitor: 'Node.js / ClickHouse (self-host)', beamWins: false },
    { feature: 'GitHub community', beam: 'Smaller, growing', competitor: '11,000+ stars (active)', beamWins: false },
    { feature: 'Free tier (hosted)', beam: '1 site, 50K pv/mo', competitor: 'No hosted free tier', beamWins: true },
  ])}

  <div class="mt-12 space-y-6 text-gray-700 leading-relaxed">
    <h2 class="text-2xl font-bold text-gray-900">Where Rybbit Has the Edge</h2>
    <p>
      Rybbit is genuinely impressive for a product that launched in 2025. It's fully open source under the AGPL-3 license — not just the tracking script, but the entire platform. The GitHub community is active, with 11,000+ stars and growing. If you want to self-host and inspect every line of code, Rybbit is the better choice.
    </p>
    <p>
      Rybbit also has features Beam doesn't: session replay lets you watch how individual visitors interact with your site, and funnel analysis helps track multi-step conversion flows. These are meaningful advantages for teams that need behavioral analytics beyond traffic metrics.
    </p>

    <h2 class="text-2xl font-bold text-gray-900">Where Beam Has the Edge</h2>
    <p>
      The core Beam advantage is simplicity and cost. There's no server to provision, no Docker Compose to maintain, no database to back up. You add one script tag to your site and analytics flow into a managed Cloudflare-backed dashboard. The entire stack runs on Cloudflare's edge network — globally distributed, low latency, zero ops overhead.
    </p>
    <p>
      Pricing is the other differentiator. Beam's hosted Pro plan is $5/month with no pageview overage surprises. Rybbit's hosted Standard plan starts at $13/month, and the Pro tier at $26/month. If you want a hosted managed service rather than running your own infrastructure, Beam costs significantly less for equivalent pageview-level analytics.
    </p>
    <p>
      Beam also has a free tier — 1 site, up to 50,000 pageviews per month. Rybbit's cloud offering has no free tier at launch. For indie developers running side projects or early-stage sites, that free tier matters.
    </p>

    <h2 class="text-2xl font-bold text-gray-900">Which Should You Choose?</h2>
    <p>
      Choose <strong>Rybbit</strong> if: you want a fully open-source stack you can self-host and control entirely, you need session replay to understand how users navigate your site, or you want funnel analysis for multi-step conversions. The operational overhead is real but manageable for technically capable teams.
    </p>
    <p>
      Choose <strong>Beam</strong> if: you want managed analytics with zero infrastructure, you're watching your budget and $5/month beats $13/month, or you just need reliable traffic metrics without the overhead of running a server. Beam's free tier is a low-friction starting point for any new project.
    </p>
  </div>

  ${relatedComparisons([
    { href: '/vs/plausible', label: 'Beam vs Plausible', description: 'Compare Beam with the best-known indie privacy analytics SaaS — also managed, no self-hosting required.' },
    { href: '/vs/umami', label: 'Beam vs Umami', description: 'Another popular open-source self-hosted option; compare the self-hosting trade-off in detail.' },
    { href: '/vs/matomo', label: 'Beam vs Matomo', description: 'The original heavyweight self-hosted analytics — see how full feature depth compares to simplicity.' },
  ])}

  ${ctaSection()}
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Switch to Beam calculator ───────────────────────────────────────────────

app.get('/switch', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Switch to Beam — See How Much You'd Save on Analytics</title>
  <meta name="description" content="Calculate your annual savings by switching from Google Analytics, Plausible, Fathom, Matomo, or Simple Analytics to Beam. Beam is free up to 50K pageviews and $5/mo after that." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/switch" />
  <meta property="og:title" content="Switch to Beam — See How Much You'd Save" />
  <meta property="og:description" content="Compare your current analytics cost against Beam's free and $5/mo plans. Most indie sites save $60–$180/year." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/switch" />
  <meta property="og:image" content="${baseUrl}/og/landing" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Switch to Beam — See How Much You'd Save" />
  <meta name="twitter:description" content="Free up to 50K pageviews. $5/mo after that. Calculate your annual savings now." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">

  <div class="mb-2 text-sm text-indigo-600 font-medium uppercase tracking-wide">Savings Calculator</div>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">How much would you save by switching to Beam?</h1>
  <p class="text-xl text-gray-500 mb-12">Beam is free up to 50,000 pageviews/month and $5/mo after that. Enter your current provider and traffic volume to see your potential savings.</p>

  <!-- Calculator card -->
  <div class="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8 mb-10">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <label for="provider" class="block text-sm font-semibold text-gray-700 mb-2">Current analytics provider</label>
        <select id="provider" class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="google-analytics">Google Analytics (GA4)</option>
          <option value="plausible">Plausible</option>
          <option value="fathom">Fathom</option>
          <option value="rybbit">Rybbit</option>
          <option value="simple-analytics">Simple Analytics</option>
          <option value="matomo">Matomo Cloud</option>
        </select>
      </div>
      <div>
        <label for="pageviews" class="block text-sm font-semibold text-gray-700 mb-2">Monthly pageviews</label>
        <select id="pageviews" class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="10000">Under 10,000</option>
          <option value="25000">~25,000</option>
          <option value="50000" selected>~50,000</option>
          <option value="100000">~100,000</option>
          <option value="200000">~200,000</option>
          <option value="500000">~500,000</option>
          <option value="1000000">~1,000,000</option>
        </select>
      </div>
    </div>

    <!-- Results -->
    <div id="results" class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Current provider cost</p>
        <p id="current-cost" class="text-3xl font-extrabold text-gray-700">—</p>
        <p class="text-xs text-gray-400 mt-1">per month</p>
      </div>
      <div class="bg-white rounded-xl border border-indigo-200 p-5 text-center shadow-sm">
        <p class="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Beam cost</p>
        <p id="beam-cost" class="text-3xl font-extrabold text-indigo-600">—</p>
        <p class="text-xs text-gray-400 mt-1">per month</p>
      </div>
      <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-5 text-center shadow-sm">
        <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Annual savings</p>
        <p id="annual-savings" class="text-3xl font-extrabold text-emerald-700">—</p>
        <p class="text-xs text-gray-400 mt-1">per year</p>
      </div>
    </div>

    <p id="savings-note" class="mt-4 text-sm text-gray-600 text-center"></p>
  </div>

  <!-- CTA buttons -->
  <div class="flex flex-col sm:flex-row gap-4 justify-center mb-16">
    <a href="/demo" class="inline-flex justify-center items-center bg-emerald-600 text-white font-semibold px-7 py-4 rounded-xl hover:bg-emerald-700 transition-colors">Try the live demo</a>
    <a href="/signup" class="inline-flex justify-center items-center bg-indigo-600 text-white font-semibold px-7 py-4 rounded-xl hover:bg-indigo-700 transition-colors">Get started free</a>
  </div>

  <!-- Feature comparison table (dynamic per provider) -->
  <div id="comparison-section">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Feature comparison</h2>
    <div id="comparison-table" class="overflow-x-auto"></div>
  </div>

  ${ctaSection()}
</main>

${footer()}

<script>
(function () {
  // Provider pricing: returns monthly cost in USD for given pageview volume
  // 0 = free
  const PRICING = {
    'google-analytics': function (pv) {
      // GA4 is free; cost is opportunity/privacy cost, not $
      return 0;
    },
    'plausible': function (pv) {
      // Plausible pricing tiers (monthly): $9 up to 10K, $19 up to 100K,
      // $29 up to 200K, $39 up to 500K, $69 up to 1M
      if (pv <= 10000) return 9;
      if (pv <= 100000) return 19;
      if (pv <= 200000) return 29;
      if (pv <= 500000) return 39;
      return 69;
    },
    'fathom': function (pv) {
      // Fathom pricing: $15 up to 100K, $25 up to 200K, $50 up to 500K, $100 up to 1M
      if (pv <= 100000) return 15;
      if (pv <= 200000) return 25;
      if (pv <= 500000) return 50;
      return 100;
    },
    'rybbit': function (pv) {
      // Rybbit cloud: $13/mo Standard, $26/mo Pro (self-hosted is free)
      // Using cloud pricing
      if (pv <= 500000) return 13;
      return 26;
    },
    'simple-analytics': function (pv) {
      // Simple Analytics: $9/mo Starter (100K), $19/mo Business (1M)
      if (pv <= 100000) return 9;
      return 19;
    },
    'matomo': function (pv) {
      // Matomo Cloud pricing (approximate):
      // ~$23/mo for 50K, ~$36/mo for 100K, ~$52/mo for 200K, ~$80/mo for 500K, ~$123/mo for 1M
      if (pv <= 50000) return 23;
      if (pv <= 100000) return 36;
      if (pv <= 200000) return 52;
      if (pv <= 500000) return 80;
      return 123;
    },
  };

  const PROVIDER_NAMES = {
    'google-analytics': 'Google Analytics',
    'plausible': 'Plausible',
    'fathom': 'Fathom',
    'rybbit': 'Rybbit',
    'simple-analytics': 'Simple Analytics',
    'matomo': 'Matomo Cloud',
  };

  const FEATURES = {
    'google-analytics': [
      { feature: 'Pricing', beam: 'Free / $5/mo', competitor: 'Free (your data is the product)', beamWins: true },
      { feature: 'Cookies', beam: 'None', competitor: 'Yes (consent banner needed)', beamWins: true },
      { feature: 'GDPR compliant', beam: 'Yes — out of the box', competitor: 'Requires consent setup + DPA', beamWins: true },
      { feature: 'Data ownership', beam: 'Your data only', competitor: 'Google processes your data', beamWins: true },
      { feature: 'Script size', beam: '< 2 KB', competitor: '~50 KB (GA4 tag)', beamWins: true },
      { feature: 'Custom events', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Goals & conversions', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Setup time', beam: '~5 minutes', competitor: '30–60 min (Tag Manager + config)', beamWins: true },
      { feature: 'Google Ads integration', beam: 'No', competitor: 'Yes', beamWins: false },
    ],
    'plausible': [
      { feature: 'Pricing', beam: 'Free / $5/mo', competitor: '$9–$69/mo', beamWins: true },
      { feature: 'Free tier', beam: '1 site, 50K pv/mo', competitor: 'None (14-day trial only)', beamWins: true },
      { feature: 'Cookies', beam: 'None', competitor: 'None', beamWins: false },
      { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Custom events', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Goals & conversions', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Weekly digest emails', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Anomaly alerts', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'API access', beam: 'Yes', competitor: 'Yes', beamWins: false },
    ],
    'fathom': [
      { feature: 'Pricing', beam: 'Free / $5/mo', competitor: '$15–$100/mo', beamWins: true },
      { feature: 'Free tier', beam: '1 site, 50K pv/mo', competitor: 'None (7-day trial only)', beamWins: true },
      { feature: 'Cookies', beam: 'None', competitor: 'None', beamWins: false },
      { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Custom events', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Traffic channels', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'Anomaly alerts', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'Embeddable badge', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'Uptime SLA', beam: 'Cloudflare 99.99%', competitor: 'Yes', beamWins: false },
    ],
    'rybbit': [
      { feature: 'Pricing (hosted)', beam: 'Free / $5/mo', competitor: '$13–$26/mo cloud', beamWins: true },
      { feature: 'Free tier', beam: '1 site, 50K pv/mo', competitor: 'None (cloud)', beamWins: true },
      { feature: 'Self-hostable', beam: 'No', competitor: 'Yes', beamWins: false },
      { feature: 'Open source', beam: 'No', competitor: 'Yes', beamWins: false },
      { feature: 'Cookies', beam: 'None', competitor: 'None', beamWins: false },
      { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Session replay', beam: 'No', competitor: 'Yes', beamWins: false },
      { feature: 'Anomaly alerts', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'Managed hosting', beam: 'Yes (no infra ops)', competitor: 'Self-hosted = you manage infra', beamWins: true },
    ],
    'simple-analytics': [
      { feature: 'Pricing', beam: 'Free / $5/mo', competitor: '$9–$19/mo', beamWins: true },
      { feature: 'Free tier', beam: '1 site, 50K pv/mo', competitor: 'None (trial only)', beamWins: true },
      { feature: 'Cookies', beam: 'None', competitor: 'None', beamWins: false },
      { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Custom events', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Goals & conversions', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'Anomaly alerts', beam: 'Yes', competitor: 'No', beamWins: true },
      { feature: 'API access', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Migration from SA', beam: 'Yes (migration guide)', competitor: '—', beamWins: true },
    ],
    'matomo': [
      { feature: 'Cloud pricing', beam: 'Free / $5/mo', competitor: '$23–$123/mo cloud', beamWins: true },
      { feature: 'Free tier', beam: '1 site, 50K pv/mo', competitor: 'Only if self-hosted', beamWins: true },
      { feature: 'Cookies (cloud)', beam: 'None', competitor: 'Optional (privacy modes)', beamWins: true },
      { feature: 'GDPR compliant', beam: 'Yes', competitor: 'Yes (with config)', beamWins: false },
      { feature: 'Setup time', beam: '~5 min', competitor: 'Hours for self-hosted', beamWins: true },
      { feature: 'Custom events', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Heatmaps & session replay', beam: 'No', competitor: 'Yes (paid)', beamWins: false },
      { feature: 'API access', beam: 'Yes', competitor: 'Yes', beamWins: false },
      { feature: 'Maintenance burden', beam: 'Zero (fully hosted)', competitor: 'High if self-hosted', beamWins: true },
    ],
  };

  function beamCost(pv) {
    if (pv <= 50000) return 0;
    return 5;
  }

  function renderTable(provider) {
    const rows = FEATURES[provider] || [];
    const competitor = PROVIDER_NAMES[provider] || provider;
    return '<table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">' +
      '<thead class="bg-gray-50"><tr>' +
      '<th class="text-left px-4 py-3 font-semibold text-gray-700">Feature</th>' +
      '<th class="text-center px-4 py-3 font-semibold text-indigo-600">Beam</th>' +
      '<th class="text-center px-4 py-3 font-semibold text-gray-500">' + competitor + '</th>' +
      '</tr></thead>' +
      '<tbody class="divide-y divide-gray-100">' +
      rows.map(function (r) {
        var beamCell = r.beamWins !== false
          ? '<span class="text-green-600 font-semibold">' + r.beam + '</span>'
          : '<span class="text-gray-700">' + r.beam + '</span>';
        return '<tr class="bg-white hover:bg-gray-50">' +
          '<td class="px-4 py-3 text-gray-700 font-medium">' + r.feature + '</td>' +
          '<td class="px-4 py-3 text-center">' + beamCell + '</td>' +
          '<td class="px-4 py-3 text-center text-gray-500">' + r.competitor + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function update() {
    var provider = document.getElementById('provider').value;
    var pv = parseInt(document.getElementById('pageviews').value, 10);

    var currentCost = PRICING[provider](pv);
    var beam = beamCost(pv);
    var annualSavings = (currentCost - beam) * 12;

    var currentEl = document.getElementById('current-cost');
    var beamEl = document.getElementById('beam-cost');
    var savingsEl = document.getElementById('annual-savings');
    var noteEl = document.getElementById('savings-note');

    if (provider === 'google-analytics') {
      currentEl.textContent = 'Free*';
      noteEl.textContent = '* GA4 is free but funded by Google\\'s advertising ecosystem — your visitors\\' data is part of the trade-off.';
    } else {
      currentEl.textContent = currentCost === 0 ? 'Free' : '$' + currentCost;
      noteEl.textContent = '';
    }

    beamEl.textContent = beam === 0 ? 'Free' : '$' + beam;

    if (provider === 'google-analytics') {
      savingsEl.textContent = beam === 0 ? '$0' : '-$' + (beam * 12);
      savingsEl.className = 'text-3xl font-extrabold text-gray-700';
    } else if (annualSavings > 0) {
      savingsEl.textContent = '$' + annualSavings;
      savingsEl.className = 'text-3xl font-extrabold text-emerald-700';
    } else if (annualSavings === 0) {
      savingsEl.textContent = '$0';
      savingsEl.className = 'text-3xl font-extrabold text-gray-700';
    } else {
      savingsEl.textContent = '-$' + Math.abs(annualSavings);
      savingsEl.className = 'text-3xl font-extrabold text-red-600';
    }

    document.getElementById('comparison-table').innerHTML = renderTable(provider);
  }

  document.getElementById('provider').addEventListener('change', update);
  document.getElementById('pageviews').addEventListener('change', update);
  update();
})();
</script>
</body>
</html>`
  return c.html(html)
})

export const vs = app
