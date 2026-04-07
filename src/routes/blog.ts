import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl, publicHost } from '../lib/publicUrl'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function nav(): string {
  return `
  <nav class="border-b border-gray-100">
    <div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex items-center gap-4">
        <a href="/blog" class="text-sm text-gray-600 hover:text-gray-900">Blog</a>
        <a href="/login" class="text-sm text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" class="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>`
}

function footer(): string {
  return `
  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-3xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex items-center gap-6">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/changelog" class="hover:text-gray-600">Changelog</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/blog" class="hover:text-gray-600">Blog</a>
        <a href="/blog/rss.xml" class="hover:text-gray-600">RSS</a>
        <a href="/vs/umami" class="hover:text-gray-600">vs Umami</a>
        <a href="/vs/matomo" class="hover:text-gray-600">vs Matomo</a>
        <a href="/vs/cloudflare-web-analytics" class="hover:text-gray-600">vs Cloudflare Web Analytics</a>
        <a href="/vs/simple-analytics" class="hover:text-gray-600">vs Simple Analytics</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>`
}

const POSTS = [
  {
    slug: 'plausible-alternative',
    title: 'Why We Built a Plausible Alternative',
    date: '2026-04-06',
    excerpt: 'Plausible is excellent — but it starts at $9/month and is priced for established businesses. Here\'s an honest look at what Plausible does well, where it falls short for early projects, and why we built Beam differently.',
    author: 'Keylight Digital',
  },
  {
    slug: 'cookie-free-analytics-guide',
    title: 'Cookie-Free Analytics in 2026: Why It Matters and How to Switch',
    date: '2026-04-01',
    excerpt: 'GDPR, consent fatigue, and ad blockers have made cookie-based analytics unreliable. Here\'s why cookie-free analytics is the right choice and how to make the switch.',
    author: 'Keylight Digital',
  },
  {
    slug: 'add-analytics-in-5-minutes',
    title: 'How to Add Cookie-Free Analytics to Any Website in 5 Minutes',
    date: '2026-04-03',
    excerpt: 'A practical step-by-step guide to installing Beam on HTML sites, React, Next.js, WordPress, and static site generators without cookies or consent banners.',
    author: 'Keylight Digital',
  },
  {
    slug: 'nextjs-privacy-analytics',
    title: 'Privacy Analytics for Next.js Apps: A Complete Setup Guide',
    date: '2026-04-03',
    excerpt: 'How to add GDPR-compliant, cookie-free analytics to your Next.js app — covering both the Pages Router and App Router, CSP headers, and dynamic route tracking.',
    author: 'Keylight Digital',
  },
  {
    slug: 'google-analytics-alternatives-2026',
    title: 'Google Analytics Alternatives in 2026: A Complete Guide',
    date: '2026-04-03',
    excerpt: 'An honest comparison of the best Google Analytics alternatives in 2026 — covering Beam, Plausible, Fathom, Simple Analytics, Umami, Matomo, PostHog, and Usermaven with pricing, pros, cons, and a full feature table.',
    author: 'Keylight Digital',
  },
  {
    slug: 'beam-analytics-shutdown-migration-guide',
    title: 'beamanalytics.io Is Shutting Down: Your Migration Options',
    date: '2026-04-05',
    excerpt: 'beamanalytics.io announced it will shut down on September 1, 2026. Here\'s an honest look at your migration options — Plausible, Fathom, Umami, Simple Analytics, and Beam — with practical trade-offs to help you decide.',
    author: 'Keylight Digital',
  },
]

// ─── Blog Index ──────────────────────────────────────────────────────────────

app.get('/blog', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const postCards = POSTS.map(p => `
    <article class="border border-gray-200 rounded-xl p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
      <time class="text-sm text-gray-400">${p.date}</time>
      <h2 class="mt-2 text-xl font-bold text-gray-900">
        <a href="/blog/${p.slug}" class="hover:text-indigo-600">${p.title}</a>
      </h2>
      <p class="mt-2 text-gray-600">${p.excerpt}</p>
      <a href="/blog/${p.slug}" class="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">Read more →</a>
    </article>`).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog — Beam</title>
  <meta name="description" content="Insights on privacy-first web analytics, GDPR compliance, and cookie-free tracking from the Beam team." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="Blog — Beam" />
  <meta property="og:description" content="Insights on privacy-first web analytics, GDPR compliance, and cookie-free tracking from the Beam team." />
  <meta property="og:url" content="${baseUrl}/blog" />
  <meta property="og:type" content="website" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Blog</h1>
    <p class="text-gray-500 mb-10">Thoughts on privacy, analytics, and the web.</p>
    <div class="space-y-6">
      ${postCards}
    </div>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Blog Post: Cookie-Free Analytics Guide ───────────────────────────────────

app.get('/blog/cookie-free-analytics-guide', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const post = POSTS[0]!
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/blog/${post.slug}` },
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — Beam</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog/${post.slug}" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:url" content="${baseUrl}/blog/${post.slug}" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${post.date}" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-8">
      <a href="/blog" class="text-sm text-indigo-600 hover:text-indigo-700">← Back to blog</a>
    </div>
    <article>
      <header class="mb-10">
        <time class="text-sm text-gray-400">${post.date}</time>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 leading-snug">${post.title}</h1>
        <p class="mt-3 text-lg text-gray-500">${post.excerpt}</p>
      </header>

      <div class="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

        <h2 class="text-xl font-bold text-gray-900 mt-10">The Cookie Problem Nobody Talks About</h2>
        <p>
          For most of the web's history, cookies were the backbone of analytics. You drop a cookie on a visitor's browser, give them a persistent ID, and track their journey across sessions. Simple, effective — and, as it turns out, a legal and technical minefield.
        </p>
        <p>
          The EU's General Data Protection Regulation (GDPR), which came into force in 2018, reclassified tracking cookies as personal data. That single change transformed every analytics script into a liability. Websites suddenly needed explicit, informed consent before setting any analytics cookie. The consent banner industry was born.
        </p>
        <p>
          The problem is that consent banners don't work. Studies consistently show that 30–60% of users dismiss or decline consent banners, which means traditional analytics tools are silently missing a third to a majority of your traffic. You're making product decisions based on incomplete data — and you don't even know how incomplete.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Ad Blockers Are Winning</h2>
        <p>
          Cookie banners are annoying enough that they've accelerated ad blocker adoption. As of 2026, roughly 40% of desktop users and 20% of mobile users run an ad blocker. Most ad blockers also block analytics scripts — including Google Analytics, Mixpanel, and Segment.
        </p>
        <p>
          If you're a developer-focused product or a technical blog, that number skews even higher. It's not unusual for 60–80% of visitors on a developer-facing site to have analytics blocked entirely. Your pageview counts are fiction.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">How Cookie-Free Analytics Works</h2>
        <p>
          Cookie-free analytics takes a fundamentally different approach: instead of identifying individual users with persistent IDs, it counts traffic by analyzing aggregated, non-personal signals.
        </p>
        <p>
          The key insight is that you usually don't need to know <em>who</em> visited — you need to know <em>how many</em> visited, <em>which pages</em> they viewed, and <em>where they came from</em>. You can answer all three questions without ever identifying a person.
        </p>
        <p>
          <strong>How unique visitor counting works without cookies:</strong> Take a set of non-identifying attributes — the date, the page path, the visitor's country, browser family, and screen width — and hash them together. Two requests with the same hash on the same day count as one unique visitor. The hash is never stored with any personal identifier; it's discarded after counting. This is called a <em>daily salt</em> approach, and it's both privacy-preserving and accurate enough for real-world traffic analysis.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">The Approaches Compared</h2>
        <p>
          There are a few different ways to do analytics without cookies, each with trade-offs:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Server-side logging:</strong> Parse your web server access logs. No JavaScript required — you get data even for users with JS disabled. Downside: requires server access and log infrastructure; can't capture single-page app navigation.</li>
          <li><strong>Fingerprinting:</strong> Combine browser characteristics (user agent, screen resolution, fonts, etc.) into a fingerprint. This is technically cookie-free but still identifies individuals — regulators treat it the same as cookies under GDPR. Avoid it.</li>
          <li><strong>Aggregated beacon tracking:</strong> A tiny JS snippet sends a small JSON payload (path, referrer, screen width, language) to an analytics endpoint on each pageview. No persistent ID is generated. The server counts traffic in aggregate. This is the approach used by <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam</a>, Plausible, and Fathom.</li>
        </ul>
        <p>
          The aggregated beacon approach is the sweet spot: you get accurate, real-time data without touching GDPR consent requirements.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Why Beam Exists</h2>
        <p>
          When we looked at the cookie-free analytics market, we found great products — but at prices that don't make sense for small projects. <a href="/vs/plausible" class="text-indigo-600 hover:text-indigo-700">Plausible starts at $9/month</a>. <a href="/vs/fathom" class="text-indigo-600 hover:text-indigo-700">Fathom starts at $15/month</a>. For a hobby project, a small blog, or an early-stage startup watching every dollar, that's a real barrier.
        </p>
        <p>
          That same trade-off shows up in other privacy analytics tools too. <a href="/vs/umami" class="text-indigo-600 hover:text-indigo-700">Umami is compelling if you want open-source self-hosting</a>, <a href="/vs/matomo" class="text-indigo-600 hover:text-indigo-700">Matomo is the heavyweight option for teams that want a larger suite</a>, and <a href="/vs/simple-analytics" class="text-indigo-600 hover:text-indigo-700">Simple Analytics is a polished hosted product with higher pricing</a>. Beam exists for the buyer who wants the privacy benefits without the hosting work or premium bill.
        </p>
        <p>
          Beam is built on Cloudflare's edge network — Workers, D1, and KV — which gives us a dramatically lower cost basis. We pass those savings to users: a free tier that covers most small sites (1 site, 50,000 pageviews/month), and a Pro plan at $5/month that covers unlimited sites up to 500,000 pageviews/month.
        </p>
        <p>
          The tracking script is under 2KB. There are no cookies, no consent banners, no data sold to advertisers, and no tracking of users across sites. It works with ad blockers (when self-hosted or proxied) and is fully GDPR compliant.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">How to Switch in Under 5 Minutes</h2>
        <ol class="list-decimal pl-6 space-y-2">
          <li><a href="/signup" class="text-indigo-600 hover:text-indigo-700">Create a free Beam account</a> — no credit card required.</li>
          <li>Add your site's domain in the dashboard.</li>
          <li>Copy the one-line script tag and paste it into your site's <code class="bg-gray-100 px-1 rounded text-sm">&lt;head&gt;</code>.</li>
          <li>Visit your site — you'll see your first pageview appear in real time.</li>
          <li>Remove your old analytics script and, if applicable, your consent banner.</li>
        </ol>
        <p>
          That's it. No build steps, no npm packages, no configuration files. Just a single <code class="bg-gray-100 px-1 rounded text-sm">&lt;script&gt;</code> tag.
        </p>

        <div class="bg-indigo-50 rounded-xl p-6 mt-10">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Ready to go cookie-free?</h3>
          <p class="text-gray-600 mb-4">Beam is free for up to 50,000 pageviews per month. No credit card required.</p>
          <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">Get Started Free →</a>
        </div>

      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Blog Post: Add Analytics in 5 Minutes ───────────────────────────────────

app.get('/blog/add-analytics-in-5-minutes', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const post = POSTS[1]!
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/blog/${post.slug}` },
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — Beam</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog/${post.slug}" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:url" content="${baseUrl}/blog/${post.slug}" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${post.date}" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-8">
      <a href="/blog" class="text-sm text-indigo-600 hover:text-indigo-700">← Back to blog</a>
    </div>
    <article>
      <header class="mb-10">
        <time class="text-sm text-gray-400">${post.date}</time>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 leading-snug">${post.title}</h1>
        <p class="mt-3 text-lg text-gray-500">${post.excerpt}</p>
      </header>

      <div class="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">
        <h2 class="text-xl font-bold text-gray-900 mt-10">Why You Need Analytics at All</h2>
        <p>
          If you run a website, you need a reliable answer to a few simple questions: which pages get attention, where visitors come from, and whether new content or launches actually create momentum. Without analytics, every change becomes guesswork. You publish a post, ship a feature, or share a link on social media, then hope something happened.
        </p>
        <p>
          The problem is that traditional analytics stacks often create more friction than insight. They are heavy, overbuilt, and tied to cookie consent flows that suppress a big portion of your traffic. For a personal site, SaaS landing page, documentation portal, or indie product, you usually do not need attribution modeling and advertising integrations. You need a fast answer to "what are people actually doing on my site?".
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">What Makes Google Analytics a Poor Fit for Many Sites</h2>
        <p>
          Google Analytics is powerful, but it is also optimized for Google's ecosystem and enterprise-style event complexity. That means more configuration, bigger scripts, and privacy trade-offs that many small teams never wanted in the first place. In practice, that often turns into a consent banner, lower data coverage, and a dashboard that takes too much effort to interpret.
        </p>
        <p>
          A cookie-free setup is usually a better fit when your goal is product decisions, content decisions, and simple traffic measurement. You get pageviews, referrers, countries, browsers, and device trends without identifying people. That keeps the implementation light and the compliance story much cleaner. If you are comparing options, the trade-offs are clearer on Beam's <a href="/vs/google-analytics" class="text-indigo-600 hover:text-indigo-700">Google Analytics alternative page</a> and <a href="/vs/plausible" class="text-indigo-600 hover:text-indigo-700">Plausible comparison page</a>.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Step 1: Sign Up and Create Your Site</h2>
        <p>
          Start by creating a free account at <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam signup</a>. Once you are in the dashboard, add the domain you want to track. Beam will generate a site ID and show you the exact tracking snippet for that site.
        </p>
        <p>
          This step takes less than a minute. There is no SDK to install, no npm package to version, and no dashboard wizard to click through for half an hour. The product is built around a single script tag because that is what most sites actually need.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Step 2: Copy the Tracking Snippet</h2>
        <p>
          Every Beam site gets a snippet like this. Replace <code class="bg-gray-100 px-1 rounded text-sm">YOUR_SITE_ID</code> with the real value from your dashboard:
        </p>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>&lt;script
  defer
  src="${baseUrl}/js/beam.js"
  data-site-id="YOUR_SITE_ID"&gt;
&lt;/script&gt;</code></pre>
        <p>
          Put it in the global layout or the shared HTML head for your site. The script sends lightweight pageview beacons to Beam. It does not set cookies, it respects Do Not Track, and it keeps the payload intentionally small.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Step 3: Install It on Your Stack</h2>
        <p>
          The exact placement depends on your framework, but the integration pattern is the same: include the script once in the document head so it loads on every page.
        </p>

        <h3 class="text-lg font-bold text-gray-900 mt-8">Plain HTML</h3>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>&lt;!doctype html&gt;
&lt;html lang="en"&gt;
  &lt;head&gt;
    &lt;meta charset="utf-8" /&gt;
    &lt;title&gt;My Site&lt;/title&gt;
    &lt;script
      defer
      src="${baseUrl}/js/beam.js"
      data-site-id="YOUR_SITE_ID"&gt;
    &lt;/script&gt;
  &lt;/head&gt;
  &lt;body&gt;...&lt;/body&gt;
&lt;/html&gt;</code></pre>

        <h3 class="text-lg font-bold text-gray-900 mt-8">React</h3>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>import { useEffect } from 'react'

export function AppShell() {
  useEffect(() =&gt; {
    const script = document.createElement('script')
    script.defer = true
    script.src = '${baseUrl}/js/beam.js'
    script.dataset.siteId = 'YOUR_SITE_ID'
    document.head.appendChild(script)

    return () =&gt; {
      script.remove()
    }
  }, [])

  return &lt;App /&gt;
}</code></pre>

        <h3 class="text-lg font-bold text-gray-900 mt-8">Next.js</h3>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    &lt;html lang="en"&gt;
      &lt;body&gt;
        {children}
        &lt;Script
          src="${baseUrl}/js/beam.js"
          strategy="afterInteractive"
          data-site-id="YOUR_SITE_ID"
        /&gt;
      &lt;/body&gt;
    &lt;/html&gt;
  )
}</code></pre>

        <h3 class="text-lg font-bold text-gray-900 mt-8">WordPress</h3>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>function beam_analytics_script() {
  ?&gt;
  &lt;script
    defer
    src="${baseUrl}/js/beam.js"
    data-site-id="YOUR_SITE_ID"&gt;
  &lt;/script&gt;
  &lt;?php
}
add_action('wp_head', 'beam_analytics_script');</code></pre>

        <h3 class="text-lg font-bold text-gray-900 mt-8">Static Site Generators</h3>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>&lt;!-- Hugo, Eleventy, Astro, Jekyll, etc. --&gt;
&lt;!-- Add this to your shared head partial or base layout --&gt;
&lt;script
  defer
  src="${baseUrl}/js/beam.js"
  data-site-id="YOUR_SITE_ID"&gt;
&lt;/script&gt;</code></pre>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Step 4: Verify That Data Is Arriving</h2>
        <p>
          After you install the script, open your site in a new tab and load a few pages. Then return to Beam and open your site analytics view. You should see pageviews appear quickly, along with top pages, referrers, countries, browsers, and device breakdowns.
        </p>
        <p>
          If nothing appears, the usual causes are straightforward: the snippet is missing from the rendered page, the <code class="bg-gray-100 px-1 rounded text-sm">data-site-id</code> is wrong, or the script is only included on one template instead of the shared layout. A quick browser source check usually catches the problem in under a minute.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">What You Get Once It Is Live</h2>
        <p>
          The immediate value is clarity. You can see whether your launch post is working, which docs page attracts attention, which referrers actually send traffic, and whether your free-to-paid funnel is improving over time. You do not need a warehouse project to get that signal. For most teams, a focused dashboard is a better operational tool than a sprawling analytics suite.
        </p>
        <p>
          Beam's free tier covers one site and up to 50,000 pageviews per month, which is enough for many small products, blogs, and portfolios. If you outgrow that, Pro is $5 per month. That keeps the tool accessible for developers who care about privacy but do not want to self-host or justify a much higher SaaS bill.
        </p>

        <div class="bg-indigo-50 rounded-xl p-6 mt-10">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Install analytics without cookies</h3>
          <p class="text-gray-600 mb-4">Create your site, copy one snippet, and verify your first pageview in a few minutes.</p>
          <div class="flex flex-wrap gap-3">
            <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">Start with Beam</a>
            <a href="/vs/google-analytics" class="inline-block border border-indigo-200 text-indigo-700 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-100 transition-colors">Compare alternatives</a>
          </div>
        </div>
      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Blog Post: Privacy Analytics for Next.js Apps ───────────────────────────

app.get('/blog/nextjs-privacy-analytics', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const baseHost = publicHost(baseUrl)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const post = POSTS[2]!
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/blog/${post.slug}` },
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — Beam</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog/${post.slug}" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:url" content="${baseUrl}/blog/${post.slug}" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${post.date}" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-8">
      <a href="/blog" class="text-sm text-indigo-600 hover:text-indigo-700">← Back to blog</a>
    </div>
    <article>
      <header class="mb-10">
        <time class="text-sm text-gray-400">${post.date}</time>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 leading-snug">${post.title}</h1>
        <p class="mt-3 text-lg text-gray-500">${post.excerpt}</p>
      </header>

      <div class="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

        <h2 class="text-xl font-bold text-gray-900 mt-10">Why Next.js Developers Need to Think Carefully About Analytics</h2>
        <p>
          Next.js powers millions of production applications, from indie SaaS products to Fortune 500 websites. Every one of them eventually adds analytics — and most reach for Google Analytics by default. It's free, it's familiar, and there are thousands of tutorials for it.
        </p>
        <p>
          But Google Analytics has a surprisingly poor fit with the Next.js architecture, and it comes with legal and performance costs that aren't always obvious upfront. This guide covers why privacy-first analytics like <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam</a> are a better default for Next.js apps, and exactly how to integrate them with both the Pages Router and the App Router.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">The Problems with Google Analytics in Next.js</h2>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">1. Hydration and the Single-Page App Problem</h3>
        <p>
          Next.js apps are SPAs after the initial load. The browser doesn't trigger a full page reload on client-side navigation — it just swaps content. Traditional GA snippets track pageviews by listening for the browser's load event, which only fires on the first visit. Every subsequent navigation in your Next.js app is invisible to a naive GA setup.
        </p>
        <p>
          The fix involves hooking into Next.js's router events (<code class="bg-gray-100 px-1 rounded text-sm">routeChangeComplete</code> in the Pages Router, or intercepting the native History API in the App Router). This works, but it's boilerplate you need to maintain, and it breaks whenever Next.js changes its routing internals. Beam's script handles single-page app navigation automatically — no custom router integration required.
        </p>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">2. Content Security Policy Conflicts</h3>
        <p>
          If your Next.js app sets strict Content Security Policy headers — which you should, especially if you're handling user data — Google Analytics is a problem. GA loads scripts from <code class="bg-gray-100 px-1 rounded text-sm">www.google-analytics.com</code>, <code class="bg-gray-100 px-1 rounded text-sm">www.googletagmanager.com</code>, and several other domains, all of which need to be whitelisted in your <code class="bg-gray-100 px-1 rounded text-sm">script-src</code> and <code class="bg-gray-100 px-1 rounded text-sm">connect-src</code> directives. This meaningfully weakens your CSP.
        </p>
        <p>
          Beam sends data to a single first-party endpoint (<code class="bg-gray-100 px-1 rounded text-sm">${baseHost}</code>), making your CSP configuration simpler and more restrictive.
        </p>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">3. GDPR Consent Requirements</h3>
        <p>
          Google Analytics sets third-party cookies and transfers personal data (IP addresses) to Google's servers. Under GDPR, this requires explicit user consent before the script loads. You need a consent banner. Users reject it. Your analytics miss 30–60% of visitors. The data you do collect is skewed toward users who actively click "accept" — not a random sample of your audience.
        </p>
        <p>
          Cookie-free analytics like Beam require no consent mechanism. There are no cookies, no cross-site tracking, and no personal data transferred to third parties. You get accurate, complete data from every visitor — without legal risk.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Setting Up Beam in the Pages Router</h2>
        <p>
          The Pages Router uses a custom <code class="bg-gray-100 px-1 rounded text-sm">_app.tsx</code> (or <code class="bg-gray-100 px-1 rounded text-sm">_app.js</code>) file as the root component that wraps every page. This is the right place to add the Beam script so it loads on every page load and client-side navigation.
        </p>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">Using the Next.js Script Component</h3>
        <p>
          Next.js ships a built-in <code class="bg-gray-100 px-1 rounded text-sm">Script</code> component that handles loading strategy, deduplication, and performance optimisation. Use it with <code class="bg-gray-100 px-1 rounded text-sm">strategy="afterInteractive"</code> for analytics:
        </p>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>// pages/_app.tsx
import type { AppProps } from 'next/app'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  return (
    &lt;&gt;
      &lt;Script
        src="${baseUrl}/js/beam.js"
        data-site-id="YOUR_SITE_ID"
        strategy="afterInteractive"
      /&gt;
      &lt;Component {...pageProps} /&gt;
    &lt;/&gt;
  )
}</code></pre>
        <p>
          Replace <code class="bg-gray-100 px-1 rounded text-sm">YOUR_SITE_ID</code> with the site ID from your Beam dashboard. The <code class="bg-gray-100 px-1 rounded text-sm">afterInteractive</code> strategy loads the script after the page becomes interactive — ideal for analytics that shouldn't block rendering.
        </p>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">Tracking Dynamic Route Changes</h3>
        <p>
          Beam's script automatically listens for <code class="bg-gray-100 px-1 rounded text-sm">pushState</code> and <code class="bg-gray-100 px-1 rounded text-sm">replaceState</code> calls to detect client-side navigation. This means dynamic route changes in <code class="bg-gray-100 px-1 rounded text-sm">/pages/[slug].tsx</code>, <code class="bg-gray-100 px-1 rounded text-sm">/pages/products/[id].tsx</code>, and similar patterns are tracked automatically without any extra configuration.
        </p>
        <p>
          If you want to verify tracking is working, open your browser's DevTools Network tab and navigate between pages. You should see <code class="bg-gray-100 px-1 rounded text-sm">POST /api/collect</code> requests to Beam on each navigation.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Setting Up Beam in the App Router</h2>
        <p>
          The App Router introduced in Next.js 13 uses a different file structure. Analytics belong in the root layout file, which wraps the entire application.
        </p>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">Adding to app/layout.tsx</h3>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    &lt;html lang="en"&gt;
      &lt;body&gt;
        {children}
        &lt;Script
          src="${baseUrl}/js/beam.js"
          data-site-id="YOUR_SITE_ID"
          strategy="afterInteractive"
        /&gt;
      &lt;/body&gt;
    &lt;/html&gt;
  )
}</code></pre>
        <p>
          Placing the <code class="bg-gray-100 px-1 rounded text-sm">Script</code> component inside the root layout ensures it loads on every route, including nested layouts and pages. The App Router's React Server Components architecture means the <code class="bg-gray-100 px-1 rounded text-sm">Script</code> component from <code class="bg-gray-100 px-1 rounded text-sm">next/script</code> handles deduplication automatically — you won't get duplicate script loads even if multiple layouts are nested.
        </p>

        <h3 class="text-lg font-semibold text-gray-900 mt-8">Environment Variable for the Site ID</h3>
        <p>
          Rather than hardcoding the site ID, use a Next.js public environment variable:
        </p>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>// .env.local
NEXT_PUBLIC_BEAM_SITE_ID=your-site-id-here</code></pre>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>// app/layout.tsx
&lt;Script
  src="${baseUrl}/js/beam.js"
  data-site-id={process.env.NEXT_PUBLIC_BEAM_SITE_ID}
  strategy="afterInteractive"
/&gt;</code></pre>
        <p>
          Variables prefixed with <code class="bg-gray-100 px-1 rounded text-sm">NEXT_PUBLIC_</code> are inlined into the client bundle at build time, so they're available in both Server Components and Client Components.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Configuring CSP Headers in next.config.js</h2>
        <p>
          If you use Content Security Policy headers, you'll need to allow the Beam script and its collection endpoint. Add these to your <code class="bg-gray-100 px-1 rounded text-sm">next.config.js</code>:
        </p>
<pre class="bg-gray-950 text-gray-100 rounded-2xl p-5 overflow-x-auto text-sm"><code>// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Allow Beam tracking script and collection endpoint
      "script-src 'self' 'unsafe-inline' ${baseUrl}",
      "connect-src 'self' ${baseUrl}",
      // Add other sources your app needs...
    ].join('; '),
  },
]

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}</code></pre>
        <p>
          This is significantly cleaner than the equivalent configuration for Google Analytics, which requires allowlisting Google's analytics, tag manager, and ad domains.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Verifying Your Setup</h2>
        <p>
          Once you've added the script, verify that data is flowing:
        </p>
        <ol class="list-decimal pl-6 space-y-2">
          <li>Open your Next.js app in a browser.</li>
          <li>Navigate to a few different pages (including dynamic routes like <code class="bg-gray-100 px-1 rounded text-sm">/blog/my-post</code>).</li>
          <li>Open your <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam dashboard</a> — you should see pageviews appearing in real time, with the correct paths shown for each route.</li>
          <li>Check the Top Pages breakdown to confirm dynamic routes (e.g., <code class="bg-gray-100 px-1 rounded text-sm">/blog/my-post</code>, <code class="bg-gray-100 px-1 rounded text-sm">/products/42</code>) are tracked individually.</li>
        </ol>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Comparing Your Options</h2>
        <p>
          If you're evaluating Beam against other analytics tools for your Next.js project:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><a href="/vs/google-analytics" class="text-indigo-600 hover:text-indigo-700">Beam vs Google Analytics</a> — the full comparison on privacy, GDPR compliance, and Next.js integration complexity.</li>
          <li>Beam vs Plausible — both are cookie-free; Beam costs $5/mo vs Plausible's $9/mo starting price.</li>
          <li>For a general overview of all options, see our <a href="/blog/add-analytics-in-5-minutes" class="text-indigo-600 hover:text-indigo-700">5-minute setup guide</a> covering HTML, React, WordPress, and static site generators.</li>
        </ul>

        <div class="bg-indigo-50 rounded-xl p-6 mt-10">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Add privacy-first analytics to your Next.js app</h3>
          <p class="text-gray-600 mb-4">Free for up to 50,000 pageviews/month. Works with Pages Router and App Router. No cookies, no consent banner required.</p>
          <div class="flex flex-wrap gap-3">
            <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">Get Started Free →</a>
            <a href="/vs/google-analytics" class="inline-block border border-indigo-200 text-indigo-700 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-100 transition-colors">Compare to Google Analytics</a>
          </div>
        </div>

      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Blog Post: Google Analytics Alternatives 2026 ───────────────────────────

app.get('/blog/google-analytics-alternatives-2026', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const post = POSTS.find(p => p.slug === 'google-analytics-alternatives-2026')!
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/blog/${post.slug}` },
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — Beam</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog/${post.slug}" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:url" content="${baseUrl}/blog/${post.slug}" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${post.date}" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-8">
      <a href="/blog" class="text-sm text-indigo-600 hover:text-indigo-700">← Back to blog</a>
    </div>
    <article>
      <header class="mb-10">
        <time class="text-sm text-gray-400">${post.date}</time>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 leading-snug">${post.title}</h1>
        <p class="mt-3 text-lg text-gray-500">${post.excerpt}</p>
      </header>

      <div class="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

        <h2 class="text-xl font-bold text-gray-900 mt-10">Why Google Analytics Is Losing Ground</h2>
        <p>
          Google Analytics 4 is powerful — and also widely disliked. The interface is confusing, the event model is complex, the privacy story is complicated, and it requires a consent banner in most jurisdictions. For teams that just want to know what pages are getting traffic and where visitors come from, GA4 is significantly more than what's needed.
        </p>
        <p>
          The result is a growing ecosystem of privacy-first alternatives, each with a different philosophy on hosting, pricing, and feature depth. This guide covers eight of the most popular options honestly, including where each one shines and where it falls short.
        </p>
        <p>
          If your decision is already "replace GA4 this week," start with the <a href="/migrate/google-analytics" class="text-indigo-600 hover:text-indigo-700">Google Analytics migration checklist</a> for a concrete cutover sequence.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Quick Comparison Table</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 font-semibold text-gray-700">Tool</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-700">Starting Price</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Open Source</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Cookieless</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">GDPR Compliant</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Custom Events</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Self-Hosted</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="bg-indigo-50">
                <td class="px-4 py-3 font-semibold text-indigo-700">Beam</td>
                <td class="px-4 py-3">Free / $5/mo</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Plausible</td>
                <td class="px-4 py-3">$9/mo</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Fathom</td>
                <td class="px-4 py-3">$15/mo</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Simple Analytics</td>
                <td class="px-4 py-3">$19/mo</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Umami</td>
                <td class="px-4 py-3">Free (self-host) / $9/mo cloud</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Matomo</td>
                <td class="px-4 py-3">Free (self-host) / €23/mo cloud</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">PostHog</td>
                <td class="px-4 py-3">Free (generous limits)</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">Partial</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Usermaven</td>
                <td class="px-4 py-3">$14/mo</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">1. Beam — Best for Simplicity and Price</h2>
        <p>
          <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam</a> is a privacy-first analytics tool built on Cloudflare's edge network (Workers, D1, KV). The tracking script is under 2KB, there are no cookies, and the free tier covers one site with up to 50,000 pageviews per month. Pro is $5/month — the most affordable hosted option in this list.
        </p>
        <p>
          <strong>Strengths:</strong> Lowest price, cookieless by design, open-source tracking script, custom event support, runs at the edge for low latency worldwide.
        </p>
        <p>
          <strong>Weaknesses:</strong> Newer product with a smaller ecosystem, no funnel analysis or user journey tracking, fewer third-party integrations.
        </p>
        <p>
          Best for: indie developers, small SaaS products, blogs, and anyone who wants honest traffic data at the lowest possible cost.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">2. Plausible — Best Overall for Small Teams</h2>
        <p>
          <a href="/vs/plausible" class="text-indigo-600 hover:text-indigo-700">Plausible</a> is probably the most well-known GA alternative. It launched in 2018, has a mature product, strong documentation, and a large community. The hosted plan starts at $9/month for up to 10,000 pageviews; it's also fully open-source and self-hostable.
        </p>
        <p>
          <strong>Strengths:</strong> Polished UI, solid documentation, community-maintained integrations, active development, EU-based hosting option for strict GDPR requirements.
        </p>
        <p>
          <strong>Weaknesses:</strong> No free tier for hosted (only a 30-day trial), pricing scales up meaningfully for high-traffic sites.
        </p>
        <p>
          Best for: small teams and indie hackers who want a proven hosted product and are willing to pay for quality.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">3. Fathom — Best for Simplicity Without Self-Hosting</h2>
        <p>
          <a href="/vs/fathom" class="text-indigo-600 hover:text-indigo-700">Fathom</a> is a simple, polished hosted analytics product. It's not open-source, but it's focused purely on privacy-first analytics with a clean dashboard. Plans start at $15/month for unlimited sites and up to 100,000 pageviews.
        </p>
        <p>
          <strong>Strengths:</strong> Extremely clean UI, strong uptime track record, easy to use, unlimited sites on all plans, good customer support.
        </p>
        <p>
          <strong>Weaknesses:</strong> No open-source option, no self-hosting, higher price point compared to Beam or Plausible, no free tier.
        </p>
        <p>
          Best for: teams that want a polished hosted product and don't need open-source or self-hosting.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">4. Simple Analytics — Best for Clean Data and Importers</h2>
        <p>
          <a href="/vs/simple-analytics" class="text-indigo-600 hover:text-indigo-700">Simple Analytics</a> is a Dutch analytics company focused on privacy and simplicity. It has a clean dashboard, strong data export features, and useful tools for importing historical data. Plans start at $19/month.
        </p>
        <p>
          <strong>Strengths:</strong> Great data ownership, EU-based and privacy-friendly, good import tools, clean design.
        </p>
        <p>
          <strong>Weaknesses:</strong> Most expensive in this tier, no open-source option, no self-hosting option.
        </p>
        <p>
          Best for: teams with strict EU data residency requirements who value data ownership.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">5. Umami — Best Free Self-Hosted Option</h2>
        <p>
          <a href="/vs/umami" class="text-indigo-600 hover:text-indigo-700">Umami</a> is an open-source analytics tool you can self-host for free. The dashboard is clean, it supports custom events, and it handles multiple sites. There's also a cloud-hosted version starting at $9/month if you don't want to manage infrastructure.
        </p>
        <p>
          <strong>Strengths:</strong> Free when self-hosted, fully open-source, clean UI, active community, custom events, supports unlimited sites.
        </p>
        <p>
          <strong>Weaknesses:</strong> Self-hosting requires maintaining a server and database — it's operational work. Cloud version doesn't have a free tier.
        </p>
        <p>
          Best for: developers comfortable managing a Node.js app and database who want zero hosting costs.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">6. Matomo — Best for Feature Depth</h2>
        <p>
          <a href="/vs/matomo" class="text-indigo-600 hover:text-indigo-700">Matomo</a> is the heavyweight in this comparison. It has the deepest feature set — heatmaps, session recordings, A/B testing, e-commerce analytics, funnel analysis — and is the closest direct replacement for GA4 in terms of capability. The self-hosted version is free and open-source; cloud plans start at €23/month.
        </p>
        <p>
          <strong>Strengths:</strong> Most feature-complete option in the market, strong compliance tooling, full data ownership when self-hosted, established product with over a decade of history.
        </p>
        <p>
          <strong>Weaknesses:</strong> Complex setup and maintenance if self-hosting, heavier script than alternatives, UI can feel dated, cloud pricing scales up quickly.
        </p>
        <p>
          Best for: enterprises and teams migrating off GA4 who need feature parity, or legal/compliance teams with strict data governance requirements.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">7. PostHog — Best for Product Analytics</h2>
        <p>
          PostHog is a different category of tool — it's a product analytics platform, not just a web analytics tool. It covers event tracking, session recordings, feature flags, A/B testing, funnels, cohorts, and more. The free tier is generous (1 million events/month), and the self-hosted version is open-source.
        </p>
        <p>
          <strong>Strengths:</strong> Comprehensive product analytics suite, generous free tier, open-source, excellent for SaaS products tracking user behavior inside apps, strong SDK ecosystem.
        </p>
        <p>
          <strong>Weaknesses:</strong> Uses cookies by default (cookieless mode available but limited), more complex to configure for simple pageview tracking, overkill if you just need traffic metrics.
        </p>
        <p>
          Best for: SaaS products that need in-app event tracking, funnels, and user cohort analysis alongside web analytics.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">8. Usermaven — Best for Marketing Attribution</h2>
        <p>
          Usermaven is a privacy-friendly analytics platform that combines web analytics with product analytics features and marketing attribution. Plans start at $14/month and it targets marketing and growth teams specifically.
        </p>
        <p>
          <strong>Strengths:</strong> Good attribution modeling, clean dashboards, combines marketing and product analytics, GDPR compliant.
        </p>
        <p>
          <strong>Weaknesses:</strong> No open-source version, no self-hosting option, less community and ecosystem compared to Plausible or PostHog, newer product.
        </p>
        <p>
          Best for: growth and marketing teams that need attribution analytics alongside privacy compliance.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">How to Choose</h2>
        <p>
          The right tool depends on what you're actually measuring:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Simple traffic metrics for a small site or blog?</strong> Beam (free tier), Plausible, or Umami (self-hosted) are the right fit. Keep it simple.</li>
          <li><strong>In-app product analytics and user behavior?</strong> PostHog is in a different class. It's built for this.</li>
          <li><strong>GA4 feature parity — heatmaps, recordings, e-commerce?</strong> Matomo is the only real option here.</li>
          <li><strong>Strict EU data residency?</strong> Plausible (EU infrastructure) or Simple Analytics (Netherlands-based) are strong choices.</li>
          <li><strong>Zero hosting cost?</strong> Umami or Matomo self-hosted. Note the operational overhead.</li>
          <li><strong>Lowest hosted price?</strong> Beam at $5/month Pro is the most affordable paid plan in this list.</li>
        </ul>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Why We Built Beam</h2>
        <p>
          The privacy analytics market had a gap: there wasn't a polished hosted option for teams watching every dollar. Plausible at $9/month and Fathom at $15/month are excellent products, but they're priced for teams — not individual developers or early-stage founders with a handful of small projects.
        </p>
        <p>
          We built Beam on Cloudflare's infrastructure (Workers + D1) because the cost basis is dramatically lower than traditional server/database hosting. That lets us offer a genuinely competitive price — $5/month for unlimited sites and up to 500,000 pageviews — while keeping the product focused on what small teams actually use: pageviews, referrers, top pages, geography, and custom events.
        </p>
        <p>
          We're honest that Beam isn't the right choice if you need PostHog-style product analytics or Matomo's feature depth. But if you want clean, accurate traffic data at the lowest possible cost with zero privacy compliance headaches, Beam is worth trying.
        </p>

        <div class="bg-indigo-50 rounded-xl p-6 mt-10">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Try Beam free — no credit card required</h3>
          <p class="text-gray-600 mb-4">Free tier includes 1 site and 50,000 pageviews per month. Pro is $5/month for unlimited sites.</p>
          <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">Get Started Free →</a>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">More Comparisons</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li><a href="/vs/google-analytics" class="text-indigo-600 hover:text-indigo-700">Beam vs Google Analytics</a></li>
          <li><a href="/vs/cloudflare-web-analytics" class="text-indigo-600 hover:text-indigo-700">Beam vs Cloudflare Web Analytics</a></li>
          <li><a href="/vs/plausible" class="text-indigo-600 hover:text-indigo-700">Beam vs Plausible</a></li>
          <li><a href="/vs/fathom" class="text-indigo-600 hover:text-indigo-700">Beam vs Fathom</a></li>
          <li><a href="/vs/simple-analytics" class="text-indigo-600 hover:text-indigo-700">Beam vs Simple Analytics</a></li>
          <li><a href="/vs/umami" class="text-indigo-600 hover:text-indigo-700">Beam vs Umami</a></li>
          <li><a href="/vs/matomo" class="text-indigo-600 hover:text-indigo-700">Beam vs Matomo</a></li>
          <li><a href="/vs/rybbit" class="text-indigo-600 hover:text-indigo-700">Beam vs Rybbit</a></li>
        </ul>

      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Blog Post: beamanalytics.io Shutdown Migration Guide ────────────────────

app.get('/blog/beam-analytics-shutdown-migration-guide', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const post = POSTS.find(p => p.slug === 'beam-analytics-shutdown-migration-guide')!
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/blog/${post.slug}` },
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — Beam</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog/${post.slug}" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:url" content="${baseUrl}/blog/${post.slug}" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${post.date}" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-8">
      <a href="/blog" class="text-sm text-indigo-600 hover:text-indigo-700">← Back to blog</a>
    </div>
    <article>
      <header class="mb-10">
        <time class="text-sm text-gray-400">${post.date}</time>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 leading-snug">${post.title}</h1>
        <p class="mt-3 text-lg text-gray-500">${post.excerpt}</p>
      </header>

      <div class="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

        <div class="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          <strong>Key date:</strong> beamanalytics.io is shutting down on <strong>September 1, 2026</strong>. After that date, tracking will stop and your dashboard will become inaccessible. Export your data now.
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">What Happened</h2>
        <p>
          beamanalytics.io is shutting down on September 1, 2026. The product was launched in January 2023 by founders JR and Leng Lee and offered one of the most generous free tiers in the privacy analytics space — 100K pageviews per month at no cost. The team has decided to wind down the product, and users need to migrate to a different analytics provider before that date to avoid losing their tracking data going forward.
        </p>
        <p>
          If you're a beamanalytics.io user, you have a few months to make a decision — but the sooner you act, the more historical data you'll be able to capture from your new provider before the cutover. The <a href="/migrate/beam-analytics" class="text-indigo-600 hover:text-indigo-700">step-by-step migration guide</a> on this site walks through the full process.
        </p>
        <p>
          The migration is being actively tracked by the community — beamanalytics.io appears on <a href="https://www.uneed.best/alternatives/beam_analytics" class="text-indigo-600 hover:text-indigo-700" rel="noopener noreferrer">Uneed.best's Beam Analytics alternatives page</a>, where users are looking for replacements.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Step 1: Export Your Data First</h2>
        <p>
          Before switching anything, download your historical data from beamanalytics.io. Data export is available from your dashboard settings — look for the export option there. Do this regardless of which tool you choose next — you'll want a record of your historical traffic even if your new provider can't import it.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Your Migration Options</h2>
        <p>
          There are several privacy-first analytics tools that cover similar use cases to beamanalytics.io. Here's an honest comparison to help you choose.
        </p>

        <h3 class="text-lg font-bold text-gray-900 mt-8">1. Beam — Best Value for Indie Makers</h3>
        <p>
          <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam</a> is a privacy-first analytics tool with a free tier (1 site, 50K pageviews/month) and a $5/month Pro plan for unlimited sites. Like beamanalytics.io, it's cookieless, GDPR-compliant, and focused on simple traffic metrics rather than complex event pipelines.
        </p>
        <p>
          <strong>Why it's a close match:</strong> The product philosophy is similar — fast, lightweight, privacy-respecting analytics without the complexity of GA4. The tracking script is under 2KB and there's no consent banner required. If you were happy with beamanalytics.io's simplicity, Beam is probably the most natural landing spot.
        </p>
        <p>
          <strong>What's different:</strong> Beam runs on Cloudflare's global edge network (Workers + D1), adds custom event support, goal/conversion tracking, and a traffic channel breakdown. The free tier is permanent, not a trial.
        </p>
        <p>
          <strong>Pricing:</strong> Free (1 site, 50K pageviews/month) or $5/month Pro (unlimited sites, 500K pageviews/month).
        </p>
        <p>
          See the full <a href="/migrate/beam-analytics" class="text-indigo-600 hover:text-indigo-700">beamanalytics.io → Beam migration checklist</a>, or check the <a href="/beam-analytics-alternative" class="text-indigo-600 hover:text-indigo-700">Beam as a beamanalytics.io alternative</a> overview page.
        </p>

        <h3 class="text-lg font-bold text-gray-900 mt-8">2. Plausible — Best Established Privacy-First Option</h3>
        <p>
          <a href="https://plausible.io" class="text-indigo-600 hover:text-indigo-700" rel="noopener noreferrer">Plausible</a> is the most widely used privacy-first web analytics tool. It launched in 2018 and has a mature, well-documented product. Plans start at $9/month for up to 10,000 pageviews; it's open-source and also self-hostable.
        </p>
        <p>
          <strong>Strengths:</strong> Polished UI, active development, strong community, EU-based hosting option, good documentation. This is the tool most beamanalytics.io users are probably familiar with as the "default" privacy analytics alternative.
        </p>
        <p>
          <strong>Weaknesses:</strong> No permanent free tier (30-day trial only), pricing scales with pageviews and can get expensive for high-traffic sites.
        </p>
        <p>
          <strong>Pricing:</strong> $9/month for up to 10K pageviews; scales up with traffic.
        </p>

        <h3 class="text-lg font-bold text-gray-900 mt-8">3. Fathom — Best for Simplicity</h3>
        <p>
          <a href="https://usefathom.com" class="text-indigo-600 hover:text-indigo-700" rel="noopener noreferrer">Fathom</a> is a clean, hosted-only analytics tool. It's not open-source but has a strong track record for uptime and reliability. Plans start at $15/month and include unlimited sites.
        </p>
        <p>
          <strong>Strengths:</strong> Very clean dashboard, unlimited sites on all plans, strong uptime history, excellent customer support.
        </p>
        <p>
          <strong>Weaknesses:</strong> No free tier, no open-source or self-hosting option, higher price point.
        </p>
        <p>
          <strong>Pricing:</strong> $15/month for unlimited sites and up to 100K pageviews.
        </p>

        <h3 class="text-lg font-bold text-gray-900 mt-8">4. Umami — Best Free Self-Hosted Option</h3>
        <p>
          <a href="https://umami.is" class="text-indigo-600 hover:text-indigo-700" rel="noopener noreferrer">Umami</a> is a free, open-source analytics tool you can host yourself. It supports custom events and multiple sites. A managed cloud version is also available for $9/month if you'd rather not manage infrastructure.
        </p>
        <p>
          <strong>Strengths:</strong> Free if self-hosted, clean UI, open-source, active community, no pageview limits on self-hosted.
        </p>
        <p>
          <strong>Weaknesses:</strong> Self-hosting requires a server and database — ongoing operational work. No free tier on the cloud version.
        </p>
        <p>
          <strong>Pricing:</strong> Free (self-hosted) or $9/month (cloud).
        </p>

        <h3 class="text-lg font-bold text-gray-900 mt-8">5. Simple Analytics — Best for EU Data Residency</h3>
        <p>
          <a href="https://simpleanalytics.com" class="text-indigo-600 hover:text-indigo-700" rel="noopener noreferrer">Simple Analytics</a> is a Netherlands-based privacy-first analytics service with strong data export tooling and EU data residency guarantees.
        </p>
        <p>
          <strong>Strengths:</strong> EU-based, strong privacy guarantees, good data export features, clean interface.
        </p>
        <p>
          <strong>Weaknesses:</strong> Most expensive in this category at $19/month; no open-source or self-hosting option.
        </p>
        <p>
          <strong>Pricing:</strong> $19/month starter.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Quick Comparison</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 font-semibold text-gray-700">Tool</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-700">Starting Price</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Free Tier</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Open Source</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Self-Host</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-700">Cookieless</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="bg-indigo-50">
                <td class="px-4 py-3 font-semibold text-indigo-700">Beam</td>
                <td class="px-4 py-3">Free / $5/mo</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Plausible</td>
                <td class="px-4 py-3">$9/mo</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Fathom</td>
                <td class="px-4 py-3">$15/mo</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Umami</td>
                <td class="px-4 py-3">Free (self-host) / $9/mo</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-gray-800">Simple Analytics</td>
                <td class="px-4 py-3">$19/mo</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center text-gray-400">—</td>
                <td class="px-4 py-3 text-center">✓</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">How to Choose</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Want the closest match to beamanalytics.io's simplicity at the lowest cost?</strong> <a href="/signup" class="text-indigo-600 hover:text-indigo-700">Beam</a> — free tier available, $5/mo Pro.</li>
          <li><strong>Want the most established, well-documented option?</strong> Plausible — mature product, large community.</li>
          <li><strong>Want zero hosting cost and don't mind managing a server?</strong> Umami self-hosted.</li>
          <li><strong>Want strict EU data residency?</strong> Plausible (EU infrastructure) or Simple Analytics (Netherlands).</li>
          <li><strong>Want unlimited sites at a flat price without self-hosting?</strong> Fathom at $15/month.</li>
        </ul>

        <h2 class="text-xl font-bold text-gray-900 mt-10">What's Not Covered Here</h2>
        <p>
          This guide focuses on lightweight, privacy-first web analytics tools — the category where beamanalytics.io competed. If you need product analytics (in-app event funnels, user cohorts, session recordings), you're probably looking at a different category of tool like PostHog or Mixpanel. If you need enterprise reporting with full GA4 feature parity, Matomo is worth evaluating. Those use cases are out of scope for this comparison.
        </p>

        <div class="bg-indigo-50 rounded-xl p-6 mt-10">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Ready to migrate? Start with the step-by-step guide.</h3>
          <p class="text-gray-600 mb-4">The beamanalytics.io → Beam migration checklist covers data export, script swap, and verification — about 15 minutes total.</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="/migrate/beam-analytics" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors text-center">View Migration Checklist →</a>
            <a href="/signup" class="inline-block border border-indigo-600 text-indigo-600 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-50 transition-colors text-center">Try Beam Free</a>
            <a href="/demo" class="inline-block border border-gray-200 text-gray-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors text-center">See Demo</a>
          </div>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">More Resources</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li><a href="/migrate/beam-analytics" class="text-indigo-600 hover:text-indigo-700">beamanalytics.io migration checklist</a> — step-by-step cutover guide</li>
          <li><a href="/beam-analytics-alternative" class="text-indigo-600 hover:text-indigo-700">Beam as a beamanalytics.io alternative</a> — detailed feature comparison</li>
          <li><a href="/blog/google-analytics-alternatives-2026" class="text-indigo-600 hover:text-indigo-700">Google Analytics alternatives in 2026</a> — broader comparison if you're evaluating all options</li>
          <li><a href="/demo" class="text-indigo-600 hover:text-indigo-700">Live Beam demo</a> — see what the dashboard looks like before signing up</li>
        </ul>

      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── Blog Post: Why We Built a Plausible Alternative ─────────────────────────

app.get('/blog/plausible-alternative', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
  const post = POSTS.find(p => p.slug === 'plausible-alternative')!
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Keylight Digital LLC', url: baseUrl },
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/blog/${post.slug}` },
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — Beam</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/blog/${post.slug}" />
  <link rel="alternate" type="application/rss+xml" title="Beam Blog" href="/blog/rss.xml" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:url" content="${baseUrl}/blog/${post.slug}" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${post.date}" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-8">
      <a href="/blog" class="text-sm text-indigo-600 hover:text-indigo-700">← Back to blog</a>
    </div>
    <article>
      <header class="mb-10">
        <time class="text-sm text-gray-400">${post.date}</time>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 leading-snug">${post.title}</h1>
        <p class="mt-3 text-lg text-gray-500">${post.excerpt}</p>
      </header>

      <div class="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

        <h2 class="text-xl font-bold text-gray-900 mt-10">Let's Start With What Plausible Does Well</h2>
        <p>
          This post is not a hit piece. <a href="/vs/plausible" class="text-indigo-600 hover:text-indigo-700">Plausible Analytics</a> is a genuinely good product. The founding team (Uku Täht and Marko Saric) built something important: a European, open-source, privacy-first alternative to Google Analytics at a time when the market offered very little in that direction.
        </p>
        <p>
          Plausible gets a lot right:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>No cookies, no consent banner required.</strong> Plausible does not use cookies or store personal data. That's a serious advantage over GA4 and most traditional tools.</li>
          <li><strong>EU-based infrastructure.</strong> Plausible runs on servers in Germany and France, which matters for GDPR compliance and for teams that have strict data residency requirements.</li>
          <li><strong>Open source.</strong> The core product is open source (AGPL-3.0). You can audit it, contribute to it, or self-host it on your own infrastructure.</li>
          <li><strong>Clean, readable dashboard.</strong> Plausible's single-page dashboard is genuinely nice. Pageviews, unique visitors, bounce rate, top sources, and top pages are all visible at once without drilling through report menus.</li>
          <li><strong>Custom events and goals.</strong> Goal and conversion tracking is available on all plans, which is a meaningful feature for teams tracking signups, purchases, or other key actions.</li>
        </ul>
        <p>
          If Plausible's pricing works for you and you want EU data residency, it is a sound choice. We are not trying to argue otherwise.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Where Plausible Falls Short — Especially Early On</h2>
        <p>
          Plausible's main challenge is pricing positioning. The entry plan starts at $9/month (billed annually) or $12/month billed monthly. That covers up to 10,000 monthly pageviews across unlimited sites.
        </p>
        <p>
          For a team doing $100k+ ARR, $9/month is nothing. But that's not who hits this constraint. The people most likely to be comparing Plausible alternatives are:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>Solo developers running side projects that might get 2,000–8,000 pageviews per month</li>
          <li>Content creators or bloggers building an audience who aren't yet monetizing</li>
          <li>Early-stage founders running experiments before product-market fit</li>
          <li>Open-source maintainers who want basic traffic visibility on their project site</li>
        </ul>
        <p>
          For these cases, $9/month adds up. It's $108/year for a tool that's measuring early, uncertain traffic. That's a real barrier when you're not sure the project will survive.
        </p>
        <p>
          The self-hosting option exists but comes with real costs: you need a server (typically $5–20/month on Hetzner or similar), time to set up Plausible's Docker stack, and ongoing maintenance responsibility. For teams that want simple analytics, "just self-host it" is not actually simple.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">What Plausible Does That Beam Does Not (Yet)</h2>
        <p>
          Honesty matters here. Plausible is a more mature product with features Beam doesn't have:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Revenue tracking.</strong> Plausible supports ecommerce revenue attribution. Beam does not have a native revenue dimension.</li>
          <li><strong>Funnels.</strong> Plausible's growth plan includes conversion funnels. Beam has goal/conversion tracking but not visual funnel reports.</li>
          <li><strong>User segments and cohorts.</strong> Plausible's higher plans allow filtering and segmentation by custom properties. Beam's filtering is simpler.</li>
          <li><strong>EU data residency guarantee.</strong> Plausible explicitly operates on EU infrastructure. Beam runs on Cloudflare Workers, which distributes compute globally — that's a trade-off some teams care about.</li>
          <li><strong>Integrations.</strong> Plausible has more documented integrations with third-party platforms. Beam's integration guides cover the most common cases but not everything.</li>
        </ul>
        <p>
          If any of those features are critical to your workflow, Plausible is likely the better choice for you right now.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Why We Built Beam Differently</h2>
        <p>
          When we started thinking about Beam, we weren't trying to clone Plausible. We were trying to answer a different question: what does analytics look like for a project that's still finding its footing?
        </p>
        <p>
          For that stage, we think a few things matter most:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Free tier that's actually useful.</strong> Beam's free plan covers one site and up to 50,000 pageviews per month. That covers most early-stage projects without any payment friction.</li>
          <li><strong>$5/month when you need more.</strong> The Pro plan is $5/month for unlimited sites and up to 500,000 pageviews. It's priced for builders who want a small tool, not a subscription that scales faster than their product does.</li>
          <li><strong>No self-hosting overhead.</strong> Beam runs on Cloudflare's infrastructure. There's nothing to maintain. Add a script tag, see your data.</li>
          <li><strong>Decision-ready output.</strong> We built around a principle that raw pageview counters are a starting point, not the finish line. Insights, anomaly detection, and channel classification are designed to surface the things that actually change what you do next.</li>
        </ul>
        <p>
          We are not arguing Beam is better than Plausible in all dimensions. We're arguing that for a specific audience — early projects, indie developers, small teams watching costs — Beam's trade-offs are a better fit.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Feature Comparison: Beam vs. Plausible</h2>
        <div class="overflow-x-auto mt-4">
          <table class="w-full text-sm border-collapse border border-gray-200">
            <thead>
              <tr class="bg-gray-50">
                <th class="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">Feature</th>
                <th class="border border-gray-200 px-4 py-3 text-center font-semibold text-indigo-700">Beam</th>
                <th class="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700">Plausible</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Free plan</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600 font-semibold">Yes (50K pv/mo)</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No (30-day trial only)</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Starting price</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600 font-semibold">$5/month</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-gray-600">$9/month</td>
              </tr>
              <tr>
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Cookie-free</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Open source</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓ (AGPL-3.0)</td>
              </tr>
              <tr>
                <td class="border border-gray-200 px-4 py-3 text-gray-700">EU data residency</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-gray-500">Global CDN</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓ (Germany/France)</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Custom events</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Goals / conversions</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Revenue tracking</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Funnels</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓ (Growth plan)</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Anomaly alerts</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No</td>
              </tr>
              <tr>
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Weekly digest emails</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 text-gray-700">Self-hosting</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-red-500">No</td>
                <td class="border border-gray-200 px-4 py-3 text-center text-green-600">✓ (community)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">The Pricing Math</h2>
        <p>
          Here's how the cost stacks up over time at different project scales:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Under 50K pageviews/month:</strong> Beam is free. Plausible costs $9/month ($108/year).</li>
          <li><strong>50K–500K pageviews/month:</strong> Beam Pro is $5/month ($60/year). Plausible's 100K plan is $9/month; their 200K plan is $19/month.</li>
          <li><strong>Above 500K pageviews/month:</strong> You'll likely outgrow both tools. At that scale, evaluate Plausible, Fathom, or self-hosted Matomo based on your specific requirements.</li>
        </ul>
        <p>
          The $5/month vs $9/month difference sounds small in isolation. Across a year, it's $108 vs $60 — a 44% difference. That matters when you're running multiple projects or watching early-stage costs closely.
        </p>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Who Should Use Plausible Instead of Beam</h2>
        <p>
          We're not trying to win every customer. If any of the following describe your situation, Plausible is probably the better fit:
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>You need confirmed EU data residency (GDPR with explicit EU processing location)</li>
          <li>You need open-source software you can audit or contribute to</li>
          <li>You need revenue attribution or multi-step funnels</li>
          <li>You want the option to self-host later without a platform migration</li>
          <li>Your site has more than 500K monthly pageviews (you'll hit Beam's Pro limit)</li>
        </ul>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Who Should Consider Beam</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>Early-stage projects that want free analytics without self-hosting overhead</li>
          <li>Indie developers tracking multiple small sites without paying per-site fees</li>
          <li>Founders who want proactive traffic alerts without checking a dashboard constantly</li>
          <li>Teams who want the simplest possible setup: script tag, no configuration, data in 60 seconds</li>
          <li>Anyone who finds $9/month hard to justify for traffic that's still ramping up</li>
        </ul>

        <div class="bg-indigo-50 rounded-xl p-6 mt-10">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Try Beam free — no credit card required</h3>
          <p class="text-gray-600 mb-4">Free plan includes one site, up to 50,000 pageviews/month, and full dashboard access. Upgrade to Pro ($5/month) if you need more.</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors text-center">Get Started Free →</a>
            <a href="/vs/plausible" class="inline-block border border-indigo-600 text-indigo-600 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-50 transition-colors text-center">Full Plausible Comparison</a>
            <a href="/demo" class="inline-block border border-gray-200 text-gray-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors text-center">See Demo</a>
          </div>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mt-10">Further Reading</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li><a href="/vs/plausible" class="text-indigo-600 hover:text-indigo-700">Beam vs. Plausible: detailed feature comparison</a></li>
          <li><a href="/blog/google-analytics-alternatives-2026" class="text-indigo-600 hover:text-indigo-700">Google Analytics alternatives in 2026</a> — broader market overview</li>
          <li><a href="/blog/cookie-free-analytics-guide" class="text-indigo-600 hover:text-indigo-700">Cookie-free analytics guide</a> — how privacy-first analytics works under the hood</li>
          <li><a href="/migrate/plausible" class="text-indigo-600 hover:text-indigo-700">Migrating from Plausible to Beam</a> — step-by-step guide</li>
        </ul>

      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>`
  return c.html(html)
})

// ─── RSS Feed ─────────────────────────────────────────────────────────────────

function toRFC822(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toUTCString()
}

function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

app.get('/blog/rss.xml', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const lastBuildDate = toRFC822(POSTS[0]!.date)
  const items = POSTS.map(p => `
    <item>
      <title>${escXml(p.title)}</title>
      <link>${baseUrl}/blog/${p.slug}</link>
      <description>${escXml(p.excerpt)}</description>
      <pubDate>${toRFC822(p.date)}</pubDate>
      <guid isPermaLink="true">${baseUrl}/blog/${p.slug}</guid>
    </item>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Beam Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Insights on privacy-first web analytics, GDPR compliance, and cookie-free tracking from the Beam team.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

export { app as blog }
