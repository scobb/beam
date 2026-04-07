import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl } from '../lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function wordpressPluginPage(baseUrl: string, selfSiteId?: string): string {
  const BEAM_SITE_ID = selfSiteId ?? BEAM_SITE_ID_FALLBACK

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beam', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'WordPress plugin', item: `${baseUrl}/wordpress-plugin` },
    ],
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beam WordPress Plugin - Official Install Surface</title>
  <meta name="description" content="Install the official Beam WordPress plugin, connect your Site ID, and keep privacy-first analytics live without cookie banners." />
  <meta property="og:title" content="Beam WordPress Plugin" />
  <meta property="og:description" content="Official plugin install flow, packaging checklist, and WordPress.org-ready assets." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/wordpress-plugin" />
  <meta property="og:image" content="${baseUrl}/og-image.svg" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Beam WordPress Plugin" />
  <meta name="twitter:description" content="Official install surface for Beam's WordPress plugin package." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/wordpress-plugin" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">
  <nav class="border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <a href="/" class="text-xl font-bold text-indigo-600">Beam</a>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/for/wordpress" class="font-medium text-indigo-700 hover:text-indigo-800">WordPress guide</a>
        <a href="/for" class="text-gray-600 hover:text-gray-900">All guides</a>
        <a href="/demo" class="text-gray-600 hover:text-gray-900">Live Demo</a>
        <a href="/signup" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Create account</a>
      </div>
    </div>
  </nav>

  <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
    <nav class="text-sm text-gray-400" aria-label="Breadcrumb">
      <a href="/" class="hover:text-gray-600">Beam</a>
      <span class="mx-2">></span>
      <span class="text-gray-600">WordPress plugin</span>
    </nav>
  </div>

  <section class="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
    <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Official distribution surface</p>
    <h1 class="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Beam WordPress Plugin</h1>
    <p class="mt-6 max-w-3xl text-lg text-gray-600">Use the official plugin package to inject Beam's privacy-first tracking script on WordPress sites. Keep install and account setup separate so owners know exactly what each step does.</p>
    <div class="mt-8 flex flex-col sm:flex-row gap-3">
      <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">Create Beam account</a>
      <a href="/for/wordpress" class="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-50">Open install guide</a>
      <a href="/demo" class="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50">View product demo</a>
    </div>
  </section>

  <section class="bg-gray-50 py-14">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Hosted Beam account vs WordPress plugin installer</h2>
      <p class="mt-3 text-gray-600">The plugin and hosted dashboard are intentionally separate products that work together.</p>
      <div class="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Hosted Beam account</p>
          <h3 class="mt-2 text-xl font-bold text-gray-900">Where reporting and site management happen</h3>
          <ul class="mt-4 space-y-2 text-sm text-gray-700">
            <li>Create your account and add a site in Beam dashboard.</li>
            <li>Copy your Beam Site ID from the site detail page.</li>
            <li>Use dashboard analytics, channels, goals, and alerts.</li>
          </ul>
        </div>
        <div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-700">WordPress plugin installer</p>
          <h3 class="mt-2 text-xl font-bold text-gray-900">Only handles script injection on WordPress</h3>
          <ul class="mt-4 space-y-2 text-sm text-gray-700">
            <li>Install and activate the plugin in wp-admin.</li>
            <li>Paste the Beam Site ID into Settings -> Beam Analytics.</li>
            <li>Optionally skip tracking for logged-in administrators.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="py-14">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Build and package the plugin</h2>
      <p class="mt-3 text-gray-600">Use the repeatable packaging script in this repository to generate the install zip.</p>
      <div class="mt-6 rounded-2xl border border-gray-200 bg-gray-900 p-5 overflow-x-auto">
        <pre class="text-green-300 text-sm leading-relaxed"><code>cd beam-wordpress-plugin
./build-plugin-zip.sh
# Output: beam-analytics.zip</code></pre>
      </div>
      <ol class="mt-6 space-y-3 text-sm text-gray-700 list-decimal list-inside">
        <li>Create or sign in to your Beam account and create a site.</li>
        <li>Run <code>./build-plugin-zip.sh</code> to generate <code>beam-analytics.zip</code>.</li>
        <li>In wp-admin, go to <code>Plugins -> Add New -> Upload Plugin</code>, upload the zip, and activate.</li>
        <li>Open <code>Settings -> Beam Analytics</code>, paste your Site ID, save, then verify events in Beam.</li>
      </ol>
    </div>
  </section>

  <section class="pb-14">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Submission-ready assets in-repo</h2>
      <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="rounded-xl border border-gray-200 p-5 bg-white">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">WordPress.org readme</p>
          <p class="mt-2 text-sm text-gray-600"><code>beam-wordpress-plugin/beam-analytics/readme.txt</code> includes tags, requirements, FAQ, changelog, and install instructions.</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-5 bg-white">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Packaging checklist</p>
          <p class="mt-2 text-sm text-gray-600"><code>beam-wordpress-plugin/PACKAGING_CHECKLIST.md</code> is a pre-submit QA checklist for version, docs, zip output, and manual activation test.</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-5 bg-white">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Repeatable zip build</p>
          <p class="mt-2 text-sm text-gray-600"><code>beam-wordpress-plugin/build-plugin-zip.sh</code> produces an install-ready zip from the plugin source tree.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="bg-indigo-50 py-14">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center">
      <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Launch CTA paths</h2>
      <p class="mt-3 text-gray-700">Evaluate the hosted product first, then install the plugin where WordPress operators manage their site.</p>
      <div class="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href="/signup" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-7 py-3 font-semibold text-white hover:bg-indigo-700">Start free hosted account</a>
        <a href="/for/wordpress" class="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-7 py-3 font-semibold text-indigo-700 hover:bg-indigo-100">Plugin install instructions</a>
      </div>
    </div>
  </section>

  <footer class="border-t border-gray-100 py-10">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/for" class="hover:text-gray-600">All guides</a>
        <a href="/for/wordpress" class="hover:text-gray-600">WordPress guide</a>
        <a href="/demo" class="hover:text-gray-600">Live demo</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>
</body>
</html>`
}

app.get('/wordpress-plugin', (c) => {
  return c.html(wordpressPluginPage(getPublicBaseUrl(c.env), c.env.BEAM_SELF_SITE_ID))
})

export { app as wordpressPlugin }
