import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

/** Map of URL slugs to page titles for OG image generation. */
const PAGE_TITLES: Record<string, string> = {
  landing: 'Privacy-First Web Analytics',
  demo: 'Live Demo — See Beam in Action',
  alternatives: 'Beam Alternatives Hub',
  'vs-google-analytics': 'Beam vs Google Analytics',
  'vs-cloudflare-web-analytics': 'Beam vs Cloudflare Web Analytics',
  'vs-vercel-analytics': 'Beam vs Vercel Analytics',
  'vs-plausible': 'Beam vs Plausible Analytics',
  'vs-fathom': 'Beam vs Fathom Analytics',
  'vs-umami': 'Beam vs Umami Analytics',
  'vs-matomo': 'Beam vs Matomo',
  'vs-simple-analytics': 'Beam vs Simple Analytics',
  'vs-rybbit': 'Beam vs Rybbit',
  migrate: 'Migration Hub',
  'migrate-google-analytics': 'Google Analytics → Beam',
  'migrate-plausible': 'Plausible → Beam',
  'migrate-fathom': 'Fathom → Beam',
  'migrate-beam-analytics': 'beamanalytics.io → Beam',
  'migrate-import-history': 'Import Historical Traffic',
  scanner: 'Analytics Stack Scanner',
  'how-it-works': 'How Beam Works',
  'product-hunt': 'Beam for Product Hunt',
  'show-hn': 'Beam for Show HN',
}

const TAGLINE = 'beam-privacy.com'

/**
 * Wrap text into lines that fit within maxChars per line.
 * Returns an array of lines.
 */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length === 0) {
      current = word
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function generateOgSvg(pageSlug: string): string {
  const title = PAGE_TITLES[pageSlug] ?? 'Privacy-First Web Analytics'
  const lines = wrapText(title, 28)

  // Layout constants
  const W = 1200
  const H = 630
  const TITLE_FONT_SIZE = lines.length > 1 ? 56 : 64
  const LINE_HEIGHT = TITLE_FONT_SIZE * 1.25
  const TITLE_START_Y = H / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2

  const titleLines = lines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${TITLE_START_Y + i * LINE_HEIGHT}" ` +
        `font-family="system-ui,sans-serif" font-size="${TITLE_FONT_SIZE}" font-weight="700" ` +
        `fill="white" text-anchor="middle">${escSvg(line)}</text>`
    )
    .join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3730a3"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- Decorative circles -->
  <circle cx="100" cy="100" r="180" fill="#4f46e5" opacity="0.3"/>
  <circle cx="${W - 100}" cy="${H - 80}" r="220" fill="#7c3aed" opacity="0.25"/>
  <!-- Brand name -->
  <text x="${W / 2}" y="120" font-family="system-ui,sans-serif" font-size="48" font-weight="800" fill="#c7d2fe" text-anchor="middle" letter-spacing="2">BEAM</text>
  <!-- Page title -->
  ${titleLines}
  <!-- Tagline -->
  <text x="${W / 2}" y="${H - 60}" font-family="system-ui,sans-serif" font-size="26" fill="#a5b4fc" text-anchor="middle">${escSvg(TAGLINE)}</text>
</svg>`
}

function escSvg(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

app.get('/og/:page', (c) => {
  const page = c.req.param('page')
  const svg = generateOgSvg(page)
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  })
})

export { app as og }
