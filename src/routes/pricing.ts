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
      <div class="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/how-it-works" class="hover:text-gray-600">How it works</a>
        <a href="/pricing" class="hover:text-gray-600">Pricing</a>
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

app.get('/pricing', (c) => {
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const baseUrl = getPublicBaseUrl(c.env)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pricing — Beam Privacy-First Web Analytics</title>
  <meta name="description" content="Beam pricing: free plan for 1 site with 50,000 pageviews/month, Pro at $5/month for unlimited sites and 500,000 pageviews. No cookies, no consent banners." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/pricing" />
  <meta property="og:title" content="Pricing — Beam Privacy-First Web Analytics" />
  <meta property="og:description" content="Simple, honest pricing. Free forever for small sites. Pro at $5/month for unlimited sites." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/pricing" />
  <meta property="og:image" content="${baseUrl}/og-image.svg" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Pricing — Beam Privacy-First Web Analytics" />
  <meta name="twitter:description" content="Simple, honest pricing. Free forever for small sites. Pro at $5/month for unlimited sites and 500K pageviews." />
  <link rel="stylesheet" href="/assets/tailwind.css">
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
${nav()}

<main class="max-w-5xl mx-auto px-6 py-16">

  <!-- Hero -->
  <div class="text-center mb-16">
    <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Simple, honest pricing</h1>
    <p class="text-xl text-gray-500 max-w-2xl mx-auto">
      No hidden fees. No usage-based surprises. Pick a plan, add your script, and start seeing your data in minutes.
    </p>
  </div>

  <!-- Plan cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-20">

    <!-- Free plan -->
    <div class="border border-gray-200 rounded-2xl p-8 flex flex-col">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-900 mb-1">Free</h2>
        <p class="text-gray-500 text-sm mb-4">Perfect for personal sites and small projects</p>
        <div class="flex items-end gap-1">
          <span class="text-5xl font-extrabold text-gray-900">$0</span>
          <span class="text-gray-400 text-sm mb-2">/month</span>
        </div>
      </div>
      <ul class="space-y-3 text-sm text-gray-600 mb-8 flex-grow">
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>1 website</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>50,000 pageviews / month</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>All core analytics (pageviews, referrers, countries, devices)</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>Real-time dashboard</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>Public shareable dashboards</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>No credit card required</span>
        </li>
      </ul>
      <a href="/signup" data-beam-cta="pricing_free_cta"
         class="block text-center border border-indigo-600 text-indigo-600 font-semibold py-3 rounded-xl hover:bg-indigo-50 transition-colors">
        Start free
      </a>
    </div>

    <!-- Pro plan -->
    <div class="border-2 border-indigo-600 rounded-2xl p-8 flex flex-col relative">
      <div class="absolute -top-3 left-1/2 -translate-x-1/2">
        <span class="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>
      </div>
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-900 mb-1">Pro</h2>
        <p class="text-gray-500 text-sm mb-4">For growing sites and teams that need more</p>
        <div class="flex items-end gap-1">
          <span class="text-5xl font-extrabold text-gray-900">$5</span>
          <span class="text-gray-400 text-sm mb-2">/month</span>
        </div>
      </div>
      <ul class="space-y-3 text-sm text-gray-600 mb-8 flex-grow">
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>Unlimited websites</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>500,000 pageviews / month</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>Everything in Free</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>CSV data export</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>Priority support</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>Cancel anytime</span>
        </li>
      </ul>
      <a href="/signup" data-beam-cta="pricing_pro_cta"
         class="block text-center bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors">
        Get Pro
      </a>
    </div>

  </div>

  <!-- Comparison table -->
  <div class="max-w-3xl mx-auto mb-20">
    <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">What you get</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left py-3 pr-6 font-semibold text-gray-700 w-1/2">Feature</th>
            <th class="text-center py-3 px-4 font-semibold text-gray-700">Free</th>
            <th class="text-center py-3 px-4 font-semibold text-indigo-600">Pro</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr>
            <td class="py-3 pr-6 text-gray-600">Sites</td>
            <td class="text-center py-3 px-4 text-gray-600">1</td>
            <td class="text-center py-3 px-4 font-semibold text-indigo-600">Unlimited</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Pageviews / month</td>
            <td class="text-center py-3 px-4 text-gray-600">50,000</td>
            <td class="text-center py-3 px-4 font-semibold text-indigo-600">500,000</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Pageviews, referrers, countries</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Device &amp; browser breakdown</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Real-time dashboard</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Public shareable dashboards</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">CSV data export</td>
            <td class="text-center py-3 px-4 text-gray-300">—</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Priority support</td>
            <td class="text-center py-3 px-4 text-gray-300">—</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">No cookies / no consent banner</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">GDPR / CCPA compliant</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
            <td class="text-center py-3 px-4 text-green-500">✓</td>
          </tr>
          <tr>
            <td class="py-3 pr-6 text-gray-600">Credit card required</td>
            <td class="text-center py-3 px-4 text-gray-600">No</td>
            <td class="text-center py-3 px-4 text-gray-600">Yes</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- FAQ -->
  <div class="max-w-2xl mx-auto mb-16">
    <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently asked questions</h2>
    <div class="space-y-6">

      <div class="border-b border-gray-100 pb-6">
        <h3 class="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          No trial needed — the free plan is free forever, no time limit. Sign up, add your script,
          and start seeing data immediately. Upgrade to Pro whenever you need more sites or higher
          pageview limits. No commitment, no credit card for the free tier.
        </p>
      </div>

      <div class="border-b border-gray-100 pb-6">
        <h3 class="font-semibold text-gray-900 mb-2">What happens when I hit the pageview limit?</h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          We'll continue collecting data and notify you when you're approaching your limit. We won't
          cut you off mid-month without warning. If you consistently exceed your limit, we'll ask you
          to upgrade. We believe in fair, transparent enforcement — not surprise billing.
        </p>
      </div>

      <div class="border-b border-gray-100 pb-6">
        <h3 class="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          Yes, absolutely. Cancel from your dashboard settings at any time with one click. Your Pro
          access continues until the end of the billing period, and you'll automatically move back
          to the free plan after that. No cancellation fees, no questions asked.
        </p>
      </div>

      <div class="border-b border-gray-100 pb-6">
        <h3 class="font-semibold text-gray-900 mb-2">Is a credit card required for the free plan?</h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          No. Sign up with just your email address. No credit card, no payment info required to use
          the free plan. We only ask for payment details when you upgrade to Pro.
        </p>
      </div>

      <div class="border-b border-gray-100 pb-6">
        <h3 class="font-semibold text-gray-900 mb-2">How does Beam compare to Plausible and Fathom?</h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          Plausible starts at $9/month; Fathom starts at $15/month. Beam offers the same cookie-free,
          GDPR-compliant approach at $5/month — and a generous free tier they don't offer.
          See our <a href="/vs/plausible" class="text-indigo-600 hover:underline">Plausible comparison</a>
          and <a href="/vs/fathom" class="text-indigo-600 hover:underline">Fathom comparison</a> for a full breakdown.
        </p>
      </div>

      <div class="pb-6">
        <h3 class="font-semibold text-gray-900 mb-2">Do you offer refunds?</h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          If you're not happy with Beam within the first 30 days of your Pro subscription, contact
          us at <a href="mailto:ralph@keylightdigital.dev" class="text-indigo-600 hover:underline">ralph@keylightdigital.dev</a>
          and we'll issue a full refund, no questions asked.
        </p>
      </div>

    </div>
  </div>

  <!-- Bottom CTA -->
  <div class="text-center bg-indigo-50 rounded-2xl py-12 px-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">Ready to ditch the cookie banner?</h2>
    <p class="text-gray-500 mb-6 max-w-md mx-auto">
      Add one script tag and you're collecting privacy-first analytics in 60 seconds. Free forever.
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="/signup" data-beam-cta="pricing_bottom_free"
         class="w-full sm:w-auto text-center bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors">
        Start free
      </a>
      <a href="/demo" data-beam-cta="pricing_bottom_demo"
         class="w-full sm:w-auto text-center border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-xl hover:bg-gray-50 transition-colors">
        See the demo
      </a>
    </div>
  </div>

</main>

${footer()}
</body>
</html>`
  return c.html(html)
})

export const pricing = app
