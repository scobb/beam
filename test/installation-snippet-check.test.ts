import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBeamSnippetGuidance,
  scanBeamSnippetInstallation,
} from '../src/lib/stackScanner'

const EXPECTED_SITE_ID = 'site_123'
const EXPECTED_SCRIPT_URL = 'https://beam-privacy.com/js/beam.js'

function mockHtmlFetch(html: string): typeof fetch {
  const mock: typeof fetch = async (input) => {
    const url = String(input)
    if (url === 'https://example.com/') {
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    return new Response('', { status: 404 })
  }
  return mock
}

test('scanBeamSnippetInstallation passes when expected script host and site id are present', async () => {
  const html = '<html><head><script defer src="https://beam-privacy.com/js/beam.js" data-site-id="site_123"></script></head></html>'
  const result = await scanBeamSnippetInstallation('https://example.com', EXPECTED_SITE_ID, EXPECTED_SCRIPT_URL, mockHtmlFetch(html))

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.issues, [])
    assert.equal(result.snippetDetected, true)
    assert.equal(result.scriptHostMatches, true)
    assert.equal(result.siteIdMatches, true)
    assert.deepEqual(result.detectedSiteIds, ['site_123'])

    const guidance = buildBeamSnippetGuidance(result)
    assert.equal(guidance.tone, 'success')
    assert.match(guidance.title, /passed/i)
  }
})

test('scanBeamSnippetInstallation flags missing snippet and points to generic guide', async () => {
  const html = '<html><head><script src="/assets/app.js"></script></head></html>'
  const result = await scanBeamSnippetInstallation('https://example.com', EXPECTED_SITE_ID, EXPECTED_SCRIPT_URL, mockHtmlFetch(html))

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.issues.includes('missing_snippet'))
    assert.equal(result.recommendedGuidePath, '/for')

    const guidance = buildBeamSnippetGuidance(result)
    assert.equal(guidance.tone, 'warning')
    assert.match(guidance.summary, /No Beam snippet was detected/i)
  }
})

test('scanBeamSnippetInstallation flags wrong host and missing data-site-id', async () => {
  const html = '<html><head><script src="https://cdn.example.com/js/beam.js"></script></head></html>'
  const result = await scanBeamSnippetInstallation('https://example.com', EXPECTED_SITE_ID, EXPECTED_SCRIPT_URL, mockHtmlFetch(html))

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.issues.includes('wrong_host'))
    assert.ok(result.issues.includes('missing_site_id'))

    const guidance = buildBeamSnippetGuidance(result)
    assert.ok(guidance.actionItems.some((item) => item.includes('data-site-id')))
  }
})

test('scanBeamSnippetInstallation flags site-id mismatch when id does not match expected value', async () => {
  const html = '<html><head><script src="https://beam-privacy.com/js/beam.js" data-site-id="different_site"></script></head></html>'
  const result = await scanBeamSnippetInstallation('https://example.com', EXPECTED_SITE_ID, EXPECTED_SCRIPT_URL, mockHtmlFetch(html))

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.issues.includes('site_id_mismatch'))
    assert.deepEqual(result.detectedSiteIds, ['different_site'])
  }
})

test('scanBeamSnippetInstallation chooses platform-specific setup guides when markers are present', async () => {
  const html = '<html><head><meta name="generator" content="WordPress"/><script src="/assets/app.js"></script></head><body><img src="/wp-content/uploads/logo.png"/></body></html>'
  const result = await scanBeamSnippetInstallation('https://example.com', EXPECTED_SITE_ID, EXPECTED_SCRIPT_URL, mockHtmlFetch(html))

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.recommendedGuidePath, '/for/wordpress')
    assert.equal(result.recommendedGuideLabel, 'WordPress setup guide')
  }
})
