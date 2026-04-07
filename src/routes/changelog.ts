import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl } from '../lib/publicUrl'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function nav(): string {
  return `
  <nav class="border-b border-gray-100">
    <div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex items-center gap-4">
        <a href="/changelog" class="text-sm text-gray-600 hover:text-gray-900">Changelog</a>
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
        <a href="/blog" class="hover:text-gray-600">Blog</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>`
}

interface ChangelogEntry {
  title: string
  description: string
  tag?: string
}

interface ChangelogGroup {
  date: string
  entries: ChangelogEntry[]
}

const CHANGELOG: ChangelogGroup[] = [
  {
    date: 'April 3, 2026',
    entries: [
      {
        title: 'Custom event tracking',
        description: 'Track specific user actions — button clicks, form submissions, purchases, signups — with a single <code>beam(\'event\', \'name\', props)</code> call. View event counts, trends, and property breakdowns right in your dashboard.',
        tag: 'New',
      },
      {
        title: 'Open-source tracking script',
        description: 'The beam.js tracking library is now open-source on GitHub. Audit the code yourself, self-host it, or contribute improvements. Under 2KB minified and gzipped.',
        tag: 'New',
      },
      {
        title: 'UTM campaign parameter tracking',
        description: 'Automatically capture UTM source, medium, campaign, term, and content parameters. See which marketing campaigns, newsletters, and social posts are actually driving traffic.',
        tag: 'New',
      },
      {
        title: 'Google Analytics alternatives guide (2026)',
        description: 'Published a comprehensive comparison of every major analytics tool — Plausible, Fathom, Simple Analytics, Umami, Matomo, PostHog, and more. Honest pricing, pros, cons, and a full feature table.',
        tag: 'Blog',
      },
      {
        title: 'Privacy analytics guide for Next.js',
        description: 'New in-depth tutorial covering App Router and Pages Router integration, CSP headers, and dynamic route tracking — including support for Vercel and self-hosted deployments.',
        tag: 'Blog',
      },
    ],
  },
  {
    date: 'April 2, 2026',
    entries: [
      {
        title: 'Embeddable visitor count badge',
        description: 'Add a live "powered by Beam" badge to your README, portfolio, or site footer. The SVG badge updates in real time and is served from the edge with proper CORS and cache headers.',
        tag: 'New',
      },
      {
        title: 'Real-time active visitor counter',
        description: 'See exactly how many visitors are on your site right now. The dashboard header shows a live count updated every 30 seconds — useful for launch days, campaigns, and monitoring traffic spikes.',
        tag: 'New',
      },
      {
        title: 'RSS feed for blog and changelog',
        description: 'Subscribe to Beam updates via RSS. Your feed reader will notify you whenever we ship new features or publish new blog posts.',
        tag: 'New',
      },
      {
        title: 'Analytics timezone messaging',
        description: 'The dashboard now clearly shows that all data is stored and displayed in UTC, with a helpful note explaining how to interpret daily breakdowns across timezones.',
        tag: 'Improvement',
      },
      {
        title: 'Dashboard onboarding checklist',
        description: 'New users now see a step-by-step checklist after signup: install the tracking script, verify data is arriving, and explore the dashboard. Dismisses automatically once you\'ve seen real pageviews.',
        tag: 'Improvement',
      },
      {
        title: 'Admin notification on new signups',
        description: 'The Beam team now receives an email notification for every new user signup, including their email and plan — making it easy to reach out and offer help.',
        tag: 'Improvement',
      },
      {
        title: 'SEO comparison pages',
        description: 'Launched detailed feature-by-feature comparison pages: Beam vs Google Analytics, Beam vs Plausible, Beam vs Fathom, Beam vs Umami, Beam vs Matomo, and Beam vs Simple Analytics.',
        tag: 'New',
      },
      {
        title: 'Directory and launch submission kit',
        description: 'Prepared and submitted Beam to 20+ product directories, SaaS listing sites, and communities to drive early user growth.',
        tag: 'Launch',
      },
    ],
  },
  {
    date: 'April 1, 2026',
    entries: [
      {
        title: 'CSV data export for Pro users',
        description: 'Export your full pageview dataset as a CSV file. Open it in Excel, Google Sheets, or any data tool — useful for custom reporting, sharing with clients, or migrating data.',
        tag: 'New',
      },
      {
        title: 'Public shareable dashboards',
        description: 'Share a read-only view of your site\'s analytics with anyone — no login required. Great for transparency with clients, stakeholders, or the open-source community.',
        tag: 'New',
      },
      {
        title: 'Privacy policy and terms of service',
        description: 'Clear, plain-language legal documents covering how Beam handles data, what Pro subscribers agree to, and our cookie-free data practices.',
        tag: 'New',
      },
      {
        title: 'Password reset via email',
        description: 'Forgot your password? Request a reset link from the login page and we\'ll email you a secure, time-limited link to set a new one.',
        tag: 'New',
      },
      {
        title: 'Welcome email with setup guide',
        description: 'New signups receive an automatic welcome email with your tracking script snippet, quickstart instructions, and links to documentation — so you can start collecting data in minutes.',
        tag: 'New',
      },
      {
        title: 'Stripe subscription billing',
        description: 'Launched the Pro plan at $5/month: unlimited sites, 100K pageviews/month, CSV export, and priority support. Upgrade and downgrade anytime.',
        tag: 'New',
      },
      {
        title: 'Dashboard analytics breakdowns',
        description: 'The analytics dashboard now shows top pages, referrer sources, countries, browsers, and operating systems — giving you a full picture of who visits your site and from where.',
        tag: 'New',
      },
      {
        title: 'Beam launched',
        description: 'Privacy-first, cookie-free web analytics — built on Cloudflare\'s global edge network. No cookies, no consent banners, no personal data collection. Just clean, fast analytics for everyone.',
        tag: 'Launch',
      },
    ],
  },
]

function tagBadge(tag?: string): string {
  if (!tag) return ''
  const colors: Record<string, string> = {
    New: 'bg-indigo-100 text-indigo-700',
    Improvement: 'bg-green-100 text-green-700',
    Blog: 'bg-amber-100 text-amber-700',
    Launch: 'bg-purple-100 text-purple-700',
    Fix: 'bg-red-100 text-red-700',
  }
  const cls = colors[tag] ?? 'bg-gray-100 text-gray-600'
  return `<span class="inline-block text-xs font-semibold px-2 py-0.5 rounded ${cls} mr-2">${tag}</span>`
}

app.get('/changelog', (c) => {
  const baseUrl = getPublicBaseUrl(c.env)
  const groups = CHANGELOG.map(group => {
    const entries = group.entries.map(entry => `
      <div class="flex gap-4 py-5 border-b border-gray-100 last:border-0">
        <div class="flex-1">
          <p class="font-semibold text-gray-900 mb-1">${tagBadge(entry.tag)}${entry.title}</p>
          <p class="text-gray-500 text-sm leading-relaxed">${entry.description}</p>
        </div>
      </div>`).join('')

    return `
    <section class="mb-12">
      <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
        <span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
        ${group.date}
      </h2>
      <div class="border border-gray-200 rounded-xl divide-y divide-gray-100 px-6">
        ${entries}
      </div>
    </section>`
  }).join('')

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Changelog — Beam</title>
  <meta name="description" content="See what's new in Beam — the latest features, improvements, and updates to the privacy-first web analytics platform." />
  <meta property="og:title" content="Changelog — Beam" />
  <meta property="og:description" content="See what's new in Beam — the latest features, improvements, and updates." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/changelog" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/changelog" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-gray-900 font-sans">
  ${nav()}
  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="mb-12">
      <h1 class="text-4xl font-extrabold tracking-tight mb-3">Changelog</h1>
      <p class="text-gray-500 text-lg">Every update, feature, and improvement to Beam — in one place.</p>
    </div>
    ${groups}
  </main>
  ${footer()}
</body>
</html>`)
})

export { app as changelog }
