import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl } from '../lib/publicUrl'
import { getDefaultLaunchOffer } from '../lib/launchOffers'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const PRODUCT_HUNT_ATTRIBUTION = {
  ref: 'product-hunt',
  utm_source: 'producthunt',
  utm_medium: 'launch',
  utm_campaign: 'ph_launch_apr_2026',
} as const

const SHOW_HN_ATTRIBUTION = {
  ref: 'show-hn',
  utm_source: 'hackernews',
  utm_medium: 'launch',
  utm_campaign: 'show_hn_apr_2026',
} as const

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function withCampaign(
  campaign: Record<string, string>,
  path: string,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(campaign)) params.set(key, value)
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  return `${path}?${params.toString()}`
}

app.get('/product-hunt', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const beamSiteId = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const launchOffer = getDefaultLaunchOffer()
  const offerParams: Record<string, string> = launchOffer ? { offer: launchOffer.code } : {}

  const signupUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/signup', offerParams)
  const demoUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/demo', offerParams)
  const proSignupUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/signup', { ...offerParams, intent: 'pro' })
  const proLoginUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/login', { ...offerParams, intent: 'pro' })
  const setupGuidesUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/for', offerParams)
  const migrateUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/migrate', offerParams)
  const compareUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/alternatives', offerParams)
  const savingsUrl = withCampaign(PRODUCT_HUNT_ATTRIBUTION, '/switch', offerParams)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam for Product Hunt — Privacy-First Analytics You Can Act On</title>
  <meta name="description" content="Launching on Product Hunt: Beam gives makers privacy-first analytics with live demo proof, fast setup, migration guides, and decision-ready insights beyond passive pageview counters." />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="canonical" href="${baseUrl}/product-hunt" />
  <meta property="og:title" content="Beam for Product Hunt" />
  <meta property="og:description" content="Try Beam's live demo, setup in minutes, and see decision-ready analytics without cookies or consent banners." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/product-hunt" />
  <meta property="og:image" content="${baseUrl}/og/product-hunt" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Beam for Product Hunt" />
  <meta name="twitter:description" content="Privacy-first analytics with real proof points, honest tradeoffs, and launch-ready setup paths." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${beamSiteId}"></script>
</head>
<body class="bg-slate-950 text-slate-100 antialiased">
  <div class="relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.22),transparent_42%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)]"></div>
    <div class="relative max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <nav class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 backdrop-blur">
        <a href="/" class="text-lg font-bold text-emerald-300">Beam</a>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1 font-medium text-amber-200">Product Hunt Launch</span>
          <a href="${demoUrl}" data-launch-cta="ph_nav_demo" class="text-slate-200 hover:text-white">Live Demo</a>
          <a href="${proLoginUrl}" data-launch-cta="ph_nav_login_pro" class="text-slate-200 hover:text-white">Log in to upgrade</a>
          <a href="${signupUrl}" data-launch-cta="ph_nav_signup" class="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400">Get Started</a>
        </div>
      </nav>

      <main class="py-10 sm:py-16">
        <section class="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Built for Product Hunt makers</p>
            <h1 class="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight">
              Privacy-first analytics that helps you decide what to ship next
            </h1>
            <p class="mt-5 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed">
              Beam is for teams who are done with passive pageview counters. You get channels, goals, events, and weekly change summaries in a dashboard that is fast enough for launch day and simple enough to use daily.
            </p>

            <div class="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <a href="${signupUrl}" data-launch-cta="ph_hero_signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400">
                Start free
              </a>
              <a href="${demoUrl}" data-launch-cta="ph_hero_demo" class="inline-flex items-center justify-center rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-800">
                Open live demo
              </a>
              <a href="${proSignupUrl}" data-launch-cta="ph_hero_pro_signup" class="inline-flex items-center justify-center rounded-xl border border-fuchsia-300/60 bg-fuchsia-300/10 px-6 py-3 font-semibold text-fuchsia-100 hover:bg-fuchsia-300/20">
                Go Pro at launch
              </a>
            </div>
            <p class="mt-3 text-sm text-slate-400">
              Attribution-safe links: all major CTAs preserve Product Hunt source data through signup and pro-upgrade intent.
            </p>
            ${launchOffer ? `
              <div class="mt-4 rounded-xl border border-fuchsia-300/40 bg-fuchsia-300/10 px-4 py-3 text-sm text-fuchsia-50">
                <p class="font-semibold">${launchOffer.headline}: ${launchOffer.discountSummary}</p>
                <p class="mt-1 text-fuchsia-100/90">${launchOffer.termsSummary} Promo code: <code class="rounded bg-fuchsia-900/50 px-1.5 py-0.5 text-xs">${launchOffer.promoCode}</code>.</p>
              </div>
            ` : ''}
          </div>

          <div class="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6 shadow-2xl shadow-black/30">
            <h2 class="text-xl font-bold text-white">Why this is different from another counter</h2>
            <div class="mt-4 space-y-3 text-sm text-slate-300">
              <p><span class="font-semibold text-emerald-300">Actionable by default:</span> source channels, goals, event breakdowns, and anomaly alerts are built-in.</p>
              <p><span class="font-semibold text-emerald-300">Privacy-first:</span> no cookies, no consent banner burden, and no PII collection.</p>
              <p><span class="font-semibold text-emerald-300">Fast setup:</span> copy one script or use a stack-specific guide and verify installs in minutes.</p>
            </div>
            <div class="mt-5 rounded-xl border border-slate-700 bg-slate-950/80 p-4">
              <p class="text-xs uppercase tracking-wide text-slate-400">Proof surfaces for evaluators</p>
              <ul class="mt-3 space-y-2 text-sm">
                <li><a href="${demoUrl}" data-launch-cta="ph_proof_demo" class="text-emerald-300 hover:text-emerald-200">Live demo with interactive filters</a></li>
                <li><a href="${savingsUrl}" data-launch-cta="ph_proof_pricing" class="text-emerald-300 hover:text-emerald-200">Pricing + savings calculator</a></li>
                <li><a href="${migrateUrl}" data-launch-cta="ph_proof_migrate" class="text-emerald-300 hover:text-emerald-200">Migration hub for GA/Plausible/Fathom</a></li>
                <li><a href="${compareUrl}" data-launch-cta="ph_proof_compare" class="text-emerald-300 hover:text-emerald-200">Honest alternatives/comparison pages</a></li>
                <li><a href="${setupGuidesUrl}" data-launch-cta="ph_proof_setup" class="text-emerald-300 hover:text-emerald-200">Setup guides for Next.js, WordPress, Webflow, and more</a></li>
              </ul>
            </div>
          </div>
        </section>

        <section class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-400">Live demo</p>
            <p class="mt-2 text-sm text-slate-200">Public sandbox with realistic traffic, channels, and event data.</p>
          </article>
          <article class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-400">Pricing</p>
            <p class="mt-2 text-sm text-slate-200">Free up to 50K pageviews/month. Pro is $5/month for 500K across unlimited sites.</p>
          </article>
          <article class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-400">Fast setup</p>
            <p class="mt-2 text-sm text-slate-200">Script install + verification flow is designed to complete in one sitting.</p>
          </article>
          <article class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-400">Decision support</p>
            <p class="mt-2 text-sm text-slate-200">Beam focuses on what to do next, not just traffic totals.</p>
          </article>
        </section>

        <section class="mt-10 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-6 sm:p-8">
          <h2 class="text-2xl font-bold text-emerald-100">Ready to test it now?</h2>
          <p class="mt-2 text-sm sm:text-base text-emerald-50/90">
            Launch-day flow: open demo, validate setup guide for your stack, create account, then go pro if it fits.
          </p>
          <div class="mt-5 flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <a href="${signupUrl}" data-launch-cta="ph_footer_signup" class="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400">Create free account</a>
            <a href="${proSignupUrl}" data-launch-cta="ph_footer_pro_signup" class="inline-flex items-center justify-center rounded-xl border border-fuchsia-300/70 px-6 py-3 font-semibold text-fuchsia-100 hover:bg-fuchsia-300/15">Create account and open billing</a>
            <a href="${proLoginUrl}" data-launch-cta="ph_footer_login_pro" class="inline-flex items-center justify-center rounded-xl border border-slate-500 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800">Already have an account? Log in to billing</a>
          </div>
        </section>
      </main>
    </div>
  </div>
</body>
</html>`

  return c.html(html)
})

app.get('/show-hn', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const beamSiteId = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const launchOffer = getDefaultLaunchOffer()
  const offerParams: Record<string, string> = launchOffer ? { offer: launchOffer.code } : {}

  const signupUrl = withCampaign(SHOW_HN_ATTRIBUTION, '/signup', offerParams)
  const demoUrl = withCampaign(SHOW_HN_ATTRIBUTION, '/demo', offerParams)
  const howItWorksUrl = withCampaign(SHOW_HN_ATTRIBUTION, '/how-it-works', offerParams)
  const proSignupUrl = withCampaign(SHOW_HN_ATTRIBUTION, '/signup', { ...offerParams, intent: 'pro' })
  const proLoginUrl = withCampaign(SHOW_HN_ATTRIBUTION, '/login', { ...offerParams, intent: 'pro' })
  const repoUrl = 'https://github.com/scobb/beam.js'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Show HN: Beam — Privacy-first analytics on Cloudflare Workers</title>
  <meta name="description" content="Show HN launch page for Beam: Cloudflare Workers architecture, cookie-free analytics trade-offs, and direct paths to live demo, technical docs, and signup." />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="canonical" href="${baseUrl}/show-hn" />
  <meta property="og:title" content="Show HN: Beam" />
  <meta property="og:description" content="Cloudflare edge architecture, honest trade-offs, and a fast path to evaluate Beam in the live demo." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/show-hn" />
  <meta property="og:image" content="${baseUrl}/og/show-hn" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Show HN: Beam" />
  <meta name="twitter:description" content="Privacy-first analytics with technical depth and honest limits." />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${beamSiteId}"></script>
</head>
<body class="bg-zinc-950 text-zinc-100 antialiased">
  <div class="relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.16),transparent_36%),radial-gradient(circle_at_75%_5%,rgba(14,165,233,0.2),transparent_42%),linear-gradient(180deg,#09090b_0%,#18181b_60%,#111827_100%)]"></div>
    <div class="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/75 px-4 py-3 backdrop-blur">
        <a href="/" class="text-lg font-bold text-sky-300">Beam</a>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="rounded-full border border-sky-300/60 bg-sky-300/10 px-3 py-1 font-medium text-sky-200">Show HN Launch</span>
          <a href="${howItWorksUrl}" data-launch-cta="hn_nav_how" class="text-zinc-200 hover:text-white">How it works</a>
          <a href="${demoUrl}" data-launch-cta="hn_nav_demo" class="text-zinc-200 hover:text-white">Live Demo</a>
          <a href="${signupUrl}" data-launch-cta="hn_nav_signup" class="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-sky-950 hover:bg-sky-400">Try Beam</a>
        </div>
      </nav>

      <main class="py-10 sm:py-16">
        <section class="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Built for Hacker News readers</p>
            <h1 class="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
              Cookie-free analytics on Cloudflare Workers, with trade-offs spelled out
            </h1>
            <p class="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              Beam is a privacy-first analytics product for builders who want fast setup and practical decision support. It runs on Workers + D1 + KV, tracks without cookies, and keeps reporting simple enough to act on.
            </p>

            <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="${demoUrl}" data-launch-cta="hn_hero_demo" class="inline-flex items-center justify-center rounded-xl bg-sky-500 px-6 py-3 font-semibold text-sky-950 hover:bg-sky-400">
                Open live demo
              </a>
              <a href="${howItWorksUrl}" data-launch-cta="hn_hero_how" class="inline-flex items-center justify-center rounded-xl border border-zinc-600 px-6 py-3 font-semibold text-zinc-100 hover:border-zinc-400 hover:bg-zinc-800">
                Inspect architecture
              </a>
              <a href="${signupUrl}" data-launch-cta="hn_hero_signup" class="inline-flex items-center justify-center rounded-xl border border-emerald-300/70 bg-emerald-300/10 px-6 py-3 font-semibold text-emerald-100 hover:bg-emerald-300/20">
                Create free account
              </a>
            </div>
            <p class="mt-3 text-sm text-zinc-400">
              Attribution-safe links: primary CTAs carry Show HN source tags through signup and billing intent.
            </p>
            ${launchOffer ? `
              <div class="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50">
                <p class="font-semibold">${launchOffer.headline}: ${launchOffer.discountSummary}</p>
                <p class="mt-1 text-emerald-100/90">${launchOffer.termsSummary} Promo code: <code class="rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs">${launchOffer.promoCode}</code>.</p>
              </div>
            ` : ''}
          </div>

          <div class="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30 sm:p-6">
            <h2 class="text-xl font-bold text-white">Technical snapshot</h2>
            <ul class="mt-4 space-y-3 text-sm text-zinc-300">
              <li><span class="font-semibold text-sky-300">Runtime:</span> Cloudflare Workers serving collection, dashboard, and campaign pages.</li>
              <li><span class="font-semibold text-sky-300">Storage:</span> D1 (analytics rows) + KV (caching, rate limits, short-lived secrets).</li>
              <li><span class="font-semibold text-sky-300">Client:</span> sub-2KB script, no cookies/localStorage, Do Not Track respected.</li>
              <li><span class="font-semibold text-sky-300">Attribution:</span> first-touch cookie + UTM/ref propagation into signup cohorts.</li>
            </ul>
            <div class="mt-5 rounded-xl border border-zinc-700 bg-zinc-950/80 p-4">
              <p class="text-xs uppercase tracking-wide text-zinc-400">Primary evaluation links</p>
              <ul class="mt-3 space-y-2 text-sm">
                <li><a href="${demoUrl}" data-launch-cta="hn_eval_demo" class="text-sky-300 hover:text-sky-200">Live demo with realistic data</a></li>
                <li><a href="${howItWorksUrl}" data-launch-cta="hn_eval_how" class="text-sky-300 hover:text-sky-200">How Beam works (data flow + privacy model)</a></li>
                <li><a href="${repoUrl}" data-launch-cta="hn_eval_repo" class="text-sky-300 hover:text-sky-200">Open-source tracking script repo</a></li>
              </ul>
            </div>
          </div>
        </section>

        <section class="mt-10 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6 sm:p-8">
          <h2 class="text-2xl font-bold text-amber-100">What Beam does not do (yet)</h2>
          <ul class="mt-4 list-disc space-y-2 pl-5 text-sm text-amber-50/90 sm:text-base">
            <li>No session replay, heatmaps, or user-level journey stitching.</li>
            <li>No enterprise attribution model across ad platforms.</li>
            <li>Backend is not open source yet; only the tracking script is public.</li>
            <li>D1 write throughput is enough for current scale, but not designed for very high-volume ingestion.</li>
          </ul>
          <p class="mt-4 text-sm text-amber-50/90">
            Beam is intentionally focused: clear website analytics and actionable trends for small teams, not a full product analytics suite.
          </p>
        </section>

        <section class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article class="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-zinc-400">Setup</p>
            <p class="mt-2 text-sm text-zinc-200">One script tag or a framework guide, then verify installation from dashboard.</p>
          </article>
          <article class="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-zinc-400">Privacy model</p>
            <p class="mt-2 text-sm text-zinc-200">No cookies and no persistent identifiers by default.</p>
          </article>
          <article class="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-zinc-400">Pricing</p>
            <p class="mt-2 text-sm text-zinc-200">Free: 1 site / 50K pageviews. Pro: $5/month / 500K across unlimited sites.</p>
          </article>
          <article class="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
            <p class="text-xs uppercase tracking-wide text-zinc-400">Decision support</p>
            <p class="mt-2 text-sm text-zinc-200">Channels, goals, events, and trend summaries for shipping decisions.</p>
          </article>
        </section>

        <section class="mt-10 rounded-2xl border border-sky-300/30 bg-sky-300/10 p-6 sm:p-8">
          <h2 class="text-2xl font-bold text-sky-100">Evaluate Beam in under 5 minutes</h2>
          <p class="mt-2 text-sm text-sky-50/90 sm:text-base">
            Open demo, inspect architecture notes, create account, then jump to billing intent if you already know your fit.
          </p>
          <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="${signupUrl}" data-launch-cta="hn_footer_signup" class="inline-flex items-center justify-center rounded-xl bg-sky-500 px-6 py-3 font-semibold text-sky-950 hover:bg-sky-400">Create free account</a>
            <a href="${proSignupUrl}" data-launch-cta="hn_footer_pro_signup" class="inline-flex items-center justify-center rounded-xl border border-emerald-300/70 px-6 py-3 font-semibold text-emerald-100 hover:bg-emerald-300/15">Create account and open billing</a>
            <a href="${proLoginUrl}" data-launch-cta="hn_footer_login_pro" class="inline-flex items-center justify-center rounded-xl border border-zinc-500 px-6 py-3 font-semibold text-zinc-200 hover:bg-zinc-800">Already have an account? Log in to billing</a>
          </div>
        </section>
      </main>
    </div>
  </div>
</body>
</html>`

  return c.html(html)
})

export { app as launch }
