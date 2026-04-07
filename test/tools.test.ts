import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildScanGuidance,
  createShareableScanPayload,
  detectAnalyticsVendors,
  isPrivateNetworkHost,
  parseShareableScanPayload,
  scanAnalyticsStack,
  scanResultFromShareablePayload,
} from '../src/routes/tools'

test('detectAnalyticsVendors finds required vendors with script and inline evidence', () => {
  const html = `<!doctype html>
  <html>
    <head>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-123"></script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
      <script src="https://cdn.usefathom.com/script.js"></script>
      <script src="https://static.cloudflareinsights.com/beacon.min.js"></script>
      <script src="https://va.vercel-scripts.com/v1/script.js"></script>
      <script src="https://us.i.posthog.com/static/array.js"></script>
      <script src="https://gc.zgo.at/count.js"></script>
      <script src="/js/beam.js" data-site-id="demo"></script>
      <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}</script>
      <script>window.umami = { track: function() {} }</script>
    </head>
  </html>`

  const detections = detectAnalyticsVendors(html, 'https://example.com')
  const names = detections.map((item) => item.vendorName)

  assert.ok(names.includes('Google Analytics'))
  assert.ok(names.includes('Google Tag Manager'))
  assert.ok(names.includes('Fathom'))
  assert.ok(names.includes('Cloudflare Web Analytics'))
  assert.ok(names.includes('Vercel Analytics'))
  assert.ok(names.includes('PostHog'))
  assert.ok(names.includes('GoatCounter'))
  assert.ok(names.includes('Beam'))
  assert.ok(names.includes('Umami'))
})

test('detectAnalyticsVendors returns empty list when no known vendors are found', () => {
  const html = '<html><head><script src="/assets/app.js"></script></head><body>Hello</body></html>'
  const detections = detectAnalyticsVendors(html, 'https://example.com')
  assert.equal(detections.length, 0)
})

test('detectAnalyticsVendors matches expanded vendor markers from inline snippets', () => {
  const html = `<!doctype html><html><head>
    <script>window.__CFBeacon = { token: 'abc' }</script>
    <script>window.va = window.va || function(){}</script>
    <script>posthog.init('ph_test')</script>
    <script>window.goatcounter = window.goatcounter || { count: function() {} }</script>
  </head></html>`
  const detections = detectAnalyticsVendors(html, 'https://example.com')
  const vendorIds = detections.map((item) => item.vendorId)

  assert.ok(vendorIds.includes('cloudflare_web_analytics'))
  assert.ok(vendorIds.includes('vercel_analytics'))
  assert.ok(vendorIds.includes('posthog'))
  assert.ok(vendorIds.includes('goatcounter'))
})

test('buildScanGuidance flags multi-vendor third-party stacks and provides comparison rows', () => {
  const html = `<!doctype html><html><head>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-123"></script>
    <script src="https://plausible.io/js/script.js"></script>
  </head></html>`
  const detections = detectAnalyticsVendors(html, 'https://example.com')
  const guidance = buildScanGuidance(detections)

  assert.match(guidance.summary, /Detected 2 analytics vendors/i)
  assert.match(guidance.recommendation, /third-party|vendor-owned domains/i)
  assert.ok(guidance.duplicateRisk)
  assert.equal(guidance.comparisonRows.length, 3)
  assert.ok(
    guidance.comparisonRows.some((row) =>
      row.beam.includes('goals, traffic channels, anomaly alerts, and plain-English insights')
    )
  )
})

test('buildScanGuidance recommends Beam setup guides when no vendors are detected', () => {
  const guidance = buildScanGuidance([])
  assert.match(guidance.summary, /No major analytics vendor was detected/i)
  assert.equal(guidance.recommendSetupGuide, true)
  assert.match(guidance.recommendation, /Install Beam/i)
  assert.equal(guidance.duplicateRisk, null)
})

test('buildScanGuidance describes mixed Beam plus third-party instrumentation', () => {
  const html = `<!doctype html><html><head>
    <script src="/js/beam.js" data-site-id="demo"></script>
    <script src="https://cdn.usefathom.com/script.js"></script>
  </head></html>`
  const detections = detectAnalyticsVendors(html, 'https://example.com')
  const guidance = buildScanGuidance(detections)

  assert.match(guidance.summary, /Beam was detected alongside 1 other vendor/i)
  assert.match(guidance.recommendation, /consolidate to Beam/i)
  assert.ok(guidance.duplicateRisk)
})

test('createShareableScanPayload keeps only normalized report fields', () => {
  const html = `<!doctype html><html><head>
    <script src="/js/beam.js" data-site-id="demo"></script>
    <script src="https://cdn.usefathom.com/script.js"></script>
  </head></html>`
  const detections = detectAnalyticsVendors(html, 'https://example.com')
  const payload = createShareableScanPayload({
    ok: true,
    inputUrl: 'https://example.com',
    scannedUrl: 'https://example.com/',
    detections,
  })

  assert.equal(payload.v, 1)
  assert.equal(payload.scannedUrl, 'https://example.com/')
  assert.equal(payload.detections.length, 2)
  assert.ok(payload.detections.every((detection) => typeof detection.vendorId === 'string'))
  assert.ok(payload.detections.every((detection) => !('vendorName' in detection)))
})

test('parseShareableScanPayload sanitizes unknown vendors and invalid entries', () => {
  const raw = JSON.stringify({
    v: 1,
    inputUrl: 'https://input.example',
    scannedUrl: 'https://scan.example',
    detections: [
      { vendorId: 'beam', evidence: ['window.beam = {}'] },
      { vendorId: 'not-a-vendor', evidence: ['x'] },
      { vendorId: 'fathom', evidence: ['a', 123, null] },
      { bogus: true },
    ],
  })

  const parsed = parseShareableScanPayload(raw)
  assert.ok(parsed)
  assert.equal(parsed?.detections.length, 2)
  assert.deepEqual(parsed?.detections.map((detection) => detection.vendorId), ['beam', 'fathom'])
})

test('scanResultFromShareablePayload restores vendor labels for permalink rendering', () => {
  const parsed = parseShareableScanPayload(
    JSON.stringify({
      v: 1,
      inputUrl: 'https://input.example',
      scannedUrl: 'https://scan.example',
      detections: [{ vendorId: 'google_analytics', evidence: ['Script: https://www.googletagmanager.com/gtag/js?id=G-1'] }],
    })
  )

  assert.ok(parsed)
  const result = scanResultFromShareablePayload(parsed!)
  assert.equal(result.ok, true)
  assert.equal(result.detections.length, 1)
  assert.equal(result.detections[0]?.vendorName, 'Google Analytics')
})

test('isPrivateNetworkHost blocks localhost and private addresses', () => {
  assert.equal(isPrivateNetworkHost('localhost'), true)
  assert.equal(isPrivateNetworkHost('127.0.0.1'), true)
  assert.equal(isPrivateNetworkHost('192.168.1.15'), true)
  assert.equal(isPrivateNetworkHost('fd00::1234'), true)
  assert.equal(isPrivateNetworkHost('example.com'), false)
})

test('scanAnalyticsStack blocks private-network URL before fetch', async () => {
  let called = 0
  const mockFetch: typeof fetch = async () => {
    called += 1
    return new Response('', { status: 200 })
  }

  const result = await scanAnalyticsStack('http://localhost:8787', mockFetch)
  assert.equal(result.ok, false)
  assert.match(result.error, /Private-network or localhost/)
  assert.equal(called, 0)
})

test('scanAnalyticsStack follows one redirect and scans final URL', async () => {
  const html = '<html><head><script src="https://plausible.io/js/script.js"></script></head></html>'
  const calls: string[] = []

  const mockFetch: typeof fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    if (url === 'https://example.com/') {
      return new Response('', {
        status: 302,
        headers: { location: 'https://www.example.com/' },
      })
    }
    if (url === 'https://www.example.com/') {
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    return new Response('', { status: 404 })
  }

  const result = await scanAnalyticsStack('https://example.com', mockFetch)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.redirectedFrom, 'https://example.com/')
    assert.equal(result.scannedUrl, 'https://www.example.com/')
    assert.ok(result.detections.some((item) => item.vendorName === 'Plausible'))
  }
  assert.deepEqual(calls, ['https://example.com/', 'https://www.example.com/'])
})

test('scanAnalyticsStack rejects redirect chains longer than one hop', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input)
    if (url === 'https://example.com/') {
      return new Response('', {
        status: 302,
        headers: { location: 'https://www.example.com/' },
      })
    }
    if (url === 'https://www.example.com/') {
      return new Response('', {
        status: 301,
        headers: { location: 'https://www2.example.com/' },
      })
    }
    return new Response('', { status: 404 })
  }

  const result = await scanAnalyticsStack('https://example.com', mockFetch)
  assert.equal(result.ok, false)
  assert.match(result.error, /Only one redirect is allowed|redirected more than once/)
})
