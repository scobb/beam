export type TrafficChannel = 'Search' | 'Social' | 'Email' | 'Direct' | 'Referral' | 'Paid'

const SEARCH_PATTERNS = [
  'google.',
  'bing.com',
  'duckduckgo.com',
  'yahoo.',
  'baidu.com',
  'yandex.',
  'ecosia.org',
  'search.brave.com',
]

const SOCIAL_PATTERNS = [
  'twitter.com',
  'x.com',
  't.co',
  'facebook.com',
  'reddit.com',
  'linkedin.com',
  'mastodon.',
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'tiktok.com',
  'news.ycombinator.com',
]

const EMAIL_PATTERNS = [
  'mail.google.com',
  'mail.yahoo.com',
  'outlook.live.com',
  'mail.proton.me',
  'mail.protonmail.com',
  'mail.aol.com',
]

const TRAFFIC_CHANNELS: TrafficChannel[] = ['Search', 'Social', 'Email', 'Direct', 'Referral', 'Paid']

function normalizeRaw(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.toLowerCase()
  } catch {
    return referrer
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, '')
      .split('/')[0] ?? ''
  }
}

export function normalizeTrafficChannel(raw: string | null | undefined): TrafficChannel | null {
  const normalized = normalizeRaw(raw)
  for (const channel of TRAFFIC_CHANNELS) {
    if (channel.toLowerCase() === normalized) return channel
  }
  return null
}

export function classifyTrafficChannel(
  referrer: string | null | undefined,
  utmMedium: string | null | undefined,
): TrafficChannel {
  const medium = normalizeRaw(utmMedium)
  if (medium === 'email') return 'Email'
  if (medium === 'social') return 'Social'
  if (medium === 'cpc') return 'Paid'

  const rawReferrer = normalizeRaw(referrer)
  if (!rawReferrer || rawReferrer === 'direct') return 'Direct'

  const host = referrerHost(rawReferrer)
  if (includesAny(host, EMAIL_PATTERNS)) return 'Email'
  if (includesAny(host, SEARCH_PATTERNS)) return 'Search'
  if (includesAny(host, SOCIAL_PATTERNS)) return 'Social'

  return 'Referral'
}

function toSqlLikeList(refExpr: string, patterns: string[]): string {
  return patterns.map((pattern) => `${refExpr} LIKE '%${pattern}%'`).join(' OR ')
}

export function buildTrafficChannelSql(
  referrerColumn = 'referrer',
  utmMediumColumn = 'utm_medium',
): string {
  const refExpr = `LOWER(COALESCE(${referrerColumn}, ''))`
  const mediumExpr = `LOWER(TRIM(COALESCE(${utmMediumColumn}, '')))`

  return `CASE
    WHEN ${mediumExpr} = 'email' THEN 'Email'
    WHEN ${mediumExpr} = 'social' THEN 'Social'
    WHEN ${mediumExpr} = 'cpc' THEN 'Paid'
    WHEN TRIM(COALESCE(${referrerColumn}, '')) = '' THEN 'Direct'
    WHEN (${toSqlLikeList(refExpr, EMAIL_PATTERNS)}) THEN 'Email'
    WHEN (${toSqlLikeList(refExpr, SEARCH_PATTERNS)}) THEN 'Search'
    WHEN (${toSqlLikeList(refExpr, SOCIAL_PATTERNS)}) THEN 'Social'
    ELSE 'Referral'
  END`
}
