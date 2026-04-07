const SCAN_TIMEOUT_MS = 5000
export const MAX_EVIDENCE_PER_VENDOR = 4

export const VENDOR_LABELS = {
  google_analytics: 'Google Analytics',
  google_tag_manager: 'Google Tag Manager',
  plausible: 'Plausible',
  fathom: 'Fathom',
  simple_analytics: 'Simple Analytics',
  umami: 'Umami',
  matomo: 'Matomo',
  cloudflare_web_analytics: 'Cloudflare Web Analytics',
  vercel_analytics: 'Vercel Analytics',
  posthog: 'PostHog',
  goatcounter: 'GoatCounter',
  beam: 'Beam',
} as const

export type VendorId = keyof typeof VENDOR_LABELS

export type VendorDetection = {
  vendorId: VendorId
  vendorName: string
  evidence: string[]
}

export type ScanSuccess = {
  ok: true
  inputUrl: string
  scannedUrl: string
  redirectedFrom?: string
  detections: VendorDetection[]
}

type ScanFailure = {
  ok: false
  inputUrl: string
  error: string
}

export type ScanResult = ScanSuccess | ScanFailure

type ScanComparisonRow = {
  criterion: string
  detectedStack: string
  beam: string
}

export type ScanGuidance = {
  summary: string
  recommendation: string
  recommendSetupGuide: boolean
  duplicateRisk: string | null
  comparisonRows: ScanComparisonRow[]
}

export type BeamSnippetIssueCode =
  | 'missing_snippet'
  | 'wrong_host'
  | 'missing_site_id'
  | 'site_id_mismatch'

type SetupGuideSlug = 'wordpress' | 'webflow' | 'shopify' | 'ghost' | 'hugo' | 'general'

export type BeamSnippetScanSuccess = {
  ok: true
  inputUrl: string
  scannedUrl: string
  redirectedFrom?: string
  expectedSiteId: string
  expectedScriptUrl: string
  snippetDetected: boolean
  scriptHostMatches: boolean
  siteIdMatches: boolean
  detectedSiteIds: string[]
  beamScriptUrls: string[]
  issues: BeamSnippetIssueCode[]
  recommendedGuidePath: string
  recommendedGuideLabel: string
}

export type BeamSnippetScanFailure = {
  ok: false
  inputUrl: string
  error: string
}

export type BeamSnippetScanResult = BeamSnippetScanSuccess | BeamSnippetScanFailure

export type BeamSnippetGuidance = {
  tone: 'success' | 'warning'
  title: string
  summary: string
  actionItems: string[]
  guidePath: string
  guideLabel: string
}

function isIPv4(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function isPrivateIPv4(value: string): boolean {
  const parts = value.split('.').map((part) => parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }

  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

function isPrivateIPv6(value: string): boolean {
  const lower = value.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower === '0:0:0:0:0:0:0:1' || lower === '0:0:0:0:0:0:0:0') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  return /^fe[89ab]/.test(lower)
}

export function isPrivateNetworkHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  if (isIPv4(host) && isPrivateIPv4(host)) return true
  if (host.includes(':') && isPrivateIPv6(host)) return true
  return false
}

function toUrl(rawInput: string): URL {
  const trimmed = rawInput.trim()
  const maybeWithProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  return new URL(maybeWithProtocol)
}

function validateTarget(target: URL): string | null {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return 'Only http:// and https:// URLs are allowed.'
  }
  if (target.username || target.password) {
    return 'URLs with embedded credentials are not allowed.'
  }
  if (isPrivateNetworkHost(target.hostname)) {
    return 'Private-network or localhost targets are blocked for safety.'
  }
  return null
}

function normalizeEvidence(prefix: string, value: string): string {
  const clipped = value.length > 180 ? `${value.slice(0, 177)}...` : value
  return `${prefix}: ${clipped}`
}

function normalizeDetectedSiteId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
}

function addEvidence(
  bucket: Map<VendorId, Set<string>>,
  vendorId: VendorId,
  evidence: string
): void {
  const current = bucket.get(vendorId) ?? new Set<string>()
  if (current.size < MAX_EVIDENCE_PER_VENDOR) {
    current.add(evidence)
  }
  bucket.set(vendorId, current)
}

function markFromScriptSource(bucket: Map<VendorId, Set<string>>, source: string): void {
  const lower = source.toLowerCase()
  const evidence = normalizeEvidence('Script', source)

  if (
    lower.includes('googletagmanager.com/gtag/js') ||
    lower.includes('google-analytics.com/ga.js') ||
    lower.includes('google-analytics.com/analytics.js')
  ) {
    addEvidence(bucket, 'google_analytics', evidence)
  }
  if (lower.includes('googletagmanager.com/gtm.js')) {
    addEvidence(bucket, 'google_tag_manager', evidence)
  }
  if (lower.includes('plausible.io/js/') || (lower.includes('plausible.') && lower.includes('/js/'))) {
    addEvidence(bucket, 'plausible', evidence)
  }
  if (lower.includes('usefathom.com/script.js') || lower.includes('cdn.usefathom.com')) {
    addEvidence(bucket, 'fathom', evidence)
  }
  if (lower.includes('simpleanalyticscdn.com') || lower.includes('scripts.simpleanalyticscdn.com')) {
    addEvidence(bucket, 'simple_analytics', evidence)
  }
  if ((lower.includes('umami') && lower.includes('.js')) || lower.includes('/umami.js')) {
    addEvidence(bucket, 'umami', evidence)
  }
  if (lower.includes('matomo.js') || lower.includes('piwik.js') || lower.includes('/matomo/')) {
    addEvidence(bucket, 'matomo', evidence)
  }
  if (
    lower.includes('static.cloudflareinsights.com/beacon.min.js') ||
    lower.includes('cloudflareinsights.com/beacon.min.js')
  ) {
    addEvidence(bucket, 'cloudflare_web_analytics', evidence)
  }
  if (lower.includes('/_vercel/insights/script.js') || lower.includes('va.vercel-scripts.com')) {
    addEvidence(bucket, 'vercel_analytics', evidence)
  }
  if (
    lower.includes('posthog.com/static/array.js') ||
    lower.includes('i.posthog.com/static/array.js') ||
    lower.includes('/posthog.js')
  ) {
    addEvidence(bucket, 'posthog', evidence)
  }
  if (lower.includes('gc.zgo.at/count.js') || lower.includes('goatcounter.com/count.js')) {
    addEvidence(bucket, 'goatcounter', evidence)
  }
  if (lower.includes('/js/beam.js') || lower.includes('beam.keylightdigital') || lower.includes('beam-privacy.com')) {
    addEvidence(bucket, 'beam', evidence)
  }
}

function markFromInlineScript(bucket: Map<VendorId, Set<string>>, code: string): void {
  const normalized = code.replace(/\s+/g, ' ').trim()
  const lower = normalized.toLowerCase()
  if (!lower) return

  const proof = normalizeEvidence('Inline marker', normalized)

  if (lower.includes('gtag(') || lower.includes("ga('create'") || lower.includes('google_analytics')) {
    addEvidence(bucket, 'google_analytics', proof)
  }
  if ((lower.includes('datalayer') && lower.includes('gtm.start')) || lower.includes('googletagmanager.com/gtm.js')) {
    addEvidence(bucket, 'google_tag_manager', proof)
  }
  if (lower.includes('plausible(') || lower.includes('window.plausible')) {
    addEvidence(bucket, 'plausible', proof)
  }
  if (lower.includes('window.fathom') || lower.includes('fathom.track')) {
    addEvidence(bucket, 'fathom', proof)
  }
  if (lower.includes('sa_event(') || lower.includes('simpleanalytics')) {
    addEvidence(bucket, 'simple_analytics', proof)
  }
  if (lower.includes('umami.track') || lower.includes('window.umami')) {
    addEvidence(bucket, 'umami', proof)
  }
  if (lower.includes('_paq.push') || lower.includes('matomo')) {
    addEvidence(bucket, 'matomo', proof)
  }
  if (
    lower.includes('__cfbeacon') ||
    lower.includes('data-cf-beacon') ||
    lower.includes('cloudflareinsights.com/beacon.min.js')
  ) {
    addEvidence(bucket, 'cloudflare_web_analytics', proof)
  }
  if (
    lower.includes('window.va') ||
    lower.includes('va.track') ||
    lower.includes('_vercel/insights')
  ) {
    addEvidence(bucket, 'vercel_analytics', proof)
  }
  if (
    lower.includes('posthog.init(') ||
    lower.includes('posthog.capture(') ||
    lower.includes('window.posthog')
  ) {
    addEvidence(bucket, 'posthog', proof)
  }
  if (
    lower.includes('window.goatcounter') ||
    lower.includes('goatcounter.count') ||
    lower.includes('data-goatcounter')
  ) {
    addEvidence(bucket, 'goatcounter', proof)
  }
  if (lower.includes('window.beam') || lower.includes('beam.track(')) {
    addEvidence(bucket, 'beam', proof)
  }
}

function collectScriptSources(html: string, pageUrl: string): string[] {
  const scripts: string[] = []
  const srcRegex = /<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = srcRegex.exec(html)) !== null) {
    const raw = match[2]?.trim()
    if (!raw) continue
    try {
      const resolved = new URL(raw, pageUrl).toString()
      scripts.push(resolved)
    } catch {
      scripts.push(raw)
    }
  }
  return scripts
}

type ScriptTagMeta = {
  src: string
  siteId: string | null
}

function collectScriptTags(html: string, pageUrl: string): ScriptTagMeta[] {
  const tags: ScriptTagMeta[] = []
  const scriptTagRegex = /<script\b([^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = scriptTagRegex.exec(html)) !== null) {
    const attrs = match[1] ?? ''
    const srcMatch = /\bsrc\s*=\s*(['"])(.*?)\1/i.exec(attrs)
    if (!srcMatch?.[2]) continue
    const rawSrc = srcMatch[2].trim()
    if (!rawSrc) continue

    let resolvedSrc = rawSrc
    try {
      resolvedSrc = new URL(rawSrc, pageUrl).toString()
    } catch {
      // Keep original unresolved source when URL parsing fails.
    }

    const siteIdMatch = /\bdata-site-id\s*=\s*(['"])(.*?)\1/i.exec(attrs)
    tags.push({
      src: resolvedSrc,
      siteId: normalizeDetectedSiteId(siteIdMatch?.[2]),
    })
  }
  return tags
}

function isBeamScriptSource(source: string): boolean {
  const lower = source.toLowerCase()
  if (lower.includes('/js/beam.js') || lower.includes('beam.keylightdigital') || lower.includes('beam-privacy.com')) {
    return true
  }
  try {
    const url = new URL(source)
    return /(^|\/)beam\.js$/i.test(url.pathname)
  } catch {
    return lower.includes('beam.js')
  }
}

function normalizeScriptUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function inferSetupGuideSlug(html: string, scannedUrl: string): SetupGuideSlug {
  const lower = html.toLowerCase()
  const host = (() => {
    try {
      return new URL(scannedUrl).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()

  if (
    lower.includes('wp-content') ||
    lower.includes('wp-includes') ||
    lower.includes('wordpress') ||
    host.includes('wordpress')
  ) {
    return 'wordpress'
  }
  if (lower.includes('webflow') || host.endsWith('.webflow.io')) {
    return 'webflow'
  }
  if (lower.includes('cdn.shopify.com') || host.endsWith('.myshopify.com')) {
    return 'shopify'
  }
  if (lower.includes('ghost') || host.includes('ghost')) {
    return 'ghost'
  }
  if (lower.includes('generator" content="hugo') || lower.includes('meta name="generator" content="hugo')) {
    return 'hugo'
  }
  return 'general'
}

function guidePathFromSlug(slug: SetupGuideSlug): string {
  if (slug === 'general') return '/for'
  return `/for/${slug}`
}

function guideLabelFromSlug(slug: SetupGuideSlug): string {
  switch (slug) {
    case 'wordpress':
      return 'WordPress setup guide'
    case 'webflow':
      return 'Webflow setup guide'
    case 'shopify':
      return 'Shopify setup guide'
    case 'ghost':
      return 'Ghost setup guide'
    case 'hugo':
      return 'Hugo setup guide'
    default:
      return 'All setup guides'
  }
}

function collectInlineScripts(html: string): string[] {
  const scripts: string[] = []
  const inlineRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = inlineRegex.exec(html)) !== null) {
    const code = match[1]?.trim()
    if (code) scripts.push(code)
  }
  return scripts
}

export function detectAnalyticsVendors(html: string, pageUrl: string): VendorDetection[] {
  const evidenceByVendor = new Map<VendorId, Set<string>>()
  const scriptSources = collectScriptSources(html, pageUrl)
  for (const source of scriptSources) {
    markFromScriptSource(evidenceByVendor, source)
  }
  const inlineScripts = collectInlineScripts(html)
  for (const inline of inlineScripts) {
    markFromInlineScript(evidenceByVendor, inline)
  }

  return (Object.keys(VENDOR_LABELS) as VendorId[])
    .filter((vendorId) => (evidenceByVendor.get(vendorId)?.size ?? 0) > 0)
    .map((vendorId) => ({
      vendorId,
      vendorName: VENDOR_LABELS[vendorId],
      evidence: Array.from(evidenceByVendor.get(vendorId) ?? []),
    }))
}

function joinNaturalList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  const head = items.slice(0, -1).join(', ')
  const tail = items[items.length - 1] ?? ''
  return `${head}, and ${tail}`
}

export function buildScanGuidance(detections: VendorDetection[]): ScanGuidance {
  const hasBeam = detections.some((detection) => detection.vendorId === 'beam')
  const thirdPartyDetections = detections.filter((detection) => detection.vendorId !== 'beam')
  const thirdPartyNames = thirdPartyDetections.map((detection) => detection.vendorName)

  let summary = ''
  let recommendation = ''
  let recommendSetupGuide = false

  if (detections.length === 0) {
    summary =
      'No major analytics vendor was detected on this page. You have a clean starting point to add one privacy-first analytics setup.'
    recommendation =
      'Install Beam as your first analytics layer so you can start tracking traffic without adding cookies or multiple vendor scripts.'
    recommendSetupGuide = true
  } else if (hasBeam && thirdPartyDetections.length === 0) {
    summary =
      'Beam is the only detected analytics vendor on this page. This looks like a simplified first-party setup.'
    recommendation =
      'Keep Beam as your single analytics source to avoid duplicate instrumentation and keep privacy/compliance review straightforward.'
  } else if (hasBeam && thirdPartyDetections.length > 0) {
    summary = `Beam was detected alongside ${thirdPartyDetections.length} other vendor${
      thirdPartyDetections.length === 1 ? '' : 's'
    }: ${joinNaturalList(thirdPartyNames)}.`
    recommendation =
      'This mixed stack can increase privacy/compliance overhead because traffic data is split across external processors. If possible, consolidate to Beam for a cookie-free first-party install and one reporting workflow.'
  } else {
    summary = `Detected ${thirdPartyDetections.length} analytics vendor${
      thirdPartyDetections.length === 1 ? '' : 's'
    }: ${joinNaturalList(thirdPartyNames)}.`
    recommendation =
      'These third-party tools often send analytics data to vendor-owned domains, which can expand consent and compliance scope. Beam offers a cookie-free first-party alternative with less instrumentation overhead.'
  }

  const duplicateRisk =
    detections.length > 1
      ? 'Multiple analytics vendors were detected. Duplicate instrumentation can increase page weight, fragment reporting, and create ownership confusion when numbers disagree.'
      : null

  const detectedPrivacy =
    detections.length === 0
      ? 'No major analytics tracker detected yet; adding several trackers later can increase consent/compliance complexity.'
      : thirdPartyDetections.length > 0
      ? `${thirdPartyDetections.length} non-Beam vendor${
          thirdPartyDetections.length === 1 ? '' : 's'
        } detected; third-party data flows usually require additional privacy/compliance review.`
      : 'Beam-only analytics detected; this already aligns with a cookie-free first-party posture.'

  const detectedSetup =
    detections.length === 0
      ? 'No analytics implementation detected yet.'
      : detections.length === 1
      ? 'Single analytics vendor detected.'
      : `${detections.length} analytics vendors detected; parallel scripts increase setup and maintenance complexity.`

  const detectedDecisionSupport =
    detections.length === 0
      ? 'No analytics decision-support layer is currently active.'
      : hasBeam && thirdPartyDetections.length === 0
      ? 'Beam decision-support features are already available in one place.'
      : hasBeam
      ? 'Beam features are available, but parallel tooling can split ownership and interpretation.'
      : 'Decision-support coverage depends on separate tools and integrations.'

  return {
    summary,
    recommendation,
    recommendSetupGuide,
    duplicateRisk,
    comparisonRows: [
      {
        criterion: 'Cookies / Privacy posture',
        detectedStack: detectedPrivacy,
        beam: 'Cookie-free first-party script with no localStorage or cross-site ID storage.',
      },
      {
        criterion: 'Setup complexity',
        detectedStack: detectedSetup,
        beam: 'One script and one dashboard workflow.',
      },
      {
        criterion: 'Decision-support features',
        detectedStack: detectedDecisionSupport,
        beam: 'Built-in goals, traffic channels, anomaly alerts, and plain-English insights.',
      },
    ],
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

type PublicHtmlFetchSuccess = {
  ok: true
  inputUrl: string
  scannedUrl: string
  redirectedFrom?: string
  html: string
}

type PublicHtmlFetchFailure = {
  ok: false
  inputUrl: string
  error: string
}

type PublicHtmlFetchResult = PublicHtmlFetchSuccess | PublicHtmlFetchFailure

async function fetchPublicHtml(
  rawInput: string,
  fetchFn: typeof fetch = fetch
): Promise<PublicHtmlFetchResult> {
  const inputUrl = rawInput.trim()
  if (!inputUrl) {
    return { ok: false, inputUrl, error: 'Enter a URL to scan.' }
  }

  let initialUrl: URL
  try {
    initialUrl = toUrl(inputUrl)
  } catch {
    return { ok: false, inputUrl, error: 'That URL is invalid. Use a full site URL like https://example.com.' }
  }

  const initialValidationError = validateTarget(initialUrl)
  if (initialValidationError) {
    return { ok: false, inputUrl, error: initialValidationError }
  }

  const fetchInit: RequestInit = {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  }

  let currentUrl = initialUrl.toString()
  let redirectedFrom: string | undefined

  try {
    let response = await fetchWithTimeout(fetchFn, currentUrl, fetchInit, SCAN_TIMEOUT_MS)

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get('location')
      if (!location) {
        return { ok: false, inputUrl, error: `Redirect target from ${currentUrl} did not include a Location header.` }
      }

      const redirectUrl = new URL(location, currentUrl)
      const redirectValidationError = validateTarget(redirectUrl)
      if (redirectValidationError) {
        return { ok: false, inputUrl, error: `Redirect blocked: ${redirectValidationError}` }
      }

      redirectedFrom = currentUrl
      currentUrl = redirectUrl.toString()
      response = await fetchWithTimeout(fetchFn, currentUrl, fetchInit, SCAN_TIMEOUT_MS)

      if (isRedirectStatus(response.status)) {
        return { ok: false, inputUrl, error: 'The target redirected more than once. Only one redirect is allowed.' }
      }
    }

    if (!response.ok) {
      return { ok: false, inputUrl, error: `Target responded with HTTP ${response.status}.` }
    }

    return {
      ok: true,
      inputUrl,
      scannedUrl: currentUrl,
      redirectedFrom,
      html: await response.text(),
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, inputUrl, error: 'Scan timed out after 5 seconds. Try a faster page or try again later.' }
    }
    return { ok: false, inputUrl, error: 'Unable to fetch that page right now.' }
  }
}

export async function scanAnalyticsStack(
  rawInput: string,
  fetchFn: typeof fetch = fetch
): Promise<ScanResult> {
  const fetched = await fetchPublicHtml(rawInput, fetchFn)
  if (!fetched.ok) {
    return fetched
  }

  const detections = detectAnalyticsVendors(fetched.html, fetched.scannedUrl)
  return {
    ok: true,
    inputUrl: fetched.inputUrl,
    scannedUrl: fetched.scannedUrl,
    redirectedFrom: fetched.redirectedFrom,
    detections,
  }
}

export async function scanBeamSnippetInstallation(
  rawInput: string,
  expectedSiteId: string,
  expectedScriptUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<BeamSnippetScanResult> {
  const fetched = await fetchPublicHtml(rawInput, fetchFn)
  if (!fetched.ok) {
    return fetched
  }

  const expectedScript = normalizeScriptUrl(expectedScriptUrl)
  if (!expectedScript) {
    return { ok: false, inputUrl: fetched.inputUrl, error: 'Beam script URL is misconfigured. Contact support.' }
  }

  const expectedPath = expectedScript.pathname
  const expectedHost = expectedScript.hostname.toLowerCase()
  const scriptTags = collectScriptTags(fetched.html, fetched.scannedUrl)
  const beamScripts = scriptTags.filter((tag) => isBeamScriptSource(tag.src))
  const expectedHostScripts = beamScripts.filter((tag) => {
    const parsed = normalizeScriptUrl(tag.src)
    if (!parsed) return false
    return parsed.hostname.toLowerCase() === expectedHost && parsed.pathname === expectedPath
  })

  const siteIdPool = expectedHostScripts.length > 0 ? expectedHostScripts : beamScripts
  const detectedSiteIds = Array.from(
    new Set(
      siteIdPool
        .map((tag) => normalizeDetectedSiteId(tag.siteId))
        .filter((id): id is string => id !== null)
    )
  )

  const issues: BeamSnippetIssueCode[] = []
  if (beamScripts.length === 0) {
    issues.push('missing_snippet')
  } else {
    if (expectedHostScripts.length === 0) {
      issues.push('wrong_host')
    }
    if (detectedSiteIds.length === 0) {
      issues.push('missing_site_id')
    } else if (!detectedSiteIds.includes(expectedSiteId)) {
      issues.push('site_id_mismatch')
    }
  }

  const guideSlug = inferSetupGuideSlug(fetched.html, fetched.scannedUrl)
  return {
    ok: true,
    inputUrl: fetched.inputUrl,
    scannedUrl: fetched.scannedUrl,
    redirectedFrom: fetched.redirectedFrom,
    expectedSiteId,
    expectedScriptUrl: expectedScript.toString(),
    snippetDetected: beamScripts.length > 0,
    scriptHostMatches: expectedHostScripts.length > 0,
    siteIdMatches: detectedSiteIds.includes(expectedSiteId),
    detectedSiteIds,
    beamScriptUrls: beamScripts.map((tag) => tag.src),
    issues,
    recommendedGuidePath: guidePathFromSlug(guideSlug),
    recommendedGuideLabel: guideLabelFromSlug(guideSlug),
  }
}

export function buildBeamSnippetGuidance(result: BeamSnippetScanSuccess): BeamSnippetGuidance {
  const guidePath = result.recommendedGuidePath
  const guideLabel = result.recommendedGuideLabel
  const hasIssue = (code: BeamSnippetIssueCode) => result.issues.includes(code)

  if (result.issues.length === 0) {
    return {
      tone: 'success',
      title: 'Snippet check passed',
      summary: 'Beam script and data-site-id look correct on this page.',
      actionItems: [
        'Publish and hard-refresh the page to avoid stale cached bundles.',
        'Run "Verify installation" to confirm a fresh pageview or custom event arrives.',
      ],
      guidePath,
      guideLabel,
    }
  }

  const actionItems: string[] = []
  let summary = 'Beam found snippet issues on this page.'

  if (hasIssue('missing_snippet')) {
    summary = 'No Beam snippet was detected on this page.'
    actionItems.push('Add the Beam snippet in the <head> section before closing </head>.')
  }
  if (hasIssue('wrong_host')) {
    actionItems.push(`Use this script source exactly: ${result.expectedScriptUrl}.`)
  }
  if (hasIssue('missing_site_id')) {
    actionItems.push(`Add a data-site-id attribute to the script tag: data-site-id="${result.expectedSiteId}".`)
  }
  if (hasIssue('site_id_mismatch')) {
    const detected = result.detectedSiteIds.join(', ') || 'none'
    actionItems.push(`Replace the current site id (${detected}) with ${result.expectedSiteId}.`)
  }
  actionItems.push('After updating your site, publish and rerun this scan.')

  return {
    tone: 'warning',
    title: 'Snippet check needs fixes',
    summary,
    actionItems,
    guidePath,
    guideLabel,
  }
}
