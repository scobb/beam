import type { Env } from '../types'
import { isInternalOrTestEmail } from './internalTraffic'
import { getPublicBaseUrl } from './publicUrl'

const ADMIN_EMAIL = 'steve@keylightdigital.dev'
const FROM_EMAIL = 'Beam <beam@keylightdigital.dev>'
const RESEND_URL = 'https://api.resend.com/emails'
const EMAIL_TIMEOUT_MS = 4000

type ActivationAlertColumn = 'first_site_alert_sent_at' | 'first_activity_alert_sent_at'

export type ActivationAlertUserContext = {
  userId: string
  email: string
  firstTouchIsInternal: number
  firstTouchRef: string | null
  firstTouchUtmSource: string | null
  firstTouchUtmMedium: string | null
  firstTouchUtmCampaign: string | null
  firstSiteId?: string | null
  firstSiteAlertSentAt?: string | null
  firstActivityAlertSentAt?: string | null
}

type FirstSiteAlertInput = {
  user: ActivationAlertUserContext
  siteId: string
  siteName: string
  siteDomain: string
  occurredAt: string
}

type FirstActivityAlertInput = {
  user: ActivationAlertUserContext
  siteId: string
  siteName: string
  siteDomain: string
  occurredAt: string
  activityType: 'pageview' | 'custom_event'
  eventName?: string | null
}

function normalizeValue(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function acquisitionContextLines(user: ActivationAlertUserContext): string[] {
  const source = normalizeValue(user.firstTouchRef)
    ?? normalizeValue(user.firstTouchUtmSource)
    ?? 'direct/unknown'
  const medium = normalizeValue(user.firstTouchUtmMedium) ?? 'n/a'
  const campaign = normalizeValue(user.firstTouchUtmCampaign) ?? 'n/a'

  return [
    `Attribution source: ${source}`,
    `Attribution medium: ${medium}`,
    `Attribution campaign: ${campaign}`,
  ]
}

function claimAlertSql(column: ActivationAlertColumn): string {
  return `UPDATE users
SET ${column} = ?, updated_at = ?
WHERE id = ?
  AND ${column} IS NULL`
}

function releaseAlertSql(column: ActivationAlertColumn): string {
  return `UPDATE users
SET ${column} = NULL
WHERE id = ?
  AND ${column} = ?`
}

function changedRows(result: D1Result<unknown>): number {
  return Number(result.meta.changes ?? 0)
}

async function claimAlert(
  env: Env,
  userId: string,
  column: ActivationAlertColumn,
  claimedAt: string
): Promise<boolean> {
  const result = await env.DB.prepare(claimAlertSql(column))
    .bind(claimedAt, claimedAt, userId)
    .run()
  return changedRows(result) > 0
}

async function releaseAlertClaim(
  env: Env,
  userId: string,
  column: ActivationAlertColumn,
  claimedAt: string
): Promise<void> {
  await env.DB.prepare(releaseAlertSql(column)).bind(userId, claimedAt).run()
}

async function sendAdminEmail(env: Env, subject: string, text: string): Promise<void> {
  const resendKey = env.RESEND_API_KEY
  if (!resendKey) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS)
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject,
        text,
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export function shouldAlertForExternalUser(user: Pick<ActivationAlertUserContext, 'email' | 'firstTouchIsInternal'>): boolean {
  if (Number(user.firstTouchIsInternal ?? 0) === 1) return false
  return !isInternalOrTestEmail(user.email)
}

export function shouldAttemptFirstSiteAlert(user: ActivationAlertUserContext): boolean {
  if (!shouldAlertForExternalUser(user)) return false
  return normalizeValue(user.firstSiteAlertSentAt) === null
}

export function shouldAttemptFirstActivityAlert(user: ActivationAlertUserContext, siteId: string): boolean {
  if (!shouldAlertForExternalUser(user)) return false
  if (normalizeValue(user.firstActivityAlertSentAt) !== null) return false
  return normalizeValue(user.firstSiteId) === siteId
}

export async function maybeSendFirstSiteCreatedAlert(env: Env, input: FirstSiteAlertInput): Promise<void> {
  if (!env.RESEND_API_KEY) return
  if (!shouldAttemptFirstSiteAlert(input.user)) return

  const claimedAt = input.occurredAt
  try {
    const claimed = await claimAlert(env, input.user.userId, 'first_site_alert_sent_at', claimedAt)
    if (!claimed) return

    const baseUrl = getPublicBaseUrl(env)
    const dashboardUrl = `${baseUrl}/dashboard/sites/${input.siteId}`
    const context = acquisitionContextLines(input.user)
    const subject = `Beam activation: first site created (${input.siteDomain})`
    const text = [
      'Beam milestone reached: first site created by an external account.',
      '',
      `User email: ${input.user.email}`,
      `Site name: ${input.siteName}`,
      `Site domain: ${input.siteDomain}`,
      `Timestamp: ${input.occurredAt}`,
      ...context,
      '',
      `Review site setup: ${dashboardUrl}`,
    ].join('\n')

    await sendAdminEmail(env, subject, text)
  } catch {
    await releaseAlertClaim(env, input.user.userId, 'first_site_alert_sent_at', claimedAt).catch(() => {})
  }
}

export async function maybeSendFirstActivityAlert(env: Env, input: FirstActivityAlertInput): Promise<void> {
  if (!env.RESEND_API_KEY) return
  if (!shouldAttemptFirstActivityAlert(input.user, input.siteId)) return

  const claimedAt = input.occurredAt
  try {
    const claimed = await claimAlert(env, input.user.userId, 'first_activity_alert_sent_at', claimedAt)
    if (!claimed) return

    const baseUrl = getPublicBaseUrl(env)
    const dashboardUrl = `${baseUrl}/dashboard/sites/${input.siteId}/analytics?range=today`
    const context = acquisitionContextLines(input.user)
    const activityLabel = input.activityType === 'custom_event'
      ? `first custom event (${normalizeValue(input.eventName) ?? 'unnamed'})`
      : 'first pageview'
    const subject = `Beam activation: first activity on ${input.siteDomain}`
    const text = [
      'Beam milestone reached: first site received initial activity from an external account.',
      '',
      `User email: ${input.user.email}`,
      `Site name: ${input.siteName}`,
      `Site domain: ${input.siteDomain}`,
      `Activity milestone: ${activityLabel}`,
      `Timestamp: ${input.occurredAt}`,
      ...context,
      '',
      `Review analytics: ${dashboardUrl}`,
    ].join('\n')

    await sendAdminEmail(env, subject, text)
  } catch {
    await releaseAlertClaim(env, input.user.userId, 'first_activity_alert_sent_at', claimedAt).catch(() => {})
  }
}
