import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { getPublicBaseUrl, publicHost } from '../lib/publicUrl'

const BEAM_SITE_ID_FALLBACK = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function nav(): string {
  return `
  <nav class="border-b border-gray-100">
    <div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
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
    <div class="max-w-3xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <span>&copy; ${new Date().getFullYear()} Keylight Digital LLC. All rights reserved.</span>
      <div class="flex items-center gap-6">
        <a href="/about" class="hover:text-gray-600">About</a>
        <a href="/privacy" class="hover:text-gray-600">Privacy Policy</a>
        <a href="/terms" class="hover:text-gray-600">Terms</a>
        <a href="/signup" class="hover:text-gray-600">Sign up</a>
        <a href="/login" class="hover:text-gray-600">Log in</a>
      </div>
    </div>
  </footer>`
}

app.get('/privacy', (c) => {
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const baseUrl = getPublicBaseUrl(c.env)
  const baseHost = publicHost(baseUrl)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Beam</title>
  <meta name="description" content="Beam's privacy policy: what data we collect, what we don't collect, and how we keep your visitors' data private." />
  <meta property="og:title" content="Privacy Policy — Beam" />
  <meta property="og:description" content="Beam's privacy policy: what data we collect, what we don't collect, and how we keep your visitors' data private." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/privacy" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/privacy" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">

${nav()}

<main class="max-w-3xl mx-auto px-6 py-16">
  <h1 class="text-4xl font-extrabold mb-3">Privacy Policy</h1>
  <p class="text-gray-500 text-sm mb-12">Effective date: April 1, 2026 &middot; Keylight Digital LLC</p>

  <div class="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">The short version</h2>
      <p>Beam is a privacy-first analytics service. We built it specifically to avoid the privacy problems that come with tools like Google Analytics. Here's what that means in practice:</p>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li>We <strong>do not use cookies</strong> of any kind.</li>
        <li>We <strong>do not collect IP addresses</strong> or store them.</li>
        <li>We <strong>do not fingerprint</strong> your visitors.</li>
        <li>We <strong>do not sell data</strong> to anyone, ever.</li>
        <li>Your site's analytics data belongs to you.</li>
      </ul>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">What Beam collects from your visitors</h2>
      <p>When a visitor loads a page on your site with the Beam snippet installed, the following data is sent to our servers and stored:</p>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li><strong>Page path</strong> — the URL path visited (e.g., <code>/blog/my-post</code>), not the full URL</li>
        <li><strong>Referrer</strong> — where the visitor came from (e.g., <code>google.com</code>), if the browser provides it</li>
        <li><strong>Country</strong> — derived from Cloudflare's edge network header; never from IP geolocation we perform ourselves</li>
        <li><strong>Device type</strong> — screen width bucket (mobile, tablet, desktop)</li>
        <li><strong>Browser family</strong> — derived from the User-Agent header (e.g., Chrome, Firefox)</li>
        <li><strong>Screen width</strong> — the raw pixel width from <code>screen.width</code></li>
        <li><strong>Language</strong> — the browser's preferred language (e.g., <code>en-US</code>)</li>
        <li><strong>Timestamp</strong> — when the pageview occurred (UTC)</li>
      </ul>
      <p class="mt-4">We never store raw IP addresses. Country is extracted by Cloudflare's infrastructure before the request reaches our application code.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">What Beam does NOT collect</h2>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li>IP addresses (we do not log or store them)</li>
        <li>Cookies or any persistent identifiers</li>
        <li>Personal names, email addresses, or any PII from your visitors</li>
        <li>Cross-site tracking data</li>
        <li>Mouse movements, clicks, or session recordings</li>
        <li>Form inputs or on-page behavior beyond the pageview</li>
      </ul>
      <p class="mt-4">Because we use no cookies and store no persistent identifiers, Beam cannot track individual visitors across sessions or across sites. This is a design choice, not a limitation.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">How data is stored</h2>
      <p>Pageview data is stored in <a href="https://developers.cloudflare.com/d1/" class="text-indigo-600 hover:underline">Cloudflare D1</a>, a serverless SQLite database that runs on Cloudflare's global network. Cloudflare encrypts data at rest and in transit.</p>
      <p class="mt-3">All infrastructure is managed by Keylight Digital LLC. We do not use third-party analytics processors for your site data.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Data retention</h2>
      <p>Pageview data is retained for the lifetime of your Beam account unless you ask us to close the account sooner. If you request account closure, we will delete the associated analytics data within 30 days.</p>
      <p class="mt-3">Pro users can export pageview data from the dashboard. If you are on the free plan and need a copy of your data, email us and we will help.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">GDPR, CCPA, and PECR compliance</h2>
      <p>Because Beam does not use cookies, does not collect personal data, and does not build profiles of individual users, using Beam on your website does not require:</p>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li>A cookie consent banner</li>
        <li>A GDPR consent mechanism for analytics</li>
        <li>A PECR opt-out for tracking</li>
      </ul>
      <p class="mt-4">Beam processes aggregate, anonymous pageview data only. Individual visitors are not identifiable from the data we store. We believe this is genuinely privacy-respecting analytics, not just a legal technicality.</p>
      <p class="mt-3">For EU residents using Beam's dashboard (i.e., site owners who have accounts with us): Keylight Digital LLC is the data controller for your account information (email, password hash). You have the right to access, correct, or delete your account data at any time by contacting us.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Account data (for site owners)</h2>
      <p>When you create a Beam account, we collect and store:</p>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li>Your email address (used to log in and send service emails)</li>
        <li>A hashed password (we never store plaintext passwords)</li>
        <li>Your Stripe customer ID (if you subscribe to Pro; Stripe handles payment data)</li>
        <li>Your subscription status and plan</li>
      </ul>
      <p class="mt-4">We use <a href="https://stripe.com" class="text-indigo-600 hover:underline">Stripe</a> to process payments for Pro subscriptions. Neither Stripe nor our email provider receives your visitors' analytics data.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Cookies on ${baseHost}</h2>
      <p>The Beam dashboard itself uses a single HttpOnly session cookie named <code>beam_session</code> to keep you logged in. This cookie is strictly necessary for authentication — no consent banner is required. No third-party cookies are set on our own domain.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Data requests</h2>
      <p>To request a copy of your data, request deletion, or ask any privacy-related questions, contact us at:</p>
      <p class="mt-3"><strong>Email:</strong> <a href="mailto:ralph@keylightdigital.dev" class="text-indigo-600 hover:underline">ralph@keylightdigital.dev</a></p>
      <p class="mt-1"><strong>Company:</strong> Keylight Digital LLC</p>
      <p class="mt-3">We will respond within 30 days.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Changes to this policy</h2>
      <p>If we make material changes to this policy, we will update the effective date at the top of this page and notify account holders by email. Continuing to use Beam after changes are posted constitutes acceptance of the updated policy.</p>
    </section>

  </div>
</main>

${footer()}

</body>
</html>`
  return c.html(html)
})

app.get('/terms', (c) => {
  const BEAM_SITE_ID = c.env.BEAM_SELF_SITE_ID ?? BEAM_SITE_ID_FALLBACK
  const baseUrl = getPublicBaseUrl(c.env)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — Beam</title>
  <meta name="description" content="Beam's terms of service: account terms, payment terms, data ownership, acceptable use, and more." />
  <meta property="og:title" content="Terms of Service — Beam" />
  <meta property="og:description" content="Beam's terms of service: account terms, payment terms, data ownership, acceptable use, and more." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/terms" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/terms" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="${baseUrl}/js/beam.js" data-site-id="${BEAM_SITE_ID}"></script>
</head>
<body class="bg-white text-gray-900 antialiased">

${nav()}

<main class="max-w-3xl mx-auto px-6 py-16">
  <h1 class="text-4xl font-extrabold mb-3">Terms of Service</h1>
  <p class="text-gray-500 text-sm mb-12">Effective date: April 1, 2026 &middot; Keylight Digital LLC</p>

  <div class="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">1. Service description</h2>
      <p>Beam is a privacy-first web analytics service operated by Keylight Digital LLC ("we", "us", "our"). Beam allows website owners ("you", "the site owner") to collect aggregate, anonymous pageview data from their websites using a lightweight JavaScript snippet.</p>
      <p class="mt-3">By creating an account or using Beam, you agree to these Terms of Service.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">2. Account terms</h2>
      <ul class="space-y-3 list-disc list-inside">
        <li>You must be at least 18 years old to create an account.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>You must provide a valid email address. We may use it to send service-critical notifications.</li>
        <li>One person or legal entity may not maintain more than one free account.</li>
        <li>You may not share your account credentials with others.</li>
      </ul>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">3. Acceptable use</h2>
      <p>You agree not to use Beam to:</p>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li>Collect analytics on websites you do not own or have authorization to instrument</li>
        <li>Attempt to identify individual visitors using any combination of data fields Beam provides</li>
        <li>Abuse, overload, or attempt to attack Beam's infrastructure</li>
        <li>Resell or sublicense Beam as a white-label service without written permission</li>
        <li>Violate any applicable laws or regulations</li>
      </ul>
      <p class="mt-4">We reserve the right to terminate accounts that violate these terms without refund.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">4. Payment terms</h2>
      <p><strong>Free plan:</strong> No payment required. Limited to 1 site and 50,000 pageviews per month. Free plan features may change with reasonable notice.</p>
      <p class="mt-3"><strong>Pro plan ($5/month):</strong> Billed monthly via Stripe. Includes unlimited sites and up to 500,000 pageviews per month.</p>
      <ul class="mt-4 space-y-2 list-disc list-inside">
        <li>Payments are processed by Stripe. Keylight Digital LLC never stores your card details.</li>
        <li>Subscriptions renew automatically each month until cancelled.</li>
        <li>You may cancel at any time from your dashboard. Access continues until the end of the billing period.</li>
        <li>Refunds are handled on a case-by-case basis. Contact us within 30 days of a charge if you believe there was an error.</li>
        <li>We reserve the right to change pricing with 30 days' notice to existing subscribers.</li>
      </ul>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">5. Data ownership</h2>
      <p>You own your analytics data. Keylight Digital LLC does not claim ownership of the pageview data collected from your websites.</p>
      <p class="mt-3">We will not sell, share, or use your site's analytics data for our own commercial purposes. Aggregate, anonymized, cross-account statistics (e.g., "Beam processes X pageviews per day") may be used for marketing purposes but will never identify your site or your visitors.</p>
      <p class="mt-3">When you delete your account, your analytics data is permanently deleted within 30 days.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">6. Service availability</h2>
      <p>Beam runs on Cloudflare's global infrastructure, which provides high availability. However, we provide Beam on a best-effort basis and do not guarantee any specific uptime SLA for free plan accounts.</p>
      <p class="mt-3">We will make reasonable efforts to maintain service continuity and provide advance notice of planned maintenance. Unplanned outages may occur.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">7. Termination</h2>
      <p>You may terminate your account at any time by contacting us and requesting account closure.</p>
      <p class="mt-3">We may suspend or terminate your account if you violate these terms, if we are required to do so by law, or if the service is discontinued. In the case of service discontinuation, we will provide at least 30 days' notice and a data export mechanism.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">8. Limitation of liability</h2>
      <p>Beam is provided "as is" without warranties of any kind, either express or implied. To the fullest extent permitted by applicable law, Keylight Digital LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use Beam.</p>
      <p class="mt-3">Our total liability to you for any claim arising from these terms or your use of Beam shall not exceed the amount you paid us in the 12 months prior to the claim.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">9. Governing law</h2>
      <p>These Terms are governed by the laws of the United States. Any disputes shall be resolved in the courts of competent jurisdiction in the United States.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">10. Changes to these terms</h2>
      <p>We may update these terms from time to time. Material changes will be communicated via email to account holders with at least 14 days' notice. Continued use of Beam after changes take effect constitutes acceptance.</p>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">11. Contact</h2>
      <p>Questions about these terms? Contact us:</p>
      <p class="mt-3"><strong>Email:</strong> <a href="mailto:ralph@keylightdigital.dev" class="text-indigo-600 hover:underline">ralph@keylightdigital.dev</a></p>
      <p class="mt-1"><strong>Company:</strong> Keylight Digital LLC</p>
    </section>

  </div>
</main>

${footer()}

</body>
</html>`
  return c.html(html)
})

export { app as legal }
