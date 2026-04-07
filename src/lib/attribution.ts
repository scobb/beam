import { isInternalOrTestEmail } from './internalTraffic'

export const FIRST_TOUCH_COOKIE = 'beam_first_touch'
export const FIRST_TOUCH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const INTERNAL_REF_VALUES = new Set(['internal', 'dogfood', 'self', 'beam'])

type NormalizedAttribution = {
  ref: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  offerCode: string | null
  referrerHost: string | null
  landingPath: string
  capturedAt: string
}

export type FirstTouchAttribution = NormalizedAttribution

export type SignupAttributionColumns = {
  firstTouchRef: string | null
  firstTouchUtmSource: string | null
  firstTouchUtmMedium: string | null
  firstTouchUtmCampaign: string | null
  firstTouchOfferCode: string | null
  firstTouchReferrerHost: string | null
  firstTouchLandingPath: string | null
  firstTouchCapturedAt: string | null
  firstTouchIsInternal: number
}

function normalizeValue(raw: string | null | undefined, maxLength = 120): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function normalizeLandingPath(pathname: string | null | undefined): string {
  const raw = pathname?.trim() ?? '/'
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`
  return prefixed.slice(0, 512) || '/'
}

function parseReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    return normalizeValue(host, 255)
  } catch {
    return null
  }
}

function isValidIsoDate(raw: unknown): raw is string {
  return typeof raw === 'string' && !Number.isNaN(Date.parse(raw))
}

function normalizeAttribution(raw: Record<string, unknown>): FirstTouchAttribution | null {
  if (!isValidIsoDate(raw.capturedAt)) return null

  return {
    ref: normalizeValue(typeof raw.ref === 'string' ? raw.ref : null),
    utmSource: normalizeValue(typeof raw.utmSource === 'string' ? raw.utmSource : null),
    utmMedium: normalizeValue(typeof raw.utmMedium === 'string' ? raw.utmMedium : null),
    utmCampaign: normalizeValue(typeof raw.utmCampaign === 'string' ? raw.utmCampaign : null),
    offerCode: normalizeValue(typeof raw.offerCode === 'string' ? raw.offerCode : null),
    referrerHost: normalizeValue(typeof raw.referrerHost === 'string' ? raw.referrerHost : null, 255),
    landingPath: normalizeLandingPath(typeof raw.landingPath === 'string' ? raw.landingPath : '/'),
    capturedAt: new Date(raw.capturedAt).toISOString(),
  }
}

export function buildFirstTouchAttribution(url: URL, refererHeader: string | undefined, now = new Date()): FirstTouchAttribution {
  return {
    ref: normalizeValue(url.searchParams.get('ref')),
    utmSource: normalizeValue(url.searchParams.get('utm_source')),
    utmMedium: normalizeValue(url.searchParams.get('utm_medium')),
    utmCampaign: normalizeValue(url.searchParams.get('utm_campaign')),
    offerCode: normalizeValue(url.searchParams.get('offer')),
    referrerHost: parseReferrerHost(refererHeader),
    landingPath: normalizeLandingPath(url.pathname),
    capturedAt: now.toISOString(),
  }
}

export function serializeFirstTouchCookie(attribution: FirstTouchAttribution): string {
  return JSON.stringify(attribution)
}

export function parseFirstTouchCookie(rawCookie: string | undefined): FirstTouchAttribution | null {
  if (!rawCookie) return null
  try {
    const parsed = JSON.parse(rawCookie)
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeAttribution(parsed as Record<string, unknown>)
  } catch {
    return null
  }
}

export function isInternalAttribution(attribution: FirstTouchAttribution | null, email: string): boolean {
  if (isInternalOrTestEmail(email)) return true

  if (!attribution) return false

  const refValue = (attribution.ref ?? '').trim().toLowerCase()
  if (refValue && INTERNAL_REF_VALUES.has(refValue)) return true

  const host = (attribution.referrerHost ?? '').toLowerCase()
  if (
    host.includes('keylightdigital.') ||
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host === 'example.com' ||
    host.endsWith('.example.com')
  ) {
    return true
  }

  const source = (attribution.utmSource ?? '').toLowerCase()
  if (source.includes('keylight') || source === 'internal') return true

  return false
}

export function buildSignupAttributionColumns(rawCookie: string | undefined, email: string): SignupAttributionColumns {
  const firstTouch = parseFirstTouchCookie(rawCookie)
  return {
    firstTouchRef: firstTouch?.ref ?? null,
    firstTouchUtmSource: firstTouch?.utmSource ?? null,
    firstTouchUtmMedium: firstTouch?.utmMedium ?? null,
    firstTouchUtmCampaign: firstTouch?.utmCampaign ?? null,
    firstTouchOfferCode: firstTouch?.offerCode ?? null,
    firstTouchReferrerHost: firstTouch?.referrerHost ?? null,
    firstTouchLandingPath: firstTouch?.landingPath ?? null,
    firstTouchCapturedAt: firstTouch?.capturedAt ?? null,
    firstTouchIsInternal: isInternalAttribution(firstTouch, email) ? 1 : 0,
  }
}
