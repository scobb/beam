import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { DEFAULT_PUBLIC_BASE_URL, getPublicBaseUrl } from '../lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

interface GuideConfig {
  slug: string
  name: string
  icon: string
  tagline: string
  hubDescription: string
  description: string
  metaDescription: string
  installSteps: { title: string; code: string; lang: string; explanation: string }[]
  verificationChecklist: string[]
  whyPoints: { icon: string; title: string; body: string }[]
  others: { slug: string; name: string }[]
}

const GUIDE_SECTIONS = [
  {
    title: 'Developer frameworks',
    subtitle: 'Implementation guides for teams that control source code and deploy pipelines.',
    slugs: ['nextjs', 'wordpress', 'astro', 'hugo', 'remix'],
  },
  {
    title: 'No-code builders',
    subtitle: 'Setup guides for teams shipping through visual builders without engineering support.',
    slugs: ['webflow', 'shopify', 'ghost', 'framer', 'carrd'],
  },
] as const

const GUIDES: Record<string, GuideConfig> = {
  nextjs: {
    slug: 'nextjs',
    name: 'Next.js',
    icon: '▲',
    tagline: 'Privacy-first analytics for Next.js apps',
    hubDescription: 'App Router and Pages Router setup with one script and no cookie banner work.',
    description: 'Add cookie-free, GDPR-compliant analytics to your Next.js application in under 2 minutes. No consent banners. No performance hit. Works with App Router and Pages Router.',
    metaDescription: 'Add privacy-first analytics to your Next.js app. Cookie-free, GDPR-compliant, <2KB script. Works with Next.js App Router and Pages Router. No consent banner needed.',
    installSteps: [
      {
        title: 'Option A - Script tag in app/layout.tsx (App Router)',
        code: `// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        {children}
        <Script
          src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
          data-site-id="YOUR_SITE_ID"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}`,
        lang: 'tsx',
        explanation: 'Use <code>strategy="afterInteractive"</code> so Beam loads after hydration with minimal performance impact.',
      },
      {
        title: 'Option B - npm package (any Router)',
        code: `# Install the package
npm install @keylightdigital/beam

# In app/layout.tsx or pages/_app.tsx
import { useBeam } from '@keylightdigital/beam/react'

export default function RootLayout({ children }) {
  useBeam('YOUR_SITE_ID')
  return <>{children}</>
}`,
        lang: 'bash',
        explanation: 'The React hook auto-tracks page navigations in both App Router and Pages Router with no custom router events.',
      },
    ],
    verificationChecklist: [
      'Deploy your Next.js build, then load two different routes in a new browser session.',
      'Open Beam dashboard and select Today; confirm both routes appear in Top Pages.',
      'Check Referrers and Devices cards to confirm non-page metrics are also arriving.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No cookies, no consent banner', body: 'Beam never sets cookies or stores personal data. Your Next.js app stays GDPR and CCPA compliant with no legal pop-up work.' },
      { icon: '⚡', title: 'Core Web Vitals safe', body: 'The script is under 2KB and loads asynchronously, keeping LCP and CLS unaffected in normal production conditions.' },
      { icon: '▲', title: 'App Router and Pages Router', body: 'Works with Next.js 13+ App Router, Pages Router, and static exports without server-side refactors.' },
      { icon: '📊', title: 'Readable, decision-ready metrics', body: 'Track top routes, channels, referrers, and devices in one dashboard instead of GA-style report sprawl.' },
    ],
    others: [
      { slug: 'wordpress', name: 'WordPress' },
      { slug: 'astro', name: 'Astro' },
      { slug: 'remix', name: 'Remix' },
    ],
  },

  wordpress: {
    slug: 'wordpress',
    name: 'WordPress',
    icon: 'W',
    tagline: 'Privacy-first analytics for WordPress',
    hubDescription: 'Install the official Beam plugin from wp-admin or use code-based snippets as fallback.',
    description: 'Replace Google Analytics on your WordPress site with a lightweight, cookie-free alternative. Install the official Beam plugin or use manual snippet options in under 2 minutes.',
    metaDescription: 'Privacy-first analytics for WordPress. Cookie-free and GDPR-compliant. Install the official Beam plugin or use a simple script snippet.',
    installSteps: [
      {
        title: 'Option A - Install the official Beam plugin package',
        code: `# In this repo, build an installable plugin zip:
cd beam-wordpress-plugin
./build-plugin-zip.sh

# In WordPress admin:
Plugins -> Add New -> Upload Plugin
# Upload beam-analytics.zip, activate it,
# then open Settings -> Beam Analytics
# and paste your Beam Site ID`,
        lang: 'bash',
        explanation: 'The official plugin is source-controlled in this repo at <code>beam-wordpress-plugin/beam-analytics</code>, uses WordPress settings APIs, and includes an option to skip logged-in administrators. See the public plugin surface at <a href="/wordpress-plugin" class="text-indigo-600 hover:text-indigo-700">/wordpress-plugin</a> for packaging assets and launch copy.',
      },
      {
        title: 'Option B - Add to functions.php (no plugin install)',
        code: `// Add to your theme's functions.php
function beam_analytics_script() {
    echo '<script defer src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js" data-site-id="YOUR_SITE_ID"></script>';
}
add_action( 'wp_head', 'beam_analytics_script' );`,
        lang: 'php',
        explanation: 'The <code>wp_head</code> hook injects Beam into every page, post, category archive, and custom template.',
      },
      {
        title: 'Option C - Use a header/footer snippet plugin',
        code: `<!-- Paste into your plugin's "Header" field -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'Use this for no-code installs inside WordPress admin when you prefer not to touch PHP files.',
      },
    ],
    verificationChecklist: [
      'Publish the snippet, then open your homepage and one post URL in a private browser window.',
      'In Beam dashboard, confirm both URLs show up in Top Pages within a minute.',
      'If data is missing, verify caching/CDN plugins are not stripping custom head snippets.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No cookie banner requirement', body: 'Beam collects no personal data and sets no cookies, so WordPress sites can avoid analytics consent prompts.' },
      { icon: '🚀', title: 'No plugin bloat', body: 'One lightweight script replaces heavy analytics plugins and keeps wp-admin cleaner.' },
      { icon: '🔒', title: 'GDPR and CCPA by default', body: 'No IP storage, no fingerprinting, and no cross-site identifiers means low compliance overhead.' },
      { icon: '📈', title: 'Focus on useful metrics', body: 'See what content drives traffic without navigating complex GA-style dashboards.' },
    ],
    others: [
      { slug: 'nextjs', name: 'Next.js' },
      { slug: 'astro', name: 'Astro' },
      { slug: 'webflow', name: 'Webflow' },
    ],
  },

  astro: {
    slug: 'astro',
    name: 'Astro',
    icon: 'A',
    tagline: 'Privacy-first analytics for Astro sites',
    hubDescription: 'Zero-build-overhead script placement for static, SSR, and hybrid Astro sites.',
    description: 'Beam aligns with Astro\'s lightweight philosophy: one script tag, no cookies, and no build-time dependency. Works with static, SSR, and hybrid rendering.',
    metaDescription: 'Privacy-first analytics for Astro. Cookie-free, GDPR-compliant, and under 2KB. Works for Astro static, SSR, and hybrid rendering.',
    installSteps: [
      {
        title: 'Add Beam to your base layout',
        code: `---
// src/layouts/BaseLayout.astro
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <slot name="head" />
  </head>
  <body>
    <slot />
    <script
      is:inline
      defer
      src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
      data-site-id="YOUR_SITE_ID">
    </script>
  </body>
</html>`,
        lang: 'astro',
        explanation: 'Use <code>is:inline</code> so Astro does not transform the script and it is emitted exactly once per page.',
      },
      {
        title: 'Astro View Transitions setup',
        code: `---
// src/layouts/BaseLayout.astro
import { ViewTransitions } from 'astro:transitions'
---
<html>
  <head>
    <ViewTransitions />
    <script
      is:inline
      defer
      src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
      data-site-id="YOUR_SITE_ID">
    </script>
  </head>
  <body><slot /></body>
</html>`,
        lang: 'astro',
        explanation: 'Beam handles SPA-like transitions so route-level pageview coverage stays accurate without extra client hooks.',
      },
    ],
    verificationChecklist: [
      'Start or deploy your Astro site, then load two different URLs including a transition link if enabled.',
      'Confirm Today range in Beam dashboard shows both paths.',
      'Check Channels/Referrers to verify metadata collection beyond raw pageview count.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No consent UI needed', body: 'Astro sites focused on simplicity can keep privacy messaging clean with no analytics cookie banners.' },
      { icon: '⚡', title: 'Under 2KB, no build overhead', body: 'Beam is a plain script include with minimal runtime footprint and zero bundling cost.' },
      { icon: '🔄', title: 'View Transitions aware', body: 'Beam tracks route changes in Astro navigation flows so your dashboards do not undercount.' },
      { icon: '📊', title: 'Fast answers for content teams', body: 'See what pages, channels, and devices are performing without exporting data to ad platforms.' },
    ],
    others: [
      { slug: 'nextjs', name: 'Next.js' },
      { slug: 'hugo', name: 'Hugo' },
      { slug: 'remix', name: 'Remix' },
    ],
  },

  hugo: {
    slug: 'hugo',
    name: 'Hugo',
    icon: 'H',
    tagline: 'Privacy-first analytics for Hugo static sites',
    hubDescription: 'Theme partial and base layout install for static content sites with zero client bundle overhead.',
    description: 'Beam is a strong fit for Hugo publishers and docs sites: one deferred script, no cookies, and decision-ready analytics without shipping a heavy client-side bundle.',
    metaDescription: 'Beam for Hugo: cookie-free analytics for static sites. Add a partial in layouts and verify traffic in minutes with no client-heavy bundle.',
    installSteps: [
      {
        title: 'Recommended: create a shared partial and include it in baseof.html',
        code: `<!-- layouts/partials/beam-analytics.html -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>

<!-- layouts/_default/baseof.html -->
<!doctype html>
<html lang="{{ site.Language.Lang | default "en" }}">
  <head>
    {{ partial "beam-analytics.html" . }}
  </head>
  <body>
    {{ block "main" . }}{{ end }}
  </body>
</html>`,
        lang: 'html',
        explanation: 'Using a dedicated partial keeps tracking in one file across homepage, section lists, and single pages. Need your ID first? Create a site at <a href="/dashboard/sites/new" class="text-indigo-600 hover:text-indigo-700">/dashboard/sites/new</a>.',
      },
      {
        title: 'Theme fallback: place script directly in head partial',
        code: `<!-- themes/your-theme/layouts/partials/head/custom.html -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'Many Hugo themes expose a custom head partial. This is the lowest-friction install when you do not want to edit base templates.',
      },
    ],
    verificationChecklist: [
      'Run `hugo --gc --minify` or your normal deploy pipeline, then open your production homepage and one content page in a private window.',
      'In Beam dashboard, pick Today and confirm both URLs appear in Top Pages within about a minute.',
      'Check Referrers and Channels panels to validate decision-ready source visibility, not just raw pageview counts.',
    ],
    whyPoints: [
      { icon: '⚡', title: 'Sub-2KB script for static performance', body: 'Beam keeps Hugo pages fast with a tiny deferred script instead of a client-heavy analytics bundle.' },
      { icon: '🍪', title: 'No cookies, no consent-banner overhead', body: 'Beam does not set cookies or store personal identifiers, so privacy compliance stays simple.' },
      { icon: '🧠', title: 'Decision-ready analytics', body: 'Go beyond passive counters with top pages, channels, referrers, goals, and plain-English insights.' },
      { icon: '🧱', title: 'Works with any Hugo theme structure', body: 'Install via shared partials or theme head includes without adding build plugins or JS frameworks.' },
    ],
    others: [
      { slug: 'astro', name: 'Astro' },
      { slug: 'remix', name: 'Remix' },
      { slug: 'nextjs', name: 'Next.js' },
    ],
  },

  remix: {
    slug: 'remix',
    name: 'Remix',
    icon: 'R',
    tagline: 'Privacy-first analytics for Remix apps',
    hubDescription: 'Add Beam in app/root.tsx with client-navigation coverage and no server-side changes.',
    description: 'Add cookie-free analytics to your Remix app with one script include in your root document. Beam keeps routing analytics clean without introducing consent-banner overhead.',
    metaDescription: 'Privacy-first analytics for Remix. Cookie-free and GDPR-compliant with a script include in app/root.tsx. No consent banner required.',
    installSteps: [
      {
        title: 'Add to app/root.tsx',
        code: `// app/root.tsx
import { Links, Meta, Outlet, Scripts } from '@remix-run/react'

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <Scripts />
        <script
          defer
          src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
          data-site-id="YOUR_SITE_ID"
        />
      </body>
    </html>
  )
}`,
        lang: 'tsx',
        explanation: 'Placing Beam after <code>&lt;Scripts /&gt;</code> keeps hydration order clean and avoids render blocking.',
      },
      {
        title: 'Optional explicit route-change tracking',
        code: `import { useEffect } from 'react'
import { useLocation } from '@remix-run/react'

function BeamPageTracker() {
  const location = useLocation()
  useEffect(() => {
    window.beam?.track?.('route_change', { path: location.pathname })
  }, [location.pathname])
  return null
}

// Mount <BeamPageTracker /> in app/root.tsx body`,
        lang: 'tsx',
        explanation: 'Beam auto-captures standard pageviews; this optional hook helps if your app has advanced transition patterns.',
      },
    ],
    verificationChecklist: [
      'Deploy, then open the app and navigate between two Remix routes without full reloads.',
      'Confirm path-level traffic appears in Beam Top Pages.',
      'Use an external referrer click (for example from search/social) to validate source attribution.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No consent banner project', body: 'Beam keeps Remix builds cookie-free and avoids legal UI work tied to traditional analytics tools.' },
      { icon: '⚡', title: 'Light client footprint', body: 'Async script loading keeps server-rendered response performance strong.' },
      { icon: '🧭', title: 'Route-level visibility', body: 'Track which Remix paths and funnels are performing without wiring heavy analytics SDKs.' },
      { icon: '🔒', title: 'Privacy by design', body: 'No personal identifiers or ad-tech integration means lower compliance risk.' },
    ],
    others: [
      { slug: 'nextjs', name: 'Next.js' },
      { slug: 'astro', name: 'Astro' },
      { slug: 'hugo', name: 'Hugo' },
      { slug: 'webflow', name: 'Webflow' },
    ],
  },

  webflow: {
    slug: 'webflow',
    name: 'Webflow',
    icon: 'WF',
    tagline: 'Privacy analytics for Webflow sites without custom engineering',
    hubDescription: 'Project Settings head-code install for CMS, ecommerce, and marketing pages.',
    description: 'Add Beam to Webflow from Project Settings in minutes. Track page performance, channels, and content without cookies, consent banners, or script-heavy tag managers.',
    metaDescription: 'Beam for Webflow: cookie-free privacy analytics with script install in Project Settings. GDPR-compliant, fast, and no consent banner required.',
    installSteps: [
      {
        title: 'Project-wide install in Webflow Custom Code',
        code: `<!-- Webflow: Project Settings -> Custom Code -> Head Code -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'This is the recommended placement for Webflow so Beam loads on every static page, CMS template page, and collection item.',
      },
      {
        title: 'Page-level install for limited rollout',
        code: `<!-- Webflow Designer: Page Settings -> Custom Code -> Inside <head> -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'Use page-level code for staged rollouts, then move to project-level installation once validated.',
      },
    ],
    verificationChecklist: [
      'Publish the Webflow site after adding code; draft/preview mode does not represent production tracking.',
      'Visit your homepage and one CMS page in a private window.',
      'In Beam dashboard, confirm both URLs appear and referrer/country values are populated.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No cookie-banner complexity', body: 'Beam is cookieless and avoids consent-banner prompts that hurt conversion on marketing sites.' },
      { icon: '⚡', title: 'Fast marketing pages stay fast', body: 'Sub-2KB script with defer loading preserves Lighthouse and Core Web Vitals performance goals.' },
      { icon: '🛠', title: 'No-code friendly install', body: 'Everything happens in Webflow settings without touching source code or external tag managers.' },
      { icon: '📈', title: 'Actionable channel visibility', body: 'Understand top pages, referrers, and traffic channels to make content and landing page decisions faster.' },
    ],
    others: [
      { slug: 'shopify', name: 'Shopify' },
      { slug: 'framer', name: 'Framer' },
      { slug: 'carrd', name: 'Carrd' },
      { slug: 'wordpress', name: 'WordPress' },
    ],
  },

  shopify: {
    slug: 'shopify',
    name: 'Shopify',
    icon: '🛍️',
    tagline: 'Privacy-first analytics for Shopify storefronts',
    hubDescription: 'Theme-code install path for product and collection pages with a fast verification checklist.',
    description: 'Add Beam to Shopify storefront pages in minutes with one lightweight script. Get clear traffic, source, and content-performance visibility for product decisions without cookie tracking.',
    metaDescription: 'Beam for Shopify: cookie-free analytics for storefront traffic and content decisions. Install via theme code, verify quickly, and keep privacy-first defaults.',
    installSteps: [
      {
        title: 'Install in theme.liquid (recommended storefront-wide path)',
        code: `{% comment %} Shopify Admin -> Online Store -> Themes -> Edit code -> layout/theme.liquid {% endcomment %}
<head>
  <!-- other tags -->
  <script
    defer
    src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
    data-site-id="YOUR_SITE_ID">
  </script>
</head>`,
        lang: 'liquid',
        explanation: 'Adding the script in <code>theme.liquid</code> ensures Beam loads on homepage, collection, product, and content pages. Need your ID first? Create a site in Beam and copy the snippet from <a href="/dashboard/sites/new" class="text-indigo-600 hover:text-indigo-700">/dashboard/sites/new</a>.',
      },
      {
        title: 'Theme editor fallback (Custom Liquid section)',
        code: `{% comment %} Online Store -> Themes -> Customize -> Add section -> Custom liquid {% endcomment %}
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'liquid',
        explanation: 'Use this when you prefer theme-editor changes over direct file edits. Verify the section is included globally, not on a single template only.',
      },
    ],
    verificationChecklist: [
      'Publish the theme update, then open your homepage, one collection page, and one product page in a private browser window.',
      'In Beam dashboard, check Today and confirm those paths appear in Top Pages within about a minute.',
      'Cross-check Referrers and Channels so you can see where storefront visits are coming from (search, social, direct, or referral).',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No analytics cookie prompts', body: 'Beam is cookie-free and avoids personal identifiers, so Shopify storefront analytics can stay privacy-first by default.' },
      { icon: '⚡', title: 'Lightweight storefront impact', body: 'The deferred sub-2KB script keeps page rendering fast for product and collection pages.' },
      { icon: '📈', title: 'Useful ecommerce traffic clarity', body: 'Track what pages and channels drive visits so you can iterate merchandising and landing pages with less guesswork.' },
      { icon: '🧭', title: 'Honest scope for small teams', body: 'Beam is built for lightweight decision support, not full multi-touch ad attribution or enterprise ROAS modeling.' },
    ],
    others: [
      { slug: 'webflow', name: 'Webflow' },
      { slug: 'wordpress', name: 'WordPress' },
      { slug: 'nextjs', name: 'Next.js' },
    ],
  },

  ghost: {
    slug: 'ghost',
    name: 'Ghost',
    icon: 'Gh',
    tagline: 'Privacy-first analytics for Ghost publishers and newsletters',
    hubDescription: 'Ghost Code Injection setup for posts and newsletter landing pages with quick verification.',
    description: 'Add Beam to Ghost in minutes using built-in Code Injection so your publication can track traffic sources and content performance without cookies or consent-banner work.',
    metaDescription: 'Beam for Ghost: cookie-free analytics for publishers and newsletters. Install via Code Injection, verify quickly, and keep reporting simple.',
    installSteps: [
      {
        title: 'Recommended: Ghost Admin -> Settings -> Code Injection',
        code: `<!-- Ghost Admin -> Settings -> Code Injection -> Site Header -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'Site Header injection applies Beam to your homepage, post pages, tag archives, and newsletter landing pages without editing theme files.',
      },
      {
        title: 'Theme fallback: add to default.hbs',
        code: `{{! content/themes/your-theme/default.hbs }}
<!DOCTYPE html>
<html lang="{{@site.locale}}">
  <head>
    {{ghost_head}}
    <script
      defer
      src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
      data-site-id="YOUR_SITE_ID"></script>
  </head>
  <body>
    {{{body}}}
    {{ghost_foot}}
  </body>
</html>`,
        lang: 'hbs',
        explanation: 'Use this when your team manages Ghost themes in git and wants tracking changes versioned with the theme.',
      },
    ],
    verificationChecklist: [
      'Publish the change, then open your homepage plus one published post in a private browser window.',
      'In Beam dashboard, select Today and confirm both paths appear in Top Pages with source data populated.',
      'Create a simple goal (for example `/newsletter/confirm`) and verify Goal summaries + weekly alerts reflect new conversion traffic.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No cookie prompts for readers', body: 'Ghost publications stay privacy-first by default with no cookie storage or personal identifiers.' },
      { icon: '🧭', title: 'Source clarity for editorial decisions', body: 'See which channels and referrers actually drive readership so you can prioritize stories that convert.' },
      { icon: '🎯', title: 'Goals and alerts for newsletter growth', body: 'Track key conversion paths and use Beam alerts to catch spikes and drops without monitoring dashboards all day.' },
      { icon: '📰', title: 'Honest scope for publishers', body: 'Beam focuses on decision-ready traffic analytics instead of GA-style reporting sprawl and ad-tech complexity.' },
    ],
    others: [
      { slug: 'shopify', name: 'Shopify' },
      { slug: 'webflow', name: 'Webflow' },
      { slug: 'wordpress', name: 'WordPress' },
    ],
  },

  framer: {
    slug: 'framer',
    name: 'Framer',
    icon: 'F',
    tagline: 'Privacy analytics for Framer marketing sites',
    hubDescription: 'Install in Framer Site Settings custom code and verify route-level page tracking.',
    description: 'Beam gives Framer teams clear traffic analytics without cookie prompts. Add one script in Site Settings and see channels, pages, and devices immediately.',
    metaDescription: 'Beam for Framer: privacy-first, cookie-free analytics with a single custom-code snippet in Framer Site Settings.',
    installSteps: [
      {
        title: 'Add Beam to Framer Site Settings',
        code: `<!-- Framer: Site Settings -> Custom Code -> End of <head> -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'Placing Beam in the head applies tracking across your Framer pages and published route changes.',
      },
      {
        title: 'Ensure the script is on your production domain',
        code: `<!-- Confirm this appears in the published source -->
<script defer src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js" data-site-id="YOUR_SITE_ID"></script>`,
        lang: 'html',
        explanation: 'Framer preview URLs can differ from production. Always verify on the live domain tied to your Beam site record.',
      },
    ],
    verificationChecklist: [
      'Publish changes in Framer, then open the live site (not preview) in an incognito tab.',
      'Navigate between at least two routes to verify page-level tracking continuity.',
      'Confirm Beam dashboard shows new hits under Today with the expected domain/path values.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No consent-banner friction', body: 'Beam avoids cookie collection, helping Framer landing pages keep conversion-focused UX.' },
      { icon: '⚡', title: 'Performance-safe snippet', body: 'The script is tiny and deferred, so it does not block Framer page rendering.' },
      { icon: '🧭', title: 'Built for marketing decisions', body: 'See which routes and channels drive outcomes without heavyweight enterprise analytics tooling.' },
      { icon: '🔒', title: 'Privacy-first by default', body: 'No personal identifiers and no ad-network sharing keeps compliance overhead low.' },
    ],
    others: [
      { slug: 'webflow', name: 'Webflow' },
      { slug: 'carrd', name: 'Carrd' },
      { slug: 'astro', name: 'Astro' },
    ],
  },

  carrd: {
    slug: 'carrd',
    name: 'Carrd',
    icon: 'C',
    tagline: 'Cookie-free analytics for Carrd one-page sites',
    hubDescription: 'Simple head-snippet setup for Carrd landing pages and link-in-bio sites.',
    description: 'Install Beam on Carrd in one step and monitor pageviews, sources, and geographies without cookies. Ideal for indie launches, waitlists, and one-page product sites.',
    metaDescription: 'Beam for Carrd: one-script privacy analytics for one-page sites. Cookie-free, GDPR-compliant, and lightweight.',
    installSteps: [
      {
        title: 'Add Beam in Carrd site code settings',
        code: `<!-- Carrd: Publish -> Settings -> Code -> Head -->
<script
  defer
  src="${DEFAULT_PUBLIC_BASE_URL}/js/beam.js"
  data-site-id="YOUR_SITE_ID">
</script>`,
        lang: 'html',
        explanation: 'Carrd Pro plans allow custom code injection. Place Beam in the head so it loads as soon as your page opens.',
      },
      {
        title: 'Use your production custom domain',
        code: `<!-- Match this in Beam dashboard site settings -->
Site domain: yoursite.com
Script URL: ${DEFAULT_PUBLIC_BASE_URL}/js/beam.js
Data-site-id: YOUR_SITE_ID`,
        lang: 'text',
        explanation: 'Set your Beam site domain to the same domain visitors use, especially if you switched from a carrd.co URL.',
      },
    ],
    verificationChecklist: [
      'Republish your Carrd site after adding the code block.',
      'Open the live page in a private tab and refresh once to generate a first hit.',
      'In Beam dashboard, confirm Today shows at least one pageview and one visitor from your test session.',
    ],
    whyPoints: [
      { icon: '🍪', title: 'No cookies on one-page funnels', body: 'Carrd sites can stay conversion-focused without cookie prompts interrupting first impressions.' },
      { icon: '⚡', title: 'Tiny script for fast load', body: 'Beam stays lightweight, which matters most on one-page mobile-first sites.' },
      { icon: '🧪', title: 'Great for launch experiments', body: 'Track channel and pageview shifts across campaign links without touching codebases.' },
      { icon: '📊', title: 'Clear dashboard without noise', body: 'Use top pages, referrers, and channels to decide where to iterate your Carrd copy and offer.' },
    ],
    others: [
      { slug: 'webflow', name: 'Webflow' },
      { slug: 'framer', name: 'Framer' },
      { slug: 'nextjs', name: 'Next.js' },
    ],
  },
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function forHubPage(baseUrl: string, selfSiteId?: string): string {
  const BEAM_SITE_ID = selfSiteId ?? BEAM_SITE_ID_FALLBACK

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beam', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Integration guides', item: `${baseUrl}/for` },
    ],
  }

  const sectionMarkup = GUIDE_SECTIONS.map((section) => {
    const cards = section.slugs
      .map((slug) => GUIDES[slug])
      .map((guide) => {
        if (!guide) return ''
        return `
        <a href="/for/${guide.slug}" class="block rounded-2xl border border-gray-200 bg-white p-6 hover:border-indigo-300 hover:shadow-sm transition-all">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">${escHtml(guide.name)}</p>
          <h3 class="mt-2 text-xl font-bold text-gray-900">Beam for ${escHtml(guide.name)}</h3>
          <p class="mt-3 text-sm text-gray-600 leading-relaxed">${guide.hubDescription}</p>
          <p class="mt-4 text-sm font-semibold text-indigo-700">Read setup guide -></p>
        </a>
      `
      })
      .join('')

    return `
      <section class="mt-12">
        <div class="mb-5">
          <h2 class="text-2xl font-bold text-gray-900">${section.title}</h2>
          <p class="mt-2 text-gray-600">${section.subtitle}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${cards}
        </div>
      </section>
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam Integration Guides - Setup for Frameworks and No-Code Builders</title>
  <meta name="description" content="Step-by-step Beam setup guides for Next.js, WordPress, Astro, Hugo, Remix, Webflow, Shopify, Ghost, Framer, and Carrd. Cookie-free analytics with privacy-first defaults." />
  <meta property="og:title" content="Beam Integration Guides" />
  <meta property="og:description" content="Install Beam on your stack with practical setup and verification instructions." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/for" />
  <meta property="og:image" content="${baseUrl}/og-image.svg" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Beam Integration Guides" />
  <meta name="twitter:description" content="Setup Beam on frameworks and no-code builders in minutes." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/for" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
  <nav class="border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/demo" class="font-medium text-indigo-700 hover:text-indigo-800">Live Demo</a>
        <a href="/migrate" class="text-gray-600 hover:text-gray-900">Migration Hub</a>
        <a href="/blog/add-analytics-in-5-minutes" class="text-gray-600 hover:text-gray-900">5-minute guide</a>
        <a href="/login" class="text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>

  <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
    <nav class="text-sm text-gray-400" aria-label="Breadcrumb">
      <a href="/" class="hover:text-gray-600">Beam</a>
      <span class="mx-2">></span>
      <span class="text-gray-600">Integration guides</span>
    </nav>
  </div>

  <section class="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
    <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Setup hub</p>
    <h1 class="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Beam integration guides for frameworks and no-code tools</h1>
    <p class="mt-6 text-lg text-gray-600 max-w-3xl">Every guide includes script placement examples, verification steps, privacy rationale, and direct links to the Beam demo and signup flow.</p>

    ${sectionMarkup}

    <section class="mt-14 rounded-2xl border border-emerald-100 bg-emerald-50 p-8">
      <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">WordPress distribution</p>
      <h2 class="mt-2 text-2xl font-bold text-gray-900">Need the official WordPress plugin package?</h2>
      <p class="mt-3 text-gray-700">Use the dedicated plugin surface for install positioning, packaging assets, and a clear hosted-account vs plugin-installer workflow.</p>
      <div class="mt-6 flex flex-col sm:flex-row gap-3">
        <a href="/wordpress-plugin" class="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Open WordPress plugin page</a>
        <a href="/for/wordpress" class="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">WordPress install guide</a>
      </div>
    </section>

    <section class="mt-14 rounded-2xl border border-indigo-100 bg-indigo-50 p-8">
      <h2 class="text-2xl font-bold text-gray-900">Need a custom setup path?</h2>
      <p class="mt-3 text-gray-700">Start with the generic install walkthrough and then adapt the script placement to your stack.</p>
      <div class="mt-6 flex flex-col sm:flex-row gap-3">
        <a href="/blog/add-analytics-in-5-minutes" class="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-100">Read 5-minute setup guide</a>
        <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">Create free Beam account</a>
      </div>
    </section>
  </section>

  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/for" class="hover:text-gray-600">All guides</a>
        <a href="/migrate" class="hover:text-gray-600">Migration hub</a>
        <a href="/wordpress-plugin" class="hover:text-gray-600">WordPress plugin</a>
        <a href="/for/hugo" class="hover:text-gray-600">Hugo</a>
        <a href="/for/webflow" class="hover:text-gray-600">Webflow</a>
        <a href="/for/shopify" class="hover:text-gray-600">Shopify</a>
        <a href="/for/ghost" class="hover:text-gray-600">Ghost</a>
        <a href="/for/framer" class="hover:text-gray-600">Framer</a>
        <a href="/for/carrd" class="hover:text-gray-600">Carrd</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>
</body>
</html>`
}

function guidePage(guide: GuideConfig, baseUrl: string, selfSiteId?: string): string {
  const BEAM_SITE_ID = selfSiteId ?? BEAM_SITE_ID_FALLBACK

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beam', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Integration guides', item: `${baseUrl}/for` },
      { '@type': 'ListItem', position: 3, name: `Beam for ${guide.name}`, item: `${baseUrl}/for/${guide.slug}` },
    ],
  }

  const codeBlocks = guide.installSteps.map((step) => `
    <div class="mb-8">
      <h3 class="font-semibold text-gray-800 mb-3">${step.title}</h3>
      <pre class="bg-gray-900 text-green-300 rounded-xl p-5 overflow-x-auto text-sm leading-relaxed whitespace-pre-wrap break-words"><code>${escHtml(step.code.replaceAll(DEFAULT_PUBLIC_BASE_URL, baseUrl))}</code></pre>
      <p class="mt-3 text-sm text-gray-500">${step.explanation}</p>
    </div>`).join('')

  const verificationItems = guide.verificationChecklist.map((step) => `
    <li class="flex items-start gap-3 text-sm text-gray-600">
      <span class="mt-0.5 text-emerald-600 font-bold">✓</span>
      <span>${step}</span>
    </li>
  `).join('')

  const whyCards = guide.whyPoints.map((point) => `
    <div class="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div class="text-3xl mb-4">${point.icon}</div>
      <h3 class="font-semibold text-lg mb-2">${point.title}</h3>
      <p class="text-gray-500 text-sm">${point.body}</p>
    </div>`).join('')

  const otherLinks = guide.others.map((other) => `
    <a href="/for/${other.slug}" class="block bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
      <span class="font-semibold text-gray-800">${other.name}</span>
      <span class="ml-2 text-sm text-gray-400">-></span>
    </a>`).join('')

  const wordpressPluginCallout = guide.slug === 'wordpress'
    ? `
  <section class="py-16 bg-emerald-50">
    <div class="max-w-4xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Official WordPress plugin launch surface</h2>
      <p class="mt-3 text-gray-700">Need submission-ready packaging docs and a quick explanation for non-technical owners? Use the dedicated plugin page.</p>
      <div class="mt-6 flex flex-col sm:flex-row gap-3">
        <a href="/wordpress-plugin" class="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">Open plugin page</a>
        <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">Create Beam account</a>
      </div>
    </div>
  </section>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam for ${guide.name} - ${guide.tagline}</title>
  <meta name="description" content="${guide.metaDescription}" />
  <meta property="og:title" content="Beam for ${guide.name} - ${guide.tagline}" />
  <meta property="og:description" content="${guide.metaDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/for/${guide.slug}" />
  <meta property="og:image" content="${baseUrl}/og-image.svg" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Beam for ${guide.name} - ${guide.tagline}" />
  <meta name="twitter:description" content="${guide.metaDescription}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/for/${guide.slug}" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
  <nav class="border-b border-gray-100">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/for" class="font-medium text-indigo-700 hover:text-indigo-800">All guides</a>
        <a href="/migrate" class="text-gray-600 hover:text-gray-900">Migration Hub</a>
        <a href="/demo" class="text-gray-600 hover:text-gray-900">Live Demo</a>
        <a href="/login" class="text-gray-600 hover:text-gray-900">Log in</a>
        <a href="/signup" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Get Started</a>
      </div>
    </div>
  </nav>

  <div class="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
    <nav class="text-sm text-gray-400" aria-label="Breadcrumb">
      <a href="/" class="hover:text-gray-600">Beam</a>
      <span class="mx-2">></span>
      <a href="/for" class="hover:text-gray-600">Integration guides</a>
      <span class="mx-2">></span>
      <span class="text-gray-600">For ${guide.name}</span>
    </nav>
  </div>

  <section class="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
    <div class="text-5xl mb-4">${guide.icon}</div>
    <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">Beam for ${guide.name}</h1>
    <p class="text-lg sm:text-xl text-gray-500 max-w-3xl mx-auto mb-10">${guide.description}</p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <a href="/signup" class="inline-block bg-indigo-600 text-white text-base sm:text-lg font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-indigo-700 transition-colors">Get started free</a>
      <a href="/demo" class="inline-block bg-white border border-indigo-200 text-indigo-700 text-base sm:text-lg font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-indigo-50 transition-colors">Explore live demo</a>
    </div>
    <p class="mt-4 text-sm text-gray-400">No credit card required and setup in minutes</p>
  </section>

  <section class="bg-gray-50 py-16">
    <div class="max-w-4xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-center mb-2">Install Beam on ${guide.name}</h2>
      <p class="text-center text-gray-500 mb-10">Replace <code class="bg-gray-100 px-1 rounded text-sm">YOUR_SITE_ID</code> with your Beam site ID from the dashboard.</p>
      ${codeBlocks}
    </div>
  </section>

  ${wordpressPluginCallout}

  <section class="py-16">
    <div class="max-w-4xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-center mb-2">Verify your ${guide.name} integration</h2>
      <p class="text-center text-gray-500 mb-8">Use this checklist after publish so you know tracking is actually live in production.</p>
      <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <ul class="space-y-4">
          ${verificationItems}
        </ul>
      </div>
    </div>
  </section>

  <section class="pb-20">
    <div class="max-w-5xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-center mb-12">Why Beam works well for ${guide.name}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        ${whyCards}
      </div>
    </div>
  </section>

  <section class="bg-indigo-50 py-16">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-3">Ready to add Beam to ${guide.name}?</h2>
      <p class="text-gray-600 mb-8">Start free, validate your first pageview, and then scale when traffic grows.</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href="/signup" class="inline-block bg-indigo-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors">Start tracking for free</a>
        <a href="/demo" class="inline-block bg-white border border-indigo-200 text-indigo-700 font-semibold px-8 py-4 rounded-xl hover:bg-indigo-50 transition-colors">See live demo first</a>
      </div>
    </div>
  </section>

  <section class="py-14">
    <div class="max-w-4xl mx-auto px-4 sm:px-6">
      <h2 class="text-xl font-bold text-gray-900 mb-6 text-center">Related setup guides</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${otherLinks}
      </div>
      <div class="text-center mt-6">
        <a href="/for" class="text-sm font-semibold text-indigo-700 hover:text-indigo-800">Browse all integration guides -></a>
      </div>
    </div>
  </section>

  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 justify-center md:justify-end">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/for" class="hover:text-gray-600">All guides</a>
        <a href="/migrate" class="hover:text-gray-600">Migration hub</a>
        <a href="/wordpress-plugin" class="hover:text-gray-600">WordPress plugin</a>
        <a href="/for/nextjs" class="hover:text-gray-600">Next.js</a>
        <a href="/for/wordpress" class="hover:text-gray-600">WordPress</a>
        <a href="/for/astro" class="hover:text-gray-600">Astro</a>
        <a href="/for/hugo" class="hover:text-gray-600">Hugo</a>
        <a href="/for/remix" class="hover:text-gray-600">Remix</a>
        <a href="/for/webflow" class="hover:text-gray-600">Webflow</a>
        <a href="/for/shopify" class="hover:text-gray-600">Shopify</a>
        <a href="/for/ghost" class="hover:text-gray-600">Ghost</a>
        <a href="/for/framer" class="hover:text-gray-600">Framer</a>
        <a href="/for/carrd" class="hover:text-gray-600">Carrd</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>
</body>
</html>`
}

app.get('/for', (c) => {
  return c.html(forHubPage(getPublicBaseUrl(c.env), c.env.BEAM_SELF_SITE_ID))
})

app.get('/for/:framework', (c) => {
  const slug = c.req.param('framework')
  const guide = GUIDES[slug]
  if (!guide) return c.notFound()
  return c.html(guidePage(guide, getPublicBaseUrl(c.env), c.env.BEAM_SELF_SITE_ID))
})

export { app as forPages }
