export type LaunchOffer = {
  code: string
  promoCode: string
  headline: string
  discountSummary: string
  termsSummary: string
  expiresAt: string
}

export type LaunchOfferResolution = {
  status: 'none' | 'valid' | 'invalid' | 'expired'
  code: string | null
  offer: LaunchOffer | null
}

export const DEFAULT_LAUNCH_OFFER_CODE = 'launch-2026'

const LAUNCH_OFFERS: Record<string, LaunchOffer> = {
  'launch-2026': {
    code: 'launch-2026',
    promoCode: 'BEAMLAUNCH25',
    headline: 'Launch Offer',
    discountSummary: '25% off Pro for your first 3 months',
    termsSummary: 'Available for new Pro subscriptions during launch. Ends May 31, 2026 (UTC).',
    expiresAt: '2026-05-31T23:59:59.000Z',
  },
}

export function normalizeLaunchOfferCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = raw.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(normalized)) return null
  return normalized
}

export function resolveLaunchOffer(rawCode: string | null | undefined, now = new Date()): LaunchOfferResolution {
  const normalized = normalizeLaunchOfferCode(rawCode)
  if (!normalized) return { status: 'none', code: null, offer: null }

  const offer = LAUNCH_OFFERS[normalized]
  if (!offer) {
    return { status: 'invalid', code: normalized, offer: null }
  }

  const expiresAtMs = Date.parse(offer.expiresAt)
  if (!Number.isFinite(expiresAtMs) || now.getTime() > expiresAtMs) {
    return { status: 'expired', code: offer.code, offer }
  }

  return { status: 'valid', code: offer.code, offer }
}

export function getDefaultLaunchOffer(now = new Date()): LaunchOffer | null {
  const resolved = resolveLaunchOffer(DEFAULT_LAUNCH_OFFER_CODE, now)
  return resolved.status === 'valid' ? resolved.offer : null
}
