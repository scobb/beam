import type { Env } from '../types'
import { getPublicBaseUrl } from './publicUrl'

const FREE_PLAN_LIMIT = 50_000
const WARNING_THRESHOLD = 40_000 // 80% of free limit
const FROM_EMAIL = 'Beam <beam@keylightdigital.dev>'
const RESEND_URL = 'https://api.resend.com/emails'
const EMAIL_TIMEOUT_MS = 4000

export type LimitWarningContext = {
  userId: string
  userEmail: string
  monthlyCount: number
}

function getMonthKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Send a one-time warning email when a free user crosses 80% of their monthly
 * pageview limit. Uses a KV key to ensure exactly one email per user per month.
 *
 * Must be called with waitUntil() so it doesn't slow down the collect response.
 */
export async function maybeSendLimitWarning(
  env: Env,
  ctx: LimitWarningContext
): Promise<void> {
  if (!env.RESEND_API_KEY) return
  if (ctx.monthlyCount < WARNING_THRESHOLD) return

  const monthKey = getMonthKey()
  const kvKey = `limitWarn:${ctx.userId}:${monthKey}`

  // Check-and-set: put returns undefined, so we check first with getWithMetadata
  // to avoid double-send. Use a simple "already sent" KV guard.
  const existing = await env.KV.get(kvKey)
  if (existing !== null) return

  // Claim the send slot before emailing to prevent races
  await env.KV.put(kvKey, '1', {
    // TTL to end of next month (max ~62 days) so key expires naturally
    expirationTtl: 62 * 24 * 60 * 60,
  })

  const baseUrl = getPublicBaseUrl(env)
  const upgradeUrl = `${baseUrl}/dashboard/billing`
  const used = ctx.monthlyCount.toLocaleString('en-US')
  const limit = FREE_PLAN_LIMIT.toLocaleString('en-US')
  const remaining = (FREE_PLAN_LIMIT - ctx.monthlyCount).toLocaleString('en-US')

  const subject = `You've used ${used} of ${limit} pageviews this month`
  const text = [
    `Hi,`,
    ``,
    `Your Beam site has recorded ${used} pageviews this month — that's 80% of your free plan's ${limit} pageview monthly limit.`,
    ``,
    `When you hit ${limit} pageviews, Beam stops collecting data for the rest of the month. You have roughly ${remaining} pageviews left.`,
    ``,
    `Upgrade to Beam Pro ($5/month) for unlimited pageviews and sites:`,
    upgradeUrl,
    ``,
    `If you don't need more data right now, no action is needed — your limit resets at the start of next month.`,
    ``,
    `— The Beam team`,
    `beam-privacy.com`,
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS)
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ctx.userEmail,
        subject,
        text,
      }),
      signal: controller.signal,
    })
  } catch {
    // Fire-and-forget: swallow errors, KV key is already set so we don't retry
  } finally {
    clearTimeout(timeout)
  }
}
