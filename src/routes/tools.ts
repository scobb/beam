import { Hono } from 'hono'
import type { Env } from '../types'
import { escHtml } from './dashboard'
import { getPublicBaseUrl, publicUrl } from '../lib/publicUrl'
import {
  MAX_EVIDENCE_PER_VENDOR,
  VENDOR_LABELS,
  buildScanGuidance,
  scanAnalyticsStack,
  type ScanResult,
  type ScanSuccess,
  type VendorId,
} from '../lib/stackScanner'

export { buildScanGuidance, detectAnalyticsVendors, isPrivateNetworkHost, scanAnalyticsStack } from '../lib/stackScanner'

const tools = new Hono<{ Bindings: Env }>()

const REPORT_TTL_SECONDS = 7 * 24 * 60 * 60
const REPORT_KEY_PREFIX = 'scanner-report:'

type ShareableVendorDetection = {
  vendorId: VendorId
  evidence: string[]
}

type ShareableScanPayload = {
  v: 1
  inputUrl: string
  scannedUrl: string
  redirectedFrom?: string
  detections: ShareableVendorDetection[]
}

function normalizeEvidence(prefix: string, value: string): string {
  const clipped = value.length > 180 ? `${value.slice(0, 177)}...` : value
  return `${prefix}: ${clipped}`
}

function sanitizeDetectionList(detections: unknown): ShareableVendorDetection[] {
  if (!Array.isArray(detections)) return []
  return detections
    .map((entry): ShareableVendorDetection | null => {
      if (!entry || typeof entry !== 'object') return null
      const vendorIdRaw = (entry as { vendorId?: unknown }).vendorId
      if (typeof vendorIdRaw !== 'string' || !(vendorIdRaw in VENDOR_LABELS)) return null

      const evidenceRaw = (entry as { evidence?: unknown }).evidence
      const evidence = Array.isArray(evidenceRaw)
        ? evidenceRaw
            .filter((item): item is string => typeof item === 'string')
            .map((item) => normalizeEvidence('Evidence', item))
            .map((item) => item.replace(/^Evidence:\s*/, ''))
            .slice(0, MAX_EVIDENCE_PER_VENDOR)
        : []

      return {
        vendorId: vendorIdRaw as VendorId,
        evidence,
      }
    })
    .filter((entry): entry is ShareableVendorDetection => entry !== null)
}

function sanitizeUrlField(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 2048) return null
  return trimmed
}

export function createShareableScanPayload(result: ScanSuccess): ShareableScanPayload {
  return {
    v: 1,
    inputUrl: result.inputUrl,
    scannedUrl: result.scannedUrl,
    redirectedFrom: result.redirectedFrom,
    detections: result.detections.map((detection) => ({
      vendorId: detection.vendorId,
      evidence: detection.evidence.slice(0, MAX_EVIDENCE_PER_VENDOR).map((item) => normalizeEvidence('Evidence', item).replace(/^Evidence:\s*/, '')),
    })),
  }
}

export function parseShareableScanPayload(raw: string): ShareableScanPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const version = (parsed as { v?: unknown }).v
  if (version !== 1) return null

  const inputUrl = sanitizeUrlField((parsed as { inputUrl?: unknown }).inputUrl)
  const scannedUrl = sanitizeUrlField((parsed as { scannedUrl?: unknown }).scannedUrl)
  if (!inputUrl || !scannedUrl) return null

  const redirectedFromRaw = (parsed as { redirectedFrom?: unknown }).redirectedFrom
  let redirectedFrom: string | undefined
  if (redirectedFromRaw !== undefined) {
    const sanitized = sanitizeUrlField(redirectedFromRaw)
    if (!sanitized) return null
    redirectedFrom = sanitized
  }

  const detections = sanitizeDetectionList((parsed as { detections?: unknown }).detections)

  return {
    v: 1,
    inputUrl,
    scannedUrl,
    redirectedFrom,
    detections,
  }
}

export function scanResultFromShareablePayload(payload: ShareableScanPayload): ScanSuccess {
  return {
    ok: true,
    inputUrl: payload.inputUrl,
    scannedUrl: payload.scannedUrl,
    redirectedFrom: payload.redirectedFrom,
    detections: payload.detections.map((detection) => ({
      vendorId: detection.vendorId,
      vendorName: VENDOR_LABELS[detection.vendorId],
      evidence: detection.evidence,
    })),
  }
}

type RenderResultOptions = {
  sharePayload?: ShareableScanPayload
  permalinkUrl?: string
}

function getReportKey(reportId: string): string {
  return `${REPORT_KEY_PREFIX}${reportId}`
}

function toReportId(raw: string): string | null {
  if (!/^[a-f0-9]{32}$/i.test(raw)) return null
  return raw.toLowerCase()
}

function getReportMeta(result: ScanSuccess): { title: string; description: string } {
  let hostname = 'Scanned site'
  try {
    hostname = new URL(result.scannedUrl).hostname
  } catch {
    // Keep generic fallback when URL parsing fails.
  }
  const guidance = buildScanGuidance(result.detections)
  return {
    title: `${hostname} Analytics Stack Report — Beam`,
    description: guidance.summary,
  }
}

function renderResult(result: ScanResult, options: RenderResultOptions = {}): string {
  if (!result.ok) {
    return `<section class="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5">
      <h2 class="text-lg font-semibold text-rose-900">Scan failed</h2>
      <p class="mt-2 text-sm text-rose-800">${escHtml(result.error)}</p>
    </section>`
  }

  const redirectBlock = result.redirectedFrom
    ? `<p class="mt-1 text-sm text-gray-500">Redirected once: <code class="rounded bg-gray-100 px-1 py-0.5">${escHtml(result.redirectedFrom)}</code></p>`
    : ''

  const guidance = buildScanGuidance(result.detections)
  const recommendationSuffix = guidance.recommendSetupGuide
    ? ` <a href="/for" class="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900">Open setup guides</a>.`
    : ''
  const duplicateRiskBlock = guidance.duplicateRisk
    ? `<p class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><span class="font-semibold">Duplicate instrumentation risk:</span> ${escHtml(guidance.duplicateRisk)}</p>`
    : ''
  const comparisonRows = guidance.comparisonRows
    .map(
      (row) => `<tr class="align-top">
        <th scope="row" class="w-44 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">${escHtml(row.criterion)}</th>
        <td class="px-3 py-3 text-sm text-gray-700">${escHtml(row.detectedStack)}</td>
        <td class="px-3 py-3 text-sm text-emerald-900">${escHtml(row.beam)}</td>
      </tr>`
    )
    .join('')

  const cards = result.detections
    .map((detection) => {
      const evidenceList = detection.evidence
        .map((item) => `<li class="rounded bg-white px-3 py-2 text-xs text-gray-700">${escHtml(item)}</li>`)
        .join('')
      return `<article class="rounded-xl border border-gray-200 bg-white p-4">
        <h3 class="text-base font-semibold text-gray-900">${escHtml(detection.vendorName)}</h3>
        <ul class="mt-3 space-y-2">${evidenceList}</ul>
      </article>`
    })
    .join('')

  const detectionsBlock =
    result.detections.length > 0
      ? `<div class="mt-5">
      <h3 class="text-base font-semibold text-indigo-900">Detected vendors and evidence</h3>
      <p class="mt-1 text-sm text-indigo-800">Found ${result.detections.length} vendor${result.detections.length === 1 ? '' : 's'} on this page.</p>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">${cards}</div>
    </div>`
      : `<div class="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
      <h3 class="text-base font-semibold text-emerald-900">No major analytics vendors detected</h3>
      <p class="mt-1 text-sm text-emerald-800">
        We did not find Google Analytics, GTM, Plausible, Fathom, Simple Analytics, Umami, Matomo, Cloudflare Web Analytics, Vercel Analytics, PostHog, GoatCounter, or Beam on this page.
      </p>
    </div>`

  const shareActionBlock = options.permalinkUrl
    ? `<div class="mt-4 rounded-lg border border-indigo-300 bg-white px-3 py-3 text-sm text-indigo-900">
      <p><span class="font-semibold">Shareable report:</span> <a class="underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700" href="${escHtml(options.permalinkUrl)}">${escHtml(options.permalinkUrl)}</a></p>
    </div>`
    : options.sharePayload
    ? `<form method="post" action="/tools/stack-scanner/share" class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="report_payload" value="${escHtml(JSON.stringify(options.sharePayload))}" />
      <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Share report
      </button>
      <p class="text-xs text-gray-600">Creates a public permalink valid for 7 days.</p>
    </form>`
    : ''

  return `<section class="mt-8 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
    <h2 class="text-lg font-semibold text-indigo-900">Scan summary</h2>
    <p class="mt-2 text-sm text-indigo-900">${escHtml(guidance.summary)}</p>
    <p class="mt-2 text-sm text-indigo-800"><span class="font-semibold">Recommendation:</span> ${escHtml(guidance.recommendation)}${recommendationSuffix}</p>
    ${duplicateRiskBlock}
    <p class="mt-3 text-xs text-gray-600">Scanned URL: <code class="rounded bg-white px-1 py-0.5">${escHtml(result.scannedUrl)}</code></p>
    ${redirectBlock}
    ${shareActionBlock}

    ${detectionsBlock}

    <div class="mt-6 rounded-xl border border-gray-200 bg-white p-4">
      <h3 class="text-base font-semibold text-gray-900">Detected stack vs Beam</h3>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-max border-separate border-spacing-0">
          <thead>
            <tr>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Detected Stack</th>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-emerald-700">Beam</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">${comparisonRows}</tbody>
        </table>
      </div>
    </div>
  </section>`
}

function renderNextStepsSection(): string {
  return `<section class="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <h2 class="text-xl font-bold">What to do next</h2>
      <p class="mt-2 text-sm text-gray-600">
        Compare this stack against Beam's live product and decide whether a lighter, privacy-first setup is a better fit.
      </p>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row">
        <a href="/migrate" class="inline-flex items-center justify-center rounded-xl border border-emerald-600 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
          Open migration hub
        </a>
        <a href="/demo" class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
          Open live demo
        </a>
        <a href="/signup" class="inline-flex items-center justify-center rounded-xl border border-indigo-600 px-5 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          Create free account
        </a>
      </div>
    </section>`
}

function stackScannerPage(
  publicBaseUrl: string,
  submittedUrl: string | undefined,
  result: ScanResult | null
): string {
  const resultSection =
    result && result.ok
      ? renderResult(result, { sharePayload: createShareableScanPayload(result) })
      : result
      ? renderResult(result)
      : ''
  const value = submittedUrl ? escHtml(submittedUrl) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analytics Stack Scanner — Beam</title>
  <meta name="description" content="Scan any public URL and detect common analytics vendors with evidence. Free public tool from Beam." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${publicUrl(publicBaseUrl, '/tools/stack-scanner')}" />
  <meta property="og:title" content="Analytics Stack Scanner — Beam" />
  <meta property="og:description" content="Scan any public URL and detect common analytics vendors with evidence. Free public tool from Beam." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${publicUrl(publicBaseUrl, '/tools/stack-scanner')}" />
  <meta property="og:image" content="${publicUrl(publicBaseUrl, '/og/scanner')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Analytics Stack Scanner — Beam" />
  <meta name="twitter:description" content="Detect analytics vendors on any public website. Free tool." />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 text-gray-900">
  <main class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <a href="/" class="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Back to Beam</a>
    <header class="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <p class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Free Tool</p>
      <h1 class="mt-2 text-3xl font-extrabold tracking-tight">Analytics stack scanner</h1>
      <p class="mt-3 text-gray-600">
        Paste a site URL to detect common analytics vendors and see script evidence. Public, no login required.
      </p>
      <form method="get" action="/tools/stack-scanner" class="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          name="url"
          required
          value="${value}"
          placeholder="https://example.com"
          class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none ring-indigo-500 focus:ring-2"
        />
        <button
          type="submit"
          class="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Scan URL
        </button>
      </form>
      <p class="mt-3 text-xs text-gray-500">
        Safety limits: only public http/https targets, one redirect max, 5-second timeout.
      </p>
    </header>

    ${resultSection}

    ${renderNextStepsSection()}
  </main>
</body>
</html>`
}

function sharedReportPage(publicBaseUrl: string, permalinkPath: string, result: ScanSuccess): string {
  const permalink = publicUrl(publicBaseUrl, permalinkPath)
  const meta = getReportMeta(result)
  const resultSection = renderResult(result, { permalinkUrl: permalink })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(meta.title)}</title>
  <meta name="description" content="${escHtml(meta.description)}" />
  <link rel="canonical" href="${escHtml(permalink)}" />
  <meta property="og:title" content="${escHtml(meta.title)}" />
  <meta property="og:description" content="${escHtml(meta.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escHtml(permalink)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escHtml(meta.title)}" />
  <meta name="twitter:description" content="${escHtml(meta.description)}" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 text-gray-900">
  <main class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <a href="/" class="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Back to Beam</a>
    <header class="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <p class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Shared Report</p>
      <h1 class="mt-2 text-3xl font-extrabold tracking-tight">Analytics stack scanner report</h1>
      <p class="mt-3 text-gray-600">
        This permalink replays a saved scanner result. Run a fresh scan if the target site has changed.
      </p>
      <div class="mt-4">
        <a href="/tools/stack-scanner" class="inline-flex items-center justify-center rounded-xl border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
          Run a new scan
        </a>
      </div>
    </header>

    ${resultSection}

    ${renderNextStepsSection()}
  </main>
</body>
</html>`
}

function sharedReportExpiredPage(publicBaseUrl: string, reportId: string): string {
  const permalinkPath = `/tools/stack-scanner/r/${reportId}`
  const permalink = publicUrl(publicBaseUrl, permalinkPath)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scanner Report Unavailable — Beam</title>
  <meta name="description" content="This shared Beam scanner report expired or no longer exists. Run a fresh scan to generate a new report." />
  <link rel="canonical" href="${escHtml(permalink)}" />
  <meta property="og:title" content="Scanner Report Unavailable — Beam" />
  <meta property="og:description" content="This shared scanner report expired. Run a fresh scan to generate a new permalink." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escHtml(permalink)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Scanner Report Unavailable — Beam" />
  <meta name="twitter:description" content="This shared scanner report expired. Run a new scan to generate a fresh link." />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 text-gray-900">
  <main class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
    <a href="/tools/stack-scanner" class="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Back to scanner</a>
    <section class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
      <h1 class="text-2xl font-bold text-amber-900">This shared report is no longer available</h1>
      <p class="mt-3 text-sm text-amber-800">
        Shared scanner reports are temporary and may expire after 7 days. Run a new scan to create an up-to-date permalink.
      </p>
      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <a href="/tools/stack-scanner" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
          Scan a URL
        </a>
        <a href="/signup" class="inline-flex items-center justify-center rounded-xl border border-indigo-600 px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
          Create free account
        </a>
      </div>
    </section>
  </main>
</body>
</html>`
}

tools.get('/tools/stack-scanner', async (c) => {
  const publicBaseUrl = getPublicBaseUrl(c.env)
  const inputUrl = c.req.query('url')?.trim()
  if (!inputUrl) {
    return c.html(stackScannerPage(publicBaseUrl, undefined, null))
  }
  const result = await scanAnalyticsStack(inputUrl)
  return c.html(stackScannerPage(publicBaseUrl, inputUrl, result))
})

tools.post('/tools/stack-scanner/share', async (c) => {
  const body = await c.req.parseBody()
  const rawPayload = typeof body.report_payload === 'string' ? body.report_payload : ''
  const payload = parseShareableScanPayload(rawPayload)
  if (!payload) {
    return c.html(
      stackScannerPage(getPublicBaseUrl(c.env), undefined, {
        ok: false,
        inputUrl: '',
        error: 'Unable to create a shareable report from this scan. Please run a new scan and try again.',
      }),
      400
    )
  }

  const reportId = crypto.randomUUID().replace(/-/g, '')
  await c.env.KV.put(getReportKey(reportId), JSON.stringify(payload), {
    expirationTtl: REPORT_TTL_SECONDS,
  })
  return c.redirect(`/tools/stack-scanner/r/${reportId}`)
})

tools.get('/tools/stack-scanner/r/:id', async (c) => {
  const publicBaseUrl = getPublicBaseUrl(c.env)
  const reportId = toReportId(c.req.param('id'))
  if (!reportId) {
    return c.html(sharedReportExpiredPage(publicBaseUrl, c.req.param('id')), 404)
  }

  const stored = await c.env.KV.get(getReportKey(reportId))
  if (!stored) {
    return c.html(sharedReportExpiredPage(publicBaseUrl, reportId), 404)
  }

  const payload = parseShareableScanPayload(stored)
  if (!payload) {
    return c.html(sharedReportExpiredPage(publicBaseUrl, reportId), 404)
  }

  const result = scanResultFromShareablePayload(payload)
  return c.html(sharedReportPage(publicBaseUrl, `/tools/stack-scanner/r/${reportId}`, result))
})

export { tools }
