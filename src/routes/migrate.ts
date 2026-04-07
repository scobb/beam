import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl } from '../lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function nav(): string {
  return `
  <nav class="border-b border-gray-100">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/migrate" class="font-medium text-emerald-700 hover:text-emerald-800">Migration Hub</a>
        <a href="/demo" class="text-gray-600 hover:text-gray-900">Live Demo</a>
        <a href="/login" class="text-sm text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" class="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>`
}

function footer(): string {
  return `
  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/migrate" class="hover:text-gray-600">Migration hub</a>
        <a href="/tools/stack-scanner" class="hover:text-gray-600">Stack scanner</a>
        <a href="/for" class="hover:text-gray-600">Setup guides</a>
        <a href="/vs/google-analytics" class="hover:text-gray-600">vs Google Analytics</a>
        <a href="/vs/plausible" class="hover:text-gray-600">vs Plausible</a>
        <a href="/vs/fathom" class="hover:text-gray-600">vs Fathom</a>
        <a href="/beam-analytics-alternative" class="hover:text-gray-600">Beam Analytics Alternative</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
      </div>
    </div>
  </footer>`
}

app.get('/migrate', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const migrationPaths = [
    {
      href: '/tools/stack-scanner',
      label: 'Scan my current stack',
      summary: 'Detect current analytics scripts first, then use Beam-specific migration guidance.',
      bestFor: 'Teams unsure what is currently installed on production pages.',
    },
    {
      href: '/migrate/google-analytics',
      label: 'Google Analytics migration checklist',
      summary: 'Follow a practical GA4 replacement sequence: remove GA, install Beam, verify, and map reporting priorities.',
      bestFor: 'Teams leaving GA4 due to consent friction, complexity, or Google data-sharing concerns.',
    },
    {
      href: '/migrate/plausible',
      label: 'Plausible migration guide',
      summary: 'Use an implementation-first checklist to replace Plausible tags and verify Beam quickly.',
      bestFor: 'Teams switching from Plausible while keeping privacy-first analytics.',
    },
    {
      href: '/migrate/fathom',
      label: 'Fathom migration guide',
      summary: 'Follow a direct Fathom-to-Beam checklist with honest tradeoffs before cutover.',
      bestFor: 'Fathom users validating lower-cost migration paths without losing clarity.',
    },
    {
      href: '/migrate/import-history',
      label: 'Import historical traffic guide',
      summary: 'Bring daily traffic totals from Plausible or Fathom CSV exports into Beam so your dashboard shows trend context from day one.',
      bestFor: 'Anyone switching from Plausible or Fathom who wants historical trend continuity.',
    },
    {
      href: '/migrate/beam-analytics',
      label: 'beamanalytics.io migration guide',
      summary: 'Step-by-step migration from beamanalytics.io before the September 1, 2026 shutdown. Export data first, then install Beam and verify tracking.',
      bestFor: 'Current beamanalytics.io users who need to migrate before the September 2026 shutdown deadline.',
    },
    {
      href: '/for',
      label: 'Setup guides hub',
      summary: 'Framework and no-code install instructions for Next.js, WordPress, Webflow, and more.',
      bestFor: 'Anyone ready to install Beam after choosing a migration path.',
    },
    {
      href: '/demo',
      label: 'Live product demo',
      summary: 'Validate reporting UX and filters before touching production scripts.',
      bestFor: 'Decision-makers who want proof before implementation.',
    },
    {
      href: '/signup',
      label: 'Create Beam account',
      summary: 'Create a site, get a script tag, and verify first pageview in the dashboard.',
      bestFor: 'Teams ready to run Beam in production now.',
    },
  ] as const

  const collectionJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Beam migration hub',
    description:
      'Decision-oriented migration hub for teams switching analytics tools to Beam using scanner results, migration guides, setup docs, and live demo validation.',
    url: `${baseUrl}/migrate`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Beam',
      url: `${baseUrl}/`,
    },
  })

  const itemListJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Beam migration paths',
    itemListElement: migrationPaths.map((path, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: path.label,
      url: `${baseUrl}${path.href}`,
    })),
  })

  const migrationCards = migrationPaths
    .map(
      (path) => `
      <article class="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 class="text-xl font-bold text-gray-900">
          <a href="${path.href}" class="hover:text-indigo-700">${path.label}</a>
        </h2>
        <p class="mt-3 text-sm text-gray-600 leading-relaxed">${path.summary}</p>
        <p class="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span class="font-semibold text-gray-900">Best for:</span> ${path.bestFor}
        </p>
        <a href="${path.href}" class="mt-5 inline-block text-sm font-semibold text-indigo-700 hover:text-indigo-800">Open path -></a>
      </article>
    `
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam Migration Hub - Move from Legacy Analytics with a Clear Path</title>
  <meta name="description" content="A practical migration hub for switching to Beam. Start with stack scanning, compare migration guides, choose setup docs, validate in live demo, and launch." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/migrate" />
  <meta property="og:title" content="Beam Migration Hub" />
  <meta property="og:description" content="Switch analytics tools with a practical path: scan stack, choose migration guide, install, and verify." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/migrate" />
  <meta property="og:image" content="${baseUrl}/og/migrate" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam Migration Hub" />
  <meta name="twitter:description" content="Decision-oriented migration paths from GA, Plausible, Fathom, and legacy Beam Analytics to Beam." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${collectionJsonLd}</script>
  <script type="application/ld+json">${itemListJsonLd}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Migration hub</p>
  <h1 class="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Choose the fastest path to switch analytics tools</h1>
  <p class="mt-6 text-lg text-gray-600 max-w-3xl">
    This page is built for migration decisions, not generic marketing. Start with whichever path reduces your current risk first:
    verify what is installed, validate reporting fit, follow implementation guides, then switch production tags.
  </p>

  <section class="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Recommended migration sequence</h2>
    <ol class="mt-4 space-y-3 text-gray-700">
      <li><span class="font-semibold">1.</span> Scan your site at <a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">/tools/stack-scanner</a>.</li>
      <li><span class="font-semibold">2.</span> Use the matching migration guide (<a href="/migrate/google-analytics" class="text-indigo-700 hover:underline">Google Analytics</a>, <a href="/migrate/plausible" class="text-indigo-700 hover:underline">Plausible</a>, <a href="/migrate/fathom" class="text-indigo-700 hover:underline">Fathom</a>, or <a href="/migrate/beam-analytics" class="text-indigo-700 hover:underline">beamanalytics.io shutdown</a>).</li>
      <li><span class="font-semibold">3.</span> Implement with the <a href="/for" class="text-indigo-700 hover:underline">setup guides hub</a> and verify first pageview.</li>
      <li><span class="font-semibold">4.</span> Confirm dashboard fit in <a href="/demo" class="text-indigo-700 hover:underline">/demo</a>, then create your production site record at <a href="/signup" class="text-indigo-700 hover:underline">/signup</a>.</li>
    </ol>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900">Migration paths</h2>
    <p class="mt-3 text-gray-600">Every path below links directly to an actionable next step.</p>
    <div class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
      ${migrationCards}
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Decision matrix</h2>
    <div class="overflow-x-auto rounded-2xl border border-gray-200">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">If your current blocker is...</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Start here</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Then do this next</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr>
            <td class="px-4 py-3 text-gray-700">You do not know which analytics scripts are live.</td>
            <td class="px-4 py-3"><a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">Stack scanner</a></td>
            <td class="px-4 py-3 text-gray-600">Move into the relevant migration guide and remove legacy tags last.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You are replacing GA4 and need implementation-first steps.</td>
            <td class="px-4 py-3"><a href="/migrate/google-analytics" class="text-indigo-700 hover:underline">Google Analytics migration checklist</a></td>
            <td class="px-4 py-3 text-gray-600">Review <a href="/vs/google-analytics" class="text-indigo-700 hover:underline">Beam vs Google Analytics</a> for fit, then ship the install flow.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You are replacing Plausible and want a direct script-swap checklist.</td>
            <td class="px-4 py-3"><a href="/migrate/plausible" class="text-indigo-700 hover:underline">Plausible migration guide</a></td>
            <td class="px-4 py-3 text-gray-600">Compare tradeoffs in <a href="/vs/plausible" class="text-indigo-700 hover:underline">Beam vs Plausible</a>, then publish using a framework guide.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You are replacing Fathom and want an honest fit check before script cutover.</td>
            <td class="px-4 py-3"><a href="/migrate/fathom" class="text-indigo-700 hover:underline">Fathom migration guide</a></td>
            <td class="px-4 py-3 text-gray-600">Review tradeoffs in <a href="/vs/fathom" class="text-indigo-700 hover:underline">Beam vs Fathom</a>, then ship your framework install.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You need framework-specific installation steps.</td>
            <td class="px-4 py-3"><a href="/for" class="text-indigo-700 hover:underline">Setup guides hub</a></td>
            <td class="px-4 py-3 text-gray-600">Validate in demo, then instrument production and confirm first pageview.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You need confidence before touching production.</td>
            <td class="px-4 py-3"><a href="/demo" class="text-indigo-700 hover:underline">Live demo</a></td>
            <td class="px-4 py-3 text-gray-600">Create account and site, then run migration checklist on a staging page first.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You want historical trend data from your old tool in Beam from day one.</td>
            <td class="px-4 py-3"><a href="/migrate/import-history" class="text-indigo-700 hover:underline">Import history guide</a></td>
            <td class="px-4 py-3 text-gray-600">Upload a Plausible or Fathom CSV export to backfill daily traffic totals before going live.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">You are migrating from beamanalytics.io before the September 2026 shutdown.</td>
            <td class="px-4 py-3"><a href="/migrate/beam-analytics" class="text-indigo-700 hover:underline">beamanalytics.io migration guide</a></td>
            <td class="px-4 py-3 text-gray-600">Export historical data first, then complete Beam install and verification.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Ready to move now?</h2>
    <p class="mt-3 text-gray-700">Use the direct path: scanner -> setup guides -> account creation.</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row">
      <a href="/tools/stack-scanner" class="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100">Start with stack scanner</a>
      <a href="/for" class="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100">Open setup guides</a>
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Create free account</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

app.get('/migrate/google-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const howToJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Migrate from Google Analytics to Beam',
    description:
      'Practical GA4 replacement checklist: remove Google tags, install Beam, verify first traffic and events, and align reporting expectations.',
    step: [
      { '@type': 'HowToStep', name: 'Audit current GA footprint', text: 'Use the stack scanner to confirm where GA4 or GTM tags are currently deployed before editing production templates.' },
      { '@type': 'HowToStep', name: 'Remove GA scripts', text: 'Remove gtag.js, GTM GA tags, and GA4 config snippets from templates or tag managers once your cutover window is scheduled.' },
      { '@type': 'HowToStep', name: 'Install Beam', text: 'Create a Beam site, add the Beam script tag with your site ID, and publish.' },
      { '@type': 'HowToStep', name: 'Verify first pageviews and events', text: 'Open your site, confirm pageviews in Beam, and trigger one custom event to validate your core instrumentation path.' },
      { '@type': 'HowToStep', name: 'Align GA-era priorities to Beam', text: 'Map key reporting questions to Beam dashboards, goals, channels, and weekly alerts. Keep GA export archives for unsupported enterprise workflows.' },
    ],
    totalTime: 'PT30M',
  })
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Can Beam fully replace GA4 enterprise reporting?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Beam is focused on privacy-first decision analytics. It does not aim for full GA4 enterprise depth like Ads attribution modeling, BigQuery export workflows, or multi-touch journey analysis.',
        },
      },
      {
        '@type': 'Question',
        name: 'What should I verify first after migration?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Verify that first pageviews and one key custom event appear in Beam, then confirm top pages and source breakdowns match your expected traffic patterns.',
        },
      },
    ],
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Google Analytics to Beam Migration Guide - Practical GA4 Replacement Checklist</title>
  <meta name="description" content="Migrate from Google Analytics to Beam with a practical checklist: remove GA tags, install Beam, verify pageviews/events, and map GA priorities to Beam's decision-ready analytics." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/migrate/google-analytics" />
  <meta property="og:title" content="Google Analytics to Beam Migration Guide" />
  <meta property="og:description" content="A practical GA4 replacement checklist for teams moving to privacy-first analytics with Beam." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/migrate/google-analytics" />
  <meta property="og:image" content="${baseUrl}/og/migrate-google-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Google Analytics to Beam Migration Guide" />
  <meta name="twitter:description" content="Remove GA, install Beam, verify traffic/events, and align reporting expectations with this migration checklist." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${howToJsonLd}</script>
  <script type="application/ld+json">${faqJsonLd}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Migration Guide</p>
  <h1 class="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Google Analytics to Beam: implementation-first migration checklist</h1>
  <p class="mt-6 text-lg text-gray-600 leading-relaxed">
    This guide is for teams replacing GA4 with a privacy-first workflow. It prioritizes practical cutover steps:
    remove Google tags cleanly, install Beam, verify first pageviews/events, then align GA-era reporting priorities to Beam capabilities.
  </p>

  <section class="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Quick start links</h2>
    <p class="mt-3 text-gray-700">Use these in order if you are migrating this week.</p>
    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <a href="/tools/stack-scanner" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">1. Audit existing tags with stack scanner</a>
      <a href="/for" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">2. Open Beam setup guides</a>
      <a href="/demo" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">3. Validate dashboard fit in live demo</a>
      <a href="/signup" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">4. Create account and generate script</a>
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Migration checklist</h2>
    <ol class="space-y-4">
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">1. Confirm what is live today</p>
        <p class="mt-2 text-gray-700">Run <a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">/tools/stack-scanner</a> on production URLs so you know whether GA4, GTM, or multiple analytics vendors are active before you change templates.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">2. Remove GA scripts intentionally</p>
        <p class="mt-2 text-gray-700">Delete or disable GA snippets (<code>gtag.js</code>, GA-related GTM tags, and hardcoded measurement IDs) during a planned release window to avoid dual-counting.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">3. Install Beam script</p>
        <p class="mt-2 text-gray-700">Create your site in Beam, then add the snippet from the dashboard. If you need framework instructions, use <a href="/for" class="text-indigo-700 hover:underline">the setup guides hub</a>.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">4. Verify first pageviews and one key event</p>
        <p class="mt-2 text-gray-700">Visit key pages and trigger a high-value action (for example signup). Confirm both pageviews and custom events appear in the Beam dashboard before closing the migration ticket.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">5. Archive GA exports and finalize cutover</p>
        <p class="mt-2 text-gray-700">Keep historical GA exports for long-horizon reporting needs, then treat Beam as your live source of truth going forward.</p>
      </li>
    </ol>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Map GA-era priorities to Beam capabilities</h2>
    <div class="overflow-x-auto rounded-2xl border border-gray-200">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">GA-era priority</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Beam path</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Expectation boundary</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr>
            <td class="px-4 py-3 text-gray-700">What pages and sources are moving this week?</td>
            <td class="px-4 py-3 text-gray-700">Dashboard analytics, referrer/source channels, and weekly digests.</td>
            <td class="px-4 py-3 text-gray-600">Beam optimizes for action-oriented trend detection, not deep enterprise attribution models.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">Did core conversion steps improve after a release?</td>
            <td class="px-4 py-3 text-gray-700">Goals plus custom event analytics and summaries.</td>
            <td class="px-4 py-3 text-gray-600">Beam supports practical conversion monitoring, but not full multi-touch journey reconstruction.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">Can we keep privacy/compliance overhead low?</td>
            <td class="px-4 py-3 text-gray-700">Cookieless tracking with no PII and no consent-banner requirement.</td>
            <td class="px-4 py-3 text-gray-600">Beam intentionally favors privacy-first defaults over advertising-network integrations.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-700">Do we need BigQuery exports and enterprise ad attribution?</td>
            <td class="px-4 py-3 text-gray-700">Keep archived GA exports for those historical enterprise workflows.</td>
            <td class="px-4 py-3 text-gray-600">Beam does not currently target full GA4 enterprise reporting depth.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">What Beam does not promise in this migration</h2>
    <ul class="mt-4 space-y-2 text-gray-700">
      <li>Full GA4 enterprise parity (for example BigQuery-native pipeline workflows).</li>
      <li>Deep Google Ads attribution modeling and ad-network ecosystem coupling.</li>
      <li>Automatic one-click import of all historical GA properties.</li>
    </ul>
    <p class="mt-4 text-gray-700">Beam is strongest when your priority is privacy-first analytics that directly supports weekly product and growth decisions.</p>
  </section>

  <section class="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Start migration now</h2>
    <p class="mt-3 text-gray-700">Choose your next step based on where you are in the cutover process.</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Create Beam account</a>
      <a href="/for" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Open installation guides</a>
      <a href="/vs/google-analytics" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Compare Beam vs GA4</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

app.get('/migrate/plausible', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const howToJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Migrate from Plausible to Beam',
    description:
      'Implementation-first checklist for replacing Plausible with Beam: audit scripts, swap tags, verify first traffic, and align reporting expectations.',
    step: [
      { '@type': 'HowToStep', name: 'Audit current Plausible footprint', text: 'Scan production URLs to confirm where plausible.io scripts and event calls are currently deployed.' },
      { '@type': 'HowToStep', name: 'Replace Plausible script tags', text: 'Remove Plausible snippet references and install Beam script with your Beam site ID in the same release window.' },
      { '@type': 'HowToStep', name: 'Verify pageviews and one key event', text: 'Load primary pages and trigger a key event to confirm Beam data arrives before closing the migration change.' },
      { '@type': 'HowToStep', name: 'Validate reporting fit', text: 'Compare dashboard outputs with your expected top pages, channels, and trend shifts. Keep historical Plausible exports for archive needs.' },
    ],
    totalTime: 'PT20M',
  })
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What does Beam overlap with Plausible?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Both tools provide privacy-first cookieless analytics with pageviews, referrers, countries, browser and device breakdowns, and straightforward dashboards.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does Beam do differently from Plausible?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Beam emphasizes low-cost hosted analytics and decision-oriented summaries. Plausible has deeper maturity in open-source/self-hosting and some advanced reporting workflows.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I verify migration success after replacing Plausible?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'After replacing script tags, confirm first pageviews and at least one important event in Beam. Then compare top pages and source trends against expected traffic patterns.',
        },
      },
    ],
  })
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plausible to Beam Migration Guide - Replace Plausible with a Verified Beam Setup</title>
  <meta name="description" content="Migrate from Plausible to Beam with a practical script-replacement checklist: audit tags, install Beam, verify first pageviews/events, and align reporting expectations." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/migrate/plausible" />
  <meta property="og:title" content="Plausible to Beam Migration Guide" />
  <meta property="og:description" content="A practical migration path for Plausible users switching to Beam without losing implementation confidence." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/migrate/plausible" />
  <meta property="og:image" content="${baseUrl}/og/migrate-plausible" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Plausible to Beam Migration Guide" />
  <meta name="twitter:description" content="Replace Plausible scripts with Beam and verify your install with this implementation-first checklist." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${howToJsonLd}</script>
  <script type="application/ld+json">${faqJsonLd}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Migration Guide</p>
  <h1 class="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Plausible to Beam: direct migration checklist</h1>
  <p class="mt-6 text-lg text-gray-600 leading-relaxed">
    This guide is for teams already using Plausible who want a clean switch to Beam without hand-wavy marketing promises.
    It focuses on script replacement, honest feature boundaries, and concrete verification steps so you can ship migration safely.
  </p>

  <section class="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Quick start links</h2>
    <p class="mt-3 text-gray-700">Use these resources in migration order.</p>
    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <a href="/tools/stack-scanner" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">1. Scan current scripts</a>
      <a href="/vs/plausible" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">2. Review Beam vs Plausible tradeoffs</a>
      <a href="/for/nextjs" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">3. Next.js install guide</a>
      <a href="/for/wordpress" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">4. WordPress install guide</a>
      <a href="/for" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">5. Full setup guides hub</a>
      <a href="/demo" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">6. Validate dashboard fit in live demo</a>
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">What overlaps and what changes</h2>
    <div class="overflow-x-auto rounded-2xl border border-gray-200">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Migration area</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Overlap with Plausible</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Beam difference</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Tracking model</td>
            <td class="px-4 py-3 text-gray-700">Cookieless analytics without personal data collection.</td>
            <td class="px-4 py-3 text-gray-600">Script endpoint and site identifier change to Beam's snippet format.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Core reporting</td>
            <td class="px-4 py-3 text-gray-700">Pageviews, top pages, sources, country, browser, and device coverage.</td>
            <td class="px-4 py-3 text-gray-600">Beam emphasizes deterministic summaries and decision-focused trend signals.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Advanced workflows</td>
            <td class="px-4 py-3 text-gray-700">Both support practical conversion/event monitoring for small teams.</td>
            <td class="px-4 py-3 text-gray-600">Plausible remains stronger for teams that require self-hosting/open-source control patterns.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Cutover expectations</td>
            <td class="px-4 py-3 text-gray-700">A same-day script swap is realistic for most sites.</td>
            <td class="px-4 py-3 text-gray-600">Beam supports CSV-based daily traffic import from Plausible exports. Upload via <a href="/migrate/import-history" class="text-indigo-700 hover:underline">the import guide</a> to restore historical trend context.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Migration checklist</h2>
    <ol class="space-y-4">
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">1. Audit all Plausible script placements</p>
        <p class="mt-2 text-gray-700">Run <a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">/tools/stack-scanner</a> and list every template, CMS block, or tag manager location where Plausible appears.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">2. Replace Plausible with Beam in one release</p>
        <p class="mt-2 text-gray-700">Remove Plausible script tags and deploy Beam script tag from your dashboard in the same release window to minimize double-counting and gap windows.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">3. Verify working install immediately</p>
        <p class="mt-2 text-gray-700">Open key pages after deploy, then confirm first pageviews and at least one key event appear in Beam before considering migration complete.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">4. Compare expected traffic shape</p>
        <p class="mt-2 text-gray-700">Check top pages, channels, and countries against your expected baseline. If you are uncertain, compare with the live <a href="/demo" class="text-indigo-700 hover:underline">demo dashboard</a> to validate interpretation patterns.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">5. Import Plausible history into Beam</p>
        <p class="mt-2 text-gray-700">Export daily stats from Plausible and upload the CSV via your Beam dashboard to backfill historical daily traffic totals. See the <a href="/migrate/import-history" class="text-indigo-700 hover:underline">import history guide</a> for the exact steps.</p>
      </li>
    </ol>
  </section>

  <section class="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">What this migration guide does not promise</h2>
    <ul class="mt-4 space-y-2 text-gray-700">
      <li>Perfect one-to-one parity with every Plausible workflow or historical report.</li>
      <li>Full raw-event backfill: Beam's CSV import restores daily traffic totals (pageviews + visitors per day) — not individual pageview events or session-level history.</li>
      <li>Zero decision work: you still need to define goals and alert thresholds for your own business context.</li>
    </ul>
    <p class="mt-4 text-gray-700">CSV daily-traffic import is available for Plausible exports. <a href="/migrate/import-history" class="text-indigo-700 hover:underline">Read the import guide →</a></p>
  </section>

  <section class="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Start the Plausible migration now</h2>
    <p class="mt-3 text-gray-700">Choose your next step based on where you are in the cutover process.</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Create Beam account</a>
      <a href="/migrate/import-history" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Import Plausible history</a>
      <a href="/for" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Open setup guides</a>
      <a href="/vs/plausible" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Review Beam vs Plausible</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

app.get('/migrate/fathom', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const howToJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Migrate from Fathom to Beam',
    description:
      'Step-by-step Fathom to Beam migration path: audit current script usage, swap tags in one release, verify incoming traffic, and confirm reporting fit.',
    step: [
      { '@type': 'HowToStep', name: 'Audit current Fathom usage', text: 'Run the stack scanner against production URLs and note every Fathom snippet location.' },
      { '@type': 'HowToStep', name: 'Swap scripts in one deployment', text: 'Remove Fathom script tags and add Beam script tags with your Beam site ID in the same release.' },
      { '@type': 'HowToStep', name: 'Verify pageviews immediately', text: 'Load key pages after deploy and confirm first pageviews and traffic sources appear in Beam.' },
      { '@type': 'HowToStep', name: 'Validate the decision workflow fit', text: 'Compare top pages, channels, and trend summaries against your expected weekly reporting workflow.' },
    ],
    totalTime: 'PT20M',
  })
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What stays the same when moving from Fathom to Beam?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Both products are privacy-first and cookieless, with straightforward page and source reporting that does not require consent banner workflows for analytics.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where is Fathom still stronger?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Fathom remains stronger for teams that prioritize its established brand reputation, custom script domains to reduce ad-block losses, and its longer hosted track record.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where is Beam a better fit?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Beam is a better fit when cost sensitivity matters and you still want practical, privacy-first analytics with decision-oriented summaries, goal tracking, and setup guides.',
        },
      },
    ],
  })
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fathom to Beam Migration Guide - Honest Tradeoffs and Cutover Checklist</title>
  <meta name="description" content="Migrate from Fathom to Beam with a practical checklist. Review honest tradeoffs, swap scripts safely, verify first traffic, and move with confidence." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/migrate/fathom" />
  <meta property="og:title" content="Fathom to Beam Migration Guide" />
  <meta property="og:description" content="Practical Fathom-to-Beam migration steps with honest fit guidance before production cutover." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/migrate/fathom" />
  <meta property="og:image" content="${baseUrl}/og/migrate-fathom" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Fathom to Beam Migration Guide" />
  <meta name="twitter:description" content="Use this checklist to replace Fathom with Beam and verify implementation safely." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${howToJsonLd}</script>
  <script type="application/ld+json">${faqJsonLd}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Migration Guide</p>
  <h1 class="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Fathom to Beam: honest migration checklist</h1>
  <p class="mt-6 text-lg text-gray-600 leading-relaxed">
    This guide is for teams already using Fathom and evaluating Beam as a lower-cost hosted alternative.
    It keeps the process practical: assess fit honestly, replace scripts in one release, and verify tracking before calling migration complete.
  </p>

  <section class="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Quick start links</h2>
    <p class="mt-3 text-gray-700">Use these resources in migration order.</p>
    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <a href="/tools/stack-scanner" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">1. Scan current scripts</a>
      <a href="/vs/fathom" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">2. Review Beam vs Fathom tradeoffs</a>
      <a href="/for/nextjs" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">3. Next.js install guide</a>
      <a href="/for/wordpress" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">4. WordPress install guide</a>
      <a href="/for" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">5. Full setup guides hub</a>
      <a href="/demo" class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">6. Validate dashboard fit in live demo</a>
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Where Fathom remains stronger and where Beam fits better</h2>
    <div class="overflow-x-auto rounded-2xl border border-gray-200">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Decision area</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Fathom strength</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">Beam fit</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Privacy model</td>
            <td class="px-4 py-3 text-gray-700">Cookieless, privacy-first hosted analytics with a simple dashboard.</td>
            <td class="px-4 py-3 text-gray-600">Same privacy posture, with low-friction migration and setup guides for common stacks.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Brand and uptime confidence</td>
            <td class="px-4 py-3 text-gray-700">Longer product track record and premium reputation in privacy analytics.</td>
            <td class="px-4 py-3 text-gray-600">Strong fit if your priority is practical reporting and cost efficiency over premium-brand preference.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Script delivery controls</td>
            <td class="px-4 py-3 text-gray-700">Custom script domain support can reduce some ad-block filtering cases.</td>
            <td class="px-4 py-3 text-gray-600">Standard Beam snippet is simpler to run, but does not currently replicate custom-domain script routing.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Cost model</td>
            <td class="px-4 py-3 text-gray-700">Premium starting price can be reasonable for established teams.</td>
            <td class="px-4 py-3 text-gray-600">Lower entry cost makes Beam easier to justify for indie makers and small businesses.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Decision support workflows</td>
            <td class="px-4 py-3 text-gray-700">Fathom keeps analytics simple and readable.</td>
            <td class="px-4 py-3 text-gray-600">Beam leans into practical summaries, goals, and trend signals for weekly action planning.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Migration checklist</h2>
    <ol class="space-y-4">
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">1. Audit every Fathom placement</p>
        <p class="mt-2 text-gray-700">Run <a href="/tools/stack-scanner" class="text-indigo-700 hover:underline">/tools/stack-scanner</a> and list each template, CMS field, or tag-manager location where Fathom appears.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">2. Confirm fit with side-by-side comparison</p>
        <p class="mt-2 text-gray-700">Review <a href="/vs/fathom" class="text-indigo-700 hover:underline">Beam vs Fathom</a> so teams align on tradeoffs before code changes.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">3. Replace Fathom snippet with Beam in one release</p>
        <p class="mt-2 text-gray-700">Use your Beam site ID and deploy the script swap atomically to avoid overlap and blind spots.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">4. Validate traffic and interpretation</p>
        <p class="mt-2 text-gray-700">Open high-traffic pages, verify first events, and compare with <a href="/demo" class="text-indigo-700 hover:underline">/demo</a> to ensure your team can read Beam reports confidently.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">5. Import Fathom history into Beam</p>
        <p class="mt-2 text-gray-700">Export daily stats from Fathom and upload the CSV via your Beam dashboard to restore historical daily traffic totals. See the <a href="/migrate/import-history" class="text-indigo-700 hover:underline">import history guide</a> for the exact steps.</p>
      </li>
    </ol>
  </section>

  <section class="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">What this guide does not promise</h2>
    <ul class="mt-4 space-y-2 text-gray-700">
      <li>Perfect feature parity with every Fathom capability, especially custom-domain script workflows.</li>
      <li>Full raw-event backfill: Beam's CSV import restores daily traffic totals (pageviews + visitors per day) — not individual pageview events or session-level history.</li>
      <li>Zero decision work: your team still needs clear goals and reporting thresholds after migration.</li>
    </ul>
    <p class="mt-4 text-gray-700">CSV daily-traffic import is available for Fathom exports. <a href="/migrate/import-history" class="text-indigo-700 hover:underline">Read the import guide →</a></p>
  </section>

  <section class="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Start the Fathom migration now</h2>
    <p class="mt-3 text-gray-700">Choose your next step based on where you are in the cutover process.</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Create Beam account</a>
      <a href="/migrate/import-history" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Import Fathom history</a>
      <a href="/for" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Open setup guides</a>
      <a href="/vs/fathom" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Review Beam vs Fathom</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

app.get('/beam-analytics-alternative', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam Analytics Alternative: Migration Guide Before Shutdown</title>
  <meta name="description" content="Need a Beam Analytics alternative? Migrate from beamanalytics.io before the September 2026 shutdown. Follow this checklist to move to Beam in minutes." />
  <meta name="keywords" content="Beam Analytics alternative, Beam Analytics shutdown, migrate from Beam Analytics, beamanalytics.io replacement" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/beam-analytics-alternative" />
  <meta property="og:title" content="Beam Analytics Alternative: Migration Guide Before Shutdown" />
  <meta property="og:description" content="beamanalytics.io is winding down in September 2026. Use this practical checklist to move to Beam and keep your analytics running." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/beam-analytics-alternative" />
  <meta property="og:image" content="${baseUrl}/og/migrate-beam-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam Analytics Alternative" />
  <meta name="twitter:description" content="Migrating off beamanalytics.io before the September 2026 shutdown? Start here." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-6 py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-3">Migration Guide</p>
  <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Beam Analytics Alternative: Move Before Shutdown</h1>
  <p class="text-lg text-gray-600 mb-10">
    If you are currently using <strong>beamanalytics.io</strong>, now is the time to migrate. The product has announced
    that service will be shut down on <strong>September 1, 2026</strong>, with users advised to export data before then.
    Beam gives you a clean migration path with a similar privacy-first approach.
  </p>

  <section class="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-12">
    <h2 class="text-xl font-bold text-amber-900 mb-2">Shutdown context</h2>
    <p class="text-amber-900 leading-relaxed">
      Based on the public shutdown notice from beamanalytics.io, teams should plan migration work now, verify replacement
      tracking in production, and keep exported historical data archived locally before the September 2026 cutoff.
    </p>
  </section>

  <section class="mb-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">What carries over and what changes</h2>
    <div class="overflow-x-auto border border-gray-200 rounded-2xl">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Area</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Beam overlap</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Key difference</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Core tracking model</td>
            <td class="px-4 py-3 text-gray-600">Cookieless pageview analytics with lightweight script.</td>
            <td class="px-4 py-3 text-gray-600">Beam script endpoint is <code>/js/beam.js</code> with a Beam site ID.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Dashboard metrics</td>
            <td class="px-4 py-3 text-gray-600">Pageviews, visitors, top pages, referrers, country, browser, device.</td>
            <td class="px-4 py-3 text-gray-600">Beam also emphasizes actionable summaries, goals, and change alerts.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Historical data</td>
            <td class="px-4 py-3 text-gray-600">You can export historical data from your old provider.</td>
            <td class="px-4 py-3 text-gray-600">Beam supports CSV-based daily traffic import for Plausible and Fathom exports. Raw-event backfill from beamanalytics.io is not yet supported. <a href="/migrate/import-history" class="text-indigo-700 hover:underline">Import guide →</a></td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Setup effort</td>
            <td class="px-4 py-3 text-gray-600">Simple script install and verification flow.</td>
            <td class="px-4 py-3 text-gray-600">You will create a new site record and update script tags in your codebase/CMS.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Migration checklist</h2>
    <ol class="space-y-4">
      <li class="rounded-xl border border-gray-200 p-4">
        <p class="font-semibold text-gray-900 mb-1">1. Export your old data now</p>
        <p class="text-gray-600">Download CSV/JSON exports from beamanalytics.io while access is still available.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-4">
        <p class="font-semibold text-gray-900 mb-1">2. Create your Beam site</p>
        <p class="text-gray-600">Sign up, add your domain in the dashboard, and copy the generated site ID snippet.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-4">
        <p class="font-semibold text-gray-900 mb-1">3. Install the Beam script</p>
        <p class="text-gray-600">Replace old tracking tags with <code>&lt;script defer src="${baseUrl}/js/beam.js" data-site-id="YOUR_SITE_ID"&gt;&lt;/script&gt;</code>.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-4">
        <p class="font-semibold text-gray-900 mb-1">4. Verify your first pageview</p>
        <p class="text-gray-600">Open your site, then check Beam dashboard analytics to confirm live traffic is arriving.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-4">
        <p class="font-semibold text-gray-900 mb-1">5. Import daily traffic history (if available)</p>
        <p class="text-gray-600">If you exported Plausible or Fathom CSV data before switching to beamanalytics.io, you can upload those CSV files to Beam to restore historical daily traffic totals. See the <a href="/migrate/import-history" class="text-indigo-700 hover:underline">import history guide</a>. Keep the beamanalytics.io exports archived for your own records.</p>
      </li>
    </ol>
  </section>

  <section class="mb-12 bg-gray-50 rounded-2xl p-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">What Beam does not yet replicate</h2>
    <ul class="space-y-2 text-gray-700">
      <li>Direct import of beamanalytics.io CSV exports (Beam imports Plausible and Fathom CSV formats today).</li>
      <li>Full raw-event backfill: CSV import restores daily traffic totals (pageviews + visitors per day), not individual events.</li>
      <li>One-click migration assistant that maps old properties automatically.</li>
    </ul>
    <p class="text-gray-600 mt-4">Keep beamanalytics.io exports archived for your own records. If you have Plausible or Fathom exports from an earlier tool, you can <a href="/migrate/import-history" class="text-indigo-700 hover:underline">import those into Beam</a>.</p>
  </section>

  <section class="bg-indigo-50 rounded-2xl p-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">Start the migration today</h2>
    <p class="text-gray-700 mb-6">Use the live demo and setup guides to validate fit before switching production traffic.</p>
    <div class="flex flex-wrap gap-3 mb-4">
      <a href="/demo" class="inline-block bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors">Try the interactive demo</a>
      <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors">Create your Beam account</a>
    </div>
    <p class="text-sm text-gray-600">
      Setup help:
      <a href="/blog/add-analytics-in-5-minutes" class="text-indigo-700 hover:underline">5-minute install guide</a>,
      <a href="/for/nextjs" class="text-indigo-700 hover:underline">Next.js</a>,
      <a href="/for/wordpress" class="text-indigo-700 hover:underline">WordPress</a>,
      <a href="/for/astro" class="text-indigo-700 hover:underline">Astro</a>,
      <a href="/for/remix" class="text-indigo-700 hover:underline">Remix</a>.
    </p>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

app.get('/migrate/import-history', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const howToJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Import historical traffic into Beam',
    description:
      'Step-by-step guide to uploading a Plausible or Fathom CSV export into Beam so your dashboard shows historical daily traffic totals from day one.',
    step: [
      { '@type': 'HowToStep', name: 'Export daily stats from your old tool', text: 'Download a CSV export of daily traffic from Plausible or Fathom covering the date range you want to keep.' },
      { '@type': 'HowToStep', name: 'Create a site in Beam', text: 'Sign up and add your domain. Copy the site ID snippet and install it so new pageviews start arriving.' },
      { '@type': 'HowToStep', name: 'Upload the CSV via the dashboard', text: 'Go to your site → Migration tab → Import history, select your vendor, and upload the CSV file.' },
      { '@type': 'HowToStep', name: 'Verify import coverage', text: 'Check the import coverage banner in your dashboard to confirm the date range and that no native days are overwritten.' },
    ],
    totalTime: 'PT10M',
  })
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: "What does Beam's CSV history import give me?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Daily pageview and visitor totals for the date range covered by your Plausible or Fathom CSV export. This restores historical trend context in your Beam dashboard without requiring raw event data.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which analytics tools can I import from?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Beam currently supports CSV exports from Plausible Analytics and Fathom Analytics. Google Analytics and beamanalytics.io direct imports are not yet supported.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does imported history overwrite live Beam data?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Native Beam data always takes priority. Imported daily totals only fill days where Beam has no pageviews of its own, so there is no double-counting.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is this a full raw-event backfill?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. The import restores daily aggregates — total pageviews and visitors per day. Individual pageview events, top pages, and referrer breakdowns for historical dates are not available from CSV imports.',
        },
      },
    ],
  })
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Import Historical Traffic into Beam — CSV Guide for Plausible and Fathom</title>
  <meta name="description" content="Upload a Plausible or Fathom CSV export to restore historical daily traffic totals in Beam. Step-by-step import guide with honest scope notes." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/migrate/import-history" />
  <meta property="og:title" content="Import Historical Traffic into Beam" />
  <meta property="og:description" content="Bring Plausible or Fathom daily traffic history into Beam so your dashboard shows trend context from day one." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/migrate/import-history" />
  <meta property="og:image" content="${baseUrl}/og/migrate-import-history" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Import Historical Traffic into Beam" />
  <meta name="twitter:description" content="Upload a Plausible or Fathom CSV export to restore historical daily traffic totals in Beam." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${howToJsonLd}</script>
  <script type="application/ld+json">${faqJsonLd}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Migration Guide</p>
  <h1 class="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Import historical traffic into Beam</h1>
  <p class="mt-6 text-lg text-gray-600 leading-relaxed">
    When you migrate from Plausible or Fathom, you do not have to start from zero.
    Beam supports CSV-based daily traffic import so your dashboard shows historical trend context from the moment you go live.
    This guide explains exactly what the import covers, how to do it, and what it intentionally does not backfill.
  </p>

  <section class="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">What this import gives you</h2>
    <ul class="mt-4 space-y-3 text-gray-700">
      <li class="flex gap-3"><span class="text-emerald-600 font-bold mt-0.5">✓</span><span><strong>Daily pageview and visitor totals</strong> covering the date range in your exported CSV — enough to see traffic trends at a glance.</span></li>
      <li class="flex gap-3"><span class="text-emerald-600 font-bold mt-0.5">✓</span><span><strong>No double-counting</strong> — Beam always uses native data for days it has collected pageviews. Imported totals only fill days with no Beam events.</span></li>
      <li class="flex gap-3"><span class="text-emerald-600 font-bold mt-0.5">✓</span><span><strong>Import coverage banner</strong> in your dashboard showing exactly which date range comes from imported history vs. live Beam collection.</span></li>
      <li class="flex gap-3"><span class="text-amber-500 font-bold mt-0.5">—</span><span><strong>Not a raw-event backfill</strong> — top pages, referrers, and country breakdowns for historical dates are not restored. Only daily aggregate totals (pageviews + visitors) are imported.</span></li>
    </ul>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">Supported sources</h2>
    <div class="overflow-x-auto border border-gray-200 rounded-2xl">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Source</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Supported</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Notes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Plausible Analytics</td>
            <td class="px-4 py-3 text-emerald-700 font-semibold">Yes</td>
            <td class="px-4 py-3 text-gray-600">Export daily stats CSV from Plausible dashboard → Settings → Export. Use the "All time" date range.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Fathom Analytics</td>
            <td class="px-4 py-3 text-emerald-700 font-semibold">Yes</td>
            <td class="px-4 py-3 text-gray-600">Export the daily stats CSV from Fathom dashboard → Reports → Export CSV. Use the widest date range available.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Google Analytics</td>
            <td class="px-4 py-3 text-gray-400">Not yet</td>
            <td class="px-4 py-3 text-gray-600">GA4 export format is not currently supported.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">beamanalytics.io</td>
            <td class="px-4 py-3 text-gray-400">Not yet</td>
            <td class="px-4 py-3 text-gray-600">Direct import from beamanalytics.io exports is not yet supported.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Step-by-step import guide</h2>
    <ol class="space-y-4">
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">1. Export daily stats from your old tool</p>
        <p class="mt-2 text-gray-700">In Plausible, go to <strong>Settings → Export → Download CSV</strong> and select "All time" to get the full history. In Fathom, go to <strong>Reports → Export CSV</strong> with the widest date range. Save the file locally.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">2. Create a site in Beam (if you haven't already)</p>
        <p class="mt-2 text-gray-700"><a href="/signup" class="text-indigo-700 hover:underline">Sign up</a>, add your domain, and install the tracking snippet so live pageviews start arriving. You can import history before or after the live snippet is installed.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">3. Open your site's Migration tab in the dashboard</p>
        <p class="mt-2 text-gray-700">In the Beam dashboard, navigate to your site → <strong>Migration</strong> tab. You will see import cards for supported sources.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">4. Upload the CSV and wait for processing</p>
        <p class="mt-2 text-gray-700">Select the matching import card (Plausible or Fathom), upload your CSV, and submit. Processing is typically instant for standard export sizes. You will see a success or failure status with a row count.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">5. Check the import coverage banner</p>
        <p class="mt-2 text-gray-700">Open your site's analytics view. A coverage banner will show the imported date range and confirm that native Beam data takes priority wherever both exist.</p>
      </li>
    </ol>
  </section>

  <section class="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Honest scope: what this import does not restore</h2>
    <ul class="mt-4 space-y-2 text-gray-700">
      <li>Individual pageview events or session-level history — only daily totals (pageviews + visitors per day).</li>
      <li>Top pages, referrers, country, browser, or device breakdowns for imported dates.</li>
      <li>Custom event history or goal conversion data from your old tool.</li>
      <li>Automatic or one-click import — you need to export and upload the CSV manually.</li>
    </ul>
    <p class="mt-4 text-gray-700">This is intentional: daily totals give you the trend signal that matters for growth decisions without requiring raw PII backfill.</p>
  </section>

  <section class="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Ready to bring your history?</h2>
    <p class="mt-3 text-gray-700">Create your Beam account, set up your site, and use the Migration tab to upload your CSV export.</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Create Beam account</a>
      <a href="/migrate/plausible" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Plausible migration guide</a>
      <a href="/migrate/fathom" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Fathom migration guide</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

app.get('/migrate/beam-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const howToJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Migrate from beamanalytics.io to Beam',
    description:
      'Step-by-step migration guide for beamanalytics.io users: export your data before September 1, 2026, sign up for Beam, install the tracking snippet, and verify your first pageview.',
    step: [
      { '@type': 'HowToStep', name: 'Export your data from beamanalytics.io', text: 'Log in to beamanalytics.io and export your analytics data before the September 1, 2026 shutdown date. Download all available CSV exports and save them locally.' },
      { '@type': 'HowToStep', name: 'Sign up for Beam', text: 'Create a free Beam account at beam-privacy.com/signup. The free plan supports one site with up to 50K pageviews per month.' },
      { '@type': 'HowToStep', name: 'Add your site in Beam', text: 'In your Beam dashboard, create a new site record for your domain.' },
      { '@type': 'HowToStep', name: 'Install the Beam tracking snippet', text: 'Add the Beam script tag with your site ID to your site\'s HTML. Follow the framework-specific setup guide at /for if needed.' },
      { '@type': 'HowToStep', name: 'Verify first pageview', text: 'Load your site and confirm the first pageview appears in your Beam dashboard. The installation verification tool will confirm the script is firing correctly.' },
    ],
    totalTime: 'PT30M',
  })
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'When is beamanalytics.io shutting down?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'beamanalytics.io has confirmed a shutdown date of September 1, 2026. Users should export their data before that date, as the service and data access will end then.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I import my beamanalytics.io historical data into Beam?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Beam supports CSV-based daily traffic import for Plausible and Fathom exports. Direct raw-event backfill from beamanalytics.io is not currently supported, but you can preserve your historical data by downloading exports before the shutdown and archiving them locally.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Beam a privacy-first alternative like beamanalytics.io was?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Beam is cookieless, collects no personal data, and does not require consent banners for analytics. The architecture and privacy approach are similar to what beamanalytics.io offered.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does Beam offer that beamanalytics.io did not?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Beam adds goals and conversion tracking, custom events, traffic channel classification, rule-based insight summaries, weekly digest emails, and anomaly alerts — all without cookies or personal data collection.',
        },
      },
    ],
  })
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>beamanalytics.io Migration Guide - Move to Beam Before the September 2026 Shutdown</title>
  <meta name="description" content="beamanalytics.io is shutting down September 1, 2026. Follow this step-by-step migration guide to move to Beam and keep your privacy-first analytics running." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/migrate/beam-analytics" />
  <meta property="og:title" content="beamanalytics.io Migration Guide" />
  <meta property="og:description" content="Step-by-step guide to migrate from beamanalytics.io to Beam before the September 1, 2026 shutdown." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/migrate/beam-analytics" />
  <meta property="og:image" content="${baseUrl}/og/migrate-beam-analytics" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="beamanalytics.io Migration Guide" />
  <meta name="twitter:description" content="Export your data and switch to Beam before the September 2026 shutdown." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${howToJsonLd}</script>
  <script type="application/ld+json">${faqJsonLd}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
  <p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-3">Migration Guide</p>
  <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">beamanalytics.io to Beam Migration Guide</h1>
  <p class="text-lg text-gray-600 mb-10">
    beamanalytics.io is shutting down on <strong>September 1, 2026</strong>. The product was launched in January 2023
    by founders JR and Leng Lee and offered a generous free tier of 100K pageviews per month. If you are currently using
    it for analytics, now is the time to export your data and migrate to a replacement tool. This guide walks you
    through the migration to Beam step by step.
  </p>

  <section class="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-10">
    <h2 class="text-xl font-bold text-amber-900 mb-2">Shutdown timeline</h2>
    <p class="text-amber-900 leading-relaxed">
      <strong>September 1, 2026</strong> — beamanalytics.io service ends and data access closes.
      Export all historical data you want to keep before this date.
      Data export is available from your beamanalytics.io dashboard settings — download your CSV exports now.
    </p>
    <p class="mt-3 text-amber-800 text-sm">
      beamanalytics.io is listed on <a href="https://www.uneed.best/alternatives/beam_analytics" class="underline hover:text-amber-900" rel="noopener noreferrer">Uneed.best's Beam Analytics alternatives page</a>, confirming migration is a real, active need for the community.
    </p>
  </section>

  <section class="mb-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Migration checklist</h2>
    <ol class="space-y-4">
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">1. Export your data from beamanalytics.io</p>
        <p class="mt-2 text-gray-700">Log in to your beamanalytics.io account and download all available data exports. Save the files locally — you will lose access after September 1, 2026. The export option is typically found in your account settings or dashboard.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">2. Sign up for Beam</p>
        <p class="mt-2 text-gray-700"><a href="/signup" class="text-indigo-700 hover:underline">Create a free Beam account</a>. The free plan covers one site with up to 50K pageviews per month. The Pro plan ($5/mo) adds unlimited sites and 500K pageviews per month.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">3. Add your site in Beam</p>
        <p class="mt-2 text-gray-700">In your Beam dashboard, create a new site record for your domain. You will receive a unique site ID used in your tracking script.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">4. Install the Beam tracking snippet</p>
        <p class="mt-2 text-gray-700">Add the Beam script to your site's HTML, replacing the beamanalytics.io script tag:
          <code class="block mt-2 bg-gray-100 rounded px-3 py-2 text-sm font-mono break-all">&lt;script defer src="https://beam-privacy.com/js/beam.js" data-site-id="YOUR_SITE_ID"&gt;&lt;/script&gt;</code>
          Use the <a href="/for" class="text-indigo-700 hover:underline">setup guides hub</a> for framework-specific instructions (Next.js, WordPress, Webflow, etc.).
        </p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">5. Verify first pageview</p>
        <p class="mt-2 text-gray-700">Load your site and confirm the first pageview appears in your Beam dashboard. Use the installation verification tool in your dashboard's setup flow to confirm tracking is active.</p>
      </li>
      <li class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">6. Remove the beamanalytics.io script</p>
        <p class="mt-2 text-gray-700">Once Beam is verified and collecting traffic, remove the old beamanalytics.io script tag from your templates. There is no need to run both in parallel once Beam is confirmed working.</p>
      </li>
    </ol>
  </section>

  <section class="mb-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">What carries over vs what changes</h2>
    <div class="overflow-x-auto border border-gray-200 rounded-2xl">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Area</th>
            <th class="text-left px-4 py-3 font-semibold text-indigo-600">What stays similar</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-500">What changes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Privacy model</td>
            <td class="px-4 py-3 text-gray-600">Cookieless, no personal data, no consent banner required.</td>
            <td class="px-4 py-3 text-gray-600">Script endpoint changes to <code class="text-xs bg-gray-100 px-1 rounded">beam-privacy.com/js/beam.js</code>.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Core metrics</td>
            <td class="px-4 py-3 text-gray-600">Pageviews, visitors, top pages, referrers, country, browser, device width.</td>
            <td class="px-4 py-3 text-gray-600">Beam adds channel classification, goal conversion rates, and anomaly alerts.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Historical data</td>
            <td class="px-4 py-3 text-gray-600">Export is available before shutdown.</td>
            <td class="px-4 py-3 text-gray-600">Direct beamanalytics.io CSV import is not yet supported in Beam. Archive exports locally. <a href="/migrate/import-history" class="text-indigo-700 hover:underline">CSV import guide →</a></td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Custom events</td>
            <td class="px-4 py-3 text-gray-600">Event tracking was available in beamanalytics.io.</td>
            <td class="px-4 py-3 text-gray-600">Beam supports custom events with property breakdowns via <code class="text-xs bg-gray-100 px-1 rounded">window.beam('event', ...)</code>.</td>
          </tr>
          <tr>
            <td class="px-4 py-3 text-gray-800 font-medium">Pricing</td>
            <td class="px-4 py-3 text-gray-600">beamanalytics.io offered 100K free pageviews/month (launched January 2023 by JR and Leng Lee).</td>
            <td class="px-4 py-3 text-gray-600">Beam free tier: 1 site, 50K pageviews/mo. Pro: $5/mo unlimited sites + 500K pageviews.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mb-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Honest gaps: what Beam does not yet offer</h2>
    <ul class="mt-4 space-y-2 text-gray-700">
      <li>Direct import of beamanalytics.io raw event history — only Plausible and Fathom CSV imports are currently supported.</li>
      <li>Custom script domains to reduce ad-block losses — Beam serves the script from the primary domain.</li>
      <li>Enterprise SSO or team management — Beam is designed for indie makers and small teams.</li>
    </ul>
    <p class="mt-4 text-gray-700">If these gaps are blockers, compare alternatives like <a href="/vs/plausible" class="text-indigo-700 hover:underline">Plausible</a>, <a href="/vs/fathom" class="text-indigo-700 hover:underline">Fathom</a>, or <a href="/vs/umami" class="text-indigo-700 hover:underline">Umami</a> before committing.</p>
  </section>

  <section class="mb-12">
    <h2 class="text-2xl font-bold text-gray-900 mb-5">Frequently asked questions</h2>
    <div class="space-y-6">
      <div class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">When is the shutdown deadline?</p>
        <p class="mt-2 text-gray-700">September 1, 2026. Export your data before that date — access closes permanently afterward.</p>
      </div>
      <div class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">Can I import my historical data into Beam?</p>
        <p class="mt-2 text-gray-700">Not directly from beamanalytics.io's format. Beam supports daily traffic CSV imports for Plausible and Fathom exports. Archive your beamanalytics.io exports locally for your own records. <a href="/migrate/import-history" class="text-indigo-700 hover:underline">See the import guide.</a></p>
      </div>
      <div class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">Is Beam privacy-first like beamanalytics.io was?</p>
        <p class="mt-2 text-gray-700">Yes — cookieless, no personal data, no consent banner required for analytics. The privacy approach is the same core model.</p>
      </div>
      <div class="rounded-xl border border-gray-200 p-5">
        <p class="font-semibold text-gray-900">What does Beam add that beamanalytics.io did not have?</p>
        <p class="mt-2 text-gray-700">Goals and conversion tracking, traffic channel classification, rule-based insight summaries, weekly digest emails, anomaly alerts, and a public dashboard option.</p>
      </div>
    </div>
  </section>

  <section class="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 sm:p-8">
    <h2 class="text-2xl font-bold text-gray-900">Start the migration now</h2>
    <p class="mt-3 text-gray-700">You have until September 1, 2026 to export your data. Start Beam setup now so you are tracking before the deadline.</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Create Beam account</a>
      <a href="/for" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Open setup guides</a>
      <a href="/demo" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Try the live demo</a>
      <a href="/beam-analytics-alternative" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Beam Analytics Alternative page</a>
    </div>
  </section>
</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

export const migrate = app
