import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'

const HISTORICAL_PATH_ALLOWLIST = new Set<string>(['/changelog'])

const STALE_BEAM_PRICING_PATTERNS: RegExp[] = [
  /Free \(up to 5K pv\/mo\)/i,
  /\$5\/mo \(100K pv\/mo\)/i,
  /Yes — 1 site, 5K pv\/mo/i,
  /Free \(1 site, 5K pv\/mo\)/i,
  /\$5\/mo for 100K pv/i,
  /1 site, 5K pageviews\/month/i,
  /\$5\/month for unlimited sites and up to 100K pageviews/i,
]

function extractSitemapPaths(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)]
  const paths = matches
    .map((match) => match[1] || '/')
    .filter((path): path is string => Boolean(path))

  return [...new Set(paths)]
}

test('sitemap-backed public pages do not leak stale Beam 5K/100K pricing copy', async () => {
  const env = { PUBLIC_BASE_URL: 'https://beam-privacy.com' }
  const sitemapResponse = await app.request('http://localhost/sitemap.xml', {}, env)
  assert.equal(sitemapResponse.status, 200)

  const sitemapXml = await sitemapResponse.text()
  const paths = extractSitemapPaths(sitemapXml)
  assert.ok(paths.length > 0)

  for (const path of paths) {
    const response = await app.request(`http://localhost${path}`, {}, env)
    assert.equal(response.status, 200, `Expected HTTP 200 for ${path}`)

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) continue
    if (HISTORICAL_PATH_ALLOWLIST.has(path)) continue

    const html = await response.text()

    for (const pattern of STALE_BEAM_PRICING_PATTERNS) {
      assert.doesNotMatch(
        html,
        pattern,
        `Found stale Beam pricing copy on ${path}: ${pattern.source}`
      )
    }
  }
})
