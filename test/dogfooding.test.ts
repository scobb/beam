import test from 'node:test'
import assert from 'node:assert/strict'
import { landingPage } from '../src/landing'
import { blog } from '../src/routes/blog'

test('landingPage uses the configured self-hosted site id for the tracking script and live stats link', () => {
  const html = landingPage(undefined, undefined, 'site_live_123')

  assert.match(html, /data-site-id="site_live_123"/)
  assert.match(html, /href="\/public\/site_live_123"/)
})

test('landingPage emits parseable JSON-LD with real public URLs', () => {
  const html = landingPage('https://beam-privacy.com')
  const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]

  assert.equal(jsonLdMatches.length, 2)
  assert.doesNotMatch(html, /\$\{publicBaseUrl\}/)
  assert.match(html, /<link rel="canonical" href="https:\/\/beam-privacy\.com\/" \/>/)
  assert.match(html, /<meta property="og:url" content="https:\/\/beam-privacy\.com\/" \/>/)

  const softwareApplication = JSON.parse(jsonLdMatches[0]?.[1] ?? '{}') as Record<string, unknown>
  const organization = JSON.parse(jsonLdMatches[1]?.[1] ?? '{}') as Record<string, unknown>
  assert.equal(softwareApplication['@type'], 'SoftwareApplication')
  assert.equal(softwareApplication.url, 'https://beam-privacy.com/')
  assert.equal(organization['@type'], 'Organization')
  assert.equal(organization.url, 'https://beam-privacy.com/')
})

test('blog add-analytics post includes the Beam dogfooding script with env-provided site id', async () => {
  const response = await blog.request('http://localhost/blog/add-analytics-in-5-minutes', {}, {
    BEAM_SELF_SITE_ID: 'site_blog_456',
  })
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /<script defer src="https:\/\/beam-privacy\.com\/js\/beam\.js" data-site-id="site_blog_456"><\/script>/)
})
