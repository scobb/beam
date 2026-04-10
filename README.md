# Beam — Privacy-First Web Analytics

[![CI](https://github.com/scobb/beam/actions/workflows/ci.yml/badge.svg)](https://github.com/scobb/beam/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-informational)](CHANGELOG.md)
[![Live](https://img.shields.io/badge/live-beam.keylightdigital.com-blue)](https://beam.keylightdigital.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Beam is a lightweight, cookie-free, GDPR-compliant web analytics service built on Cloudflare's edge network. Add a tiny JS snippet to collect pageviews — no cookies, no PII, no GDPR headaches.

**$5/month** — cheaper than Plausible ($9/mo) and Fathom ($15/mo).

## Features

- **Cookie-free tracking** — no consent banners required
- **GDPR / CCPA compliant** — no personal data collected
- **Edge-native** — runs on Cloudflare Workers, fast everywhere
- **Tiny script** — < 2KB gzipped, no dependencies
- **Real-time dashboard** — pageviews, referrers, countries, devices
- **Custom domains** — track as many sites as you want
- **Email reports** — weekly digests sent automatically
- **Stripe billing** — $5/month, cancel anytime
- **API access** — query your analytics programmatically

## Live Site

[https://beam.keylightdigital.com](https://beam.keylightdigital.com)

## Quickstart

### 1. Sign up

Create an account at [beam.keylightdigital.com/register](https://beam.keylightdigital.com/register).

### 2. Add your site

After signing in, click **Add Site** and enter your domain.

### 3. Add the tracking snippet

Add this snippet before `</body>` on every page you want to track:

```html
<script
  async
  src="https://beam.keylightdigital.com/beam.js"
  data-site-id="YOUR_SITE_ID"
></script>
```

Replace `YOUR_SITE_ID` with the ID shown in your dashboard.

### 4. View your analytics

Visit your dashboard at [beam.keylightdigital.com/dashboard](https://beam.keylightdigital.com/dashboard).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Cache / Sessions | Cloudflare KV |
| Payments | Stripe |
| Email | Resend API |
| Language | TypeScript |

## Self-Hosting

Beam is built on Cloudflare's free-tier-friendly stack. You can self-host it on your own Cloudflare account:

```bash
# Clone the repo
git clone https://github.com/scobb/beam.git
cd beam

# Install dependencies
npm install

# Configure your environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# Run migrations
npm run migrations:local

# Start dev server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

### Environment Variables

Create a `.dev.vars` file (for local dev) or set Worker secrets (for production):

```
STRIPE_SECRET_KEY=sk_...
RESEND_API_KEY=re_...
SESSION_SECRET=<random 32+ char string>
SENTRY_DSN=https://...@sentry.io/...   # optional
```

## API

### Track a pageview

```
POST /track
Content-Type: application/json

{
  "siteId": "your-site-id",
  "path": "/blog/post-1",
  "referrer": "https://twitter.com",
  "screenWidth": 1440
}
```

### Get analytics (authenticated)

```
GET /api/stats?siteId=your-site-id&period=7d
Authorization: Bearer <session-token>
```

## Pricing

| Plan | Price | Features |
|------|-------|---------|
| Free | $0 | 1 site, 10K pageviews/mo |
| Pro | $5/mo | Unlimited sites, unlimited pageviews, email reports, API access |

## License

MIT — see [LICENSE](LICENSE)

## Examples

Working integration examples for popular frameworks are available at **[scobb/beam-examples](https://github.com/scobb/beam-examples)**:

| Framework | Example |
|-----------|---------|
| [Next.js](https://github.com/scobb/beam-examples/tree/main/examples/nextjs) | App Router + Pages Router with `next/script` |
| [Astro](https://github.com/scobb/beam-examples/tree/main/examples/astro) | Layout head integration |
| [SvelteKit](https://github.com/scobb/beam-examples/tree/main/examples/sveltekit) | `app.html` integration |

Each example includes "Run in 2 minutes" instructions.

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) if one exists, otherwise open an issue first for larger changes.

---

Built by [Keylight Digital LLC](https://keylightdigital.com)
