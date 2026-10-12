import type { Env } from './types'
import { ALERT_HISTORY_DAYS, detectSpike, detectTrackingStopped, type TrackingStopped, type TrafficSpike } from './lib/alerts'
import { generateSiteInsights, type SiteInsights } from './lib/insights'
import { getPublicBaseUrl } from './lib/publicUrl'
import { signUnsubscribe } from './routes/digest'

const FROM_EMAIL = 'Beam <beam@keylightdigital.dev>'
const RESEND_URL = 'https://api.resend.com/emails'
const WEEKLY_DIGEST_CRON = '0 9 * * 1'
const DAILY_ALERT_CRON = '0 9 * * *'

interface DigestUser {
  id: string
  email: string
}

interface PageviewCount {
  count: number
}

interface TopPage {
  path: string
  count: number
}

interface TopReferrer {
  referrer: string
  count: number
}

interface AlertTarget {
  siteId: string
  siteName: string
  email: string
}

function isoDateOffset(now: Date, daysBack: number): string {
  return new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString()
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function pctChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '—'
  if (previous === 0) return '+∞%'
  const pct = Math.round(((current - previous) / previous) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

function pctColor(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '#6b7280'
  if (current >= previous) return '#059669'
  return '#dc2626'
}

function displayReferrer(referrer: string | null | undefined): string {
  const raw = (referrer ?? '').trim()
  if (raw.length === 0) return 'Direct'
  try {
    return new URL(raw).hostname || raw
  } catch {
    return raw
  }
}

function formatBaseline(value: number): string {
  if (value >= 10) return value.toFixed(0)
  return value.toFixed(1)
}

async function sendDigestEmail(
  env: Env,
  user: DigestUser,
  siteName: string,
  siteId: string,
  thisWeekPv: number,
  lastWeekPv: number,
  thisWeekUv: number,
  lastWeekUv: number,
  topPages: TopPage[],
  topReferrers: TopReferrer[],
  siteInsights: SiteInsights
): Promise<void> {
  const resendKey = env.RESEND_API_KEY
  if (!resendKey) return
  const baseUrl = getPublicBaseUrl(env)

  const secret = env.BEAM_JWT_SECRET ?? 'dev-secret-changeme'
  const unsubToken = await signUnsubscribe(user.id, secret)
  const unsubUrl = `${baseUrl}/api/digest/unsubscribe?token=${unsubToken}`
  const dashUrl = `${baseUrl}/dashboard/sites/${siteId}`

  const pvChange = pctChange(thisWeekPv, lastWeekPv)
  const pvColor = pctColor(thisWeekPv, lastWeekPv)
  const uvChange = pctChange(thisWeekUv, lastWeekUv)
  const uvColor = pctColor(thisWeekUv, lastWeekUv)

  const topPagesRows = topPages.length > 0
    ? topPages.map(p => `
      <tr>
        <td style="padding:6px 0;font-family:monospace;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${p.path}</td>
        <td style="padding:6px 0 6px 16px;text-align:right;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6">${p.count.toLocaleString()}</td>
      </tr>`).join('')
    : '<tr><td colspan="2" style="padding:8px 0;color:#9ca3af;font-size:13px">No pageviews this week</td></tr>'

  const topRefRows = topReferrers.length > 0
    ? topReferrers.map(r => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${r.referrer || 'Direct / None'}</td>
        <td style="padding:6px 0 6px 16px;text-align:right;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6">${r.count.toLocaleString()}</td>
      </tr>`).join('')
    : '<tr><td colspan="2" style="padding:8px 0;color:#9ca3af;font-size:13px">No referrers this week</td></tr>'

  const insightsRows = siteInsights.enoughData && siteInsights.insights.length > 0
    ? siteInsights.insights
      .map((insight, index) => `<li style="margin:0 0 8px 0;color:#374151;font-size:14px;line-height:1.5">${index + 1}. ${insight}</li>`)
      .join('')
    : '<li style="margin:0;color:#6b7280;font-size:14px;line-height:1.5">Not enough data yet. Insights appear after 14 full days of analytics history.</li>'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

        <!-- Header -->
        <tr><td style="background:#4f46e5;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Beam</h1>
          <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Weekly Analytics Digest</p>
        </td></tr>

        <!-- Site name -->
        <tr><td style="padding:24px 32px 8px">
          <h2 style="margin:0;font-size:18px;font-weight:600;color:#111827">${siteName}</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Last 7 days vs previous 7 days</p>
        </td></tr>

        <!-- Weekly Insights -->
        <tr><td style="padding:12px 32px 0">
          <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#4338ca;text-transform:uppercase;letter-spacing:0.05em">Weekly Insights</h3>
          <ol style="margin:0;padding-left:0;list-style:none">
            ${insightsRows}
          </ol>
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding:16px 32px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding:16px;background:#f9fafb;border-radius:8px;text-align:center">
                <div style="font-size:32px;font-weight:700;color:#111827">${thisWeekPv.toLocaleString()}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px">Pageviews</div>
                <div style="font-size:13px;font-weight:600;color:${pvColor};margin-top:4px">${pvChange} vs last week</div>
              </td>
              <td width="4%"></td>
              <td width="50%" style="padding:16px;background:#f9fafb;border-radius:8px;text-align:center">
                <div style="font-size:32px;font-weight:700;color:#111827">${thisWeekUv.toLocaleString()}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px">Unique Visitors</div>
                <div style="font-size:13px;font-weight:600;color:${uvColor};margin-top:4px">${uvChange} vs last week</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Top Pages -->
        <tr><td style="padding:8px 32px 0">
          <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Top Pages</h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${topPagesRows}
          </table>
        </td></tr>

        <!-- Top Referrers -->
        <tr><td style="padding:16px 32px 0">
          <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Top Referrers</h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${topRefRows}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:24px 32px" align="center">
          <a href="${dashUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">View Full Dashboard →</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            You're receiving this because you have a Beam account.<br>
            <a href="${unsubUrl}" style="color:#6366f1;text-decoration:underline">Unsubscribe from weekly digests</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `Beam Weekly Digest — ${siteName}

Weekly Insights:
${siteInsights.enoughData && siteInsights.insights.length > 0
    ? siteInsights.insights.map((insight, index) => `  ${index + 1}. ${insight}`).join('\n')
    : '  Not enough data yet. Insights appear after 14 full days of analytics history.'}

Last 7 days:
- Pageviews: ${thisWeekPv.toLocaleString()} (${pvChange} vs last week)
- Unique Visitors: ${thisWeekUv.toLocaleString()} (${uvChange} vs last week)

Top Pages:
${topPages.map(p => `  ${p.path}: ${p.count.toLocaleString()}`).join('\n') || '  No pageviews this week'}

Top Referrers:
${topReferrers.map(r => `  ${r.referrer || 'Direct'}: ${r.count.toLocaleString()}`).join('\n') || '  None'}

View your full dashboard: ${dashUrl}

---
Unsubscribe: ${unsubUrl}`

  await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      reply_to: 'support@beam-privacy.com',
      to: user.email,
      subject: `Your weekly Beam digest — ${siteName}`,
      html,
      text,
    }),
  })
}

function alertEmailHtml(opts: { color: string; siteName: string; lead: string; rows: Array<[string, string]>; ctaHref: string; ctaLabel: string; footnote?: string }): string {
  const rowsHtml = opts.rows.map(([label, value], i) => {
    const border = i < opts.rows.length - 1 ? ';border-bottom:1px solid #f3f4f6' : ''
    return `<tr>
              <td style="padding:10px 0;font-size:14px;color:#374151${border}">${label}</td>
              <td style="padding:10px 0;font-size:14px;color:#111827;text-align:right${border}">${value}</td>
            </tr>`
  }).join('\n            ')
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:${opts.color};padding:20px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Beam Traffic Alert</h1>
          <p style="margin:4px 0 0;color:#f3f4f6;font-size:13px">${escapeEmailHtml(opts.siteName)}</p>
        </td></tr>

        <tr><td style="padding:20px 32px 8px">
          <p style="margin:0;font-size:15px;color:#111827;line-height:1.45">${opts.lead}</p>
        </td></tr>

        <tr><td style="padding:8px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            ${rowsHtml}
          </table>
        </td></tr>
${opts.footnote ? `
        <tr><td style="padding:16px 32px 0">
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">${opts.footnote}</p>
        </td></tr>
` : ''}
        <tr><td style="padding:24px 32px" align="center">
          <a href="${opts.ctaHref}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">${opts.ctaLabel} →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sendAlertEmail(env: Env, to: string, subject: string, html: string, text: string): Promise<void> {
  const resendKey = env.RESEND_API_KEY
  if (!resendKey) return
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      reply_to: 'support@beam-privacy.com',
      to,
      subject,
      html,
      text,
    }),
  })
}

async function sendTrackingStoppedEmail(env: Env, target: AlertTarget, stopped: TrackingStopped, lastSeenLabel: string): Promise<void> {
  const siteUrl = `${getPublicBaseUrl(env)}/dashboard/sites/${target.siteId}`
  const days = stopped.quietDays === 1 ? '1 day' : `${stopped.quietDays} days`
  const normalGap = stopped.longestNormalGap === 0
    ? 'it had pageviews every day'
    : `it never went more than ${stopped.longestNormalGap === 1 ? '1 day' : `${stopped.longestNormalGap} days`} without one`
  const subject = `Tracking may have stopped: no pageviews from ${target.siteName} for ${days}`
  const causes = 'Common causes: the Beam script was removed or is blocked, a deploy changed the page template, the domain changed, or the site itself is down.'

  const text = `No pageviews from ${target.siteName} for ${days}

Last pageview: ${lastSeenLabel}
Normal traffic: ~${formatBaseline(stopped.baselineDaily)} pageviews/day
In the 28 days before this, ${normalGap}.

${causes}

Check your installation: ${siteUrl}`

  const html = alertEmailHtml({
    color: '#d97706',
    siteName: target.siteName,
    lead: `Beam hasn't received a pageview from ${escapeEmailHtml(target.siteName)} for ${days} — longer than this site has gone quiet in the last four weeks.`,
    rows: [
      ['Last pageview', lastSeenLabel],
      ['Normal traffic', `~${formatBaseline(stopped.baselineDaily)}/day`],
      ['Longest normal gap', stopped.longestNormalGap === 0 ? 'none' : (stopped.longestNormalGap === 1 ? '1 day' : `${stopped.longestNormalGap} days`)],
    ],
    footnote: causes,
    ctaHref: siteUrl,
    ctaLabel: 'Check installation',
  })

  await sendAlertEmail(env, target.email, subject, html, text)
}

async function sendSpikeEmail(env: Env, target: AlertTarget, spike: TrafficSpike, dayLabel: string, topReferrer: string): Promise<void> {
  const dashUrl = `${getPublicBaseUrl(env)}/dashboard/sites/${target.siteId}/analytics?range=7d`
  const subject = `Traffic spike: ${target.siteName} up ${spike.percent}%`

  const text = `Traffic spike detected for ${target.siteName}

Pageviews on ${dayLabel}: ${spike.pageviews.toLocaleString()}
28-day baseline (daily avg): ${formatBaseline(spike.baselineDaily)}
Change vs baseline: +${spike.percent}%
Top referrer: ${topReferrer}

View dashboard: ${dashUrl}`

  const html = alertEmailHtml({
    color: '#059669',
    siteName: target.siteName,
    lead: `Traffic on ${dayLabel} spiked well above your normal baseline.`,
    rows: [
      [`Pageviews on ${dayLabel}`, spike.pageviews.toLocaleString()],
      ['28-day daily baseline', formatBaseline(spike.baselineDaily)],
      ['Change vs baseline', `+${spike.percent}%`],
      ['Top referrer', escapeEmailHtml(topReferrer)],
    ],
    ctaHref: dashUrl,
    ctaLabel: 'View Dashboard',
  })

  await sendAlertEmail(env, target.email, subject, html, text)
}

async function runWeeklyDigests(env: Env, now: Date): Promise<void> {
  const thisWeekStart = isoDateOffset(now, 7)
  const lastWeekStart = isoDateOffset(now, 14)
  const nowISO = now.toISOString()

  // Get all users with at least one site who haven't opted out
  const usersResult = await env.DB.prepare(`
    SELECT DISTINCT u.id, u.email
    FROM users u
    INNER JOIN sites s ON s.user_id = u.id
    WHERE u.digest_opt_out = 0
  `).all<DigestUser>()

  const users = usersResult.results ?? []

  for (const user of users) {
    // Get all sites for this user
    const sitesResult = await env.DB.prepare(
      'SELECT id, name FROM sites WHERE user_id = ?'
    ).bind(user.id).all<{ id: string; name: string }>()

    const sites = sitesResult.results ?? []
    if (sites.length === 0) continue

    // Send one digest per site (or aggregate — we do per-site for clarity)
    for (const site of sites) {
      // This week pageviews
      const thisWeekPvRow = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?'
      ).bind(site.id, thisWeekStart, nowISO).first<PageviewCount>()

      // Last week pageviews
      const lastWeekPvRow = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?'
      ).bind(site.id, lastWeekStart, thisWeekStart).first<PageviewCount>()

      const thisWeekPv = thisWeekPvRow?.count ?? 0
      const lastWeekPv = lastWeekPvRow?.count ?? 0

      // This week unique visitors (hash-based: date+path+country+browser+screen_width)
      const thisWeekUvRow = await env.DB.prepare(`
        SELECT COUNT(DISTINCT (
          substr(timestamp, 1, 10) || '|' || COALESCE(country,'') || '|' ||
          COALESCE(browser,'') || '|' || COALESCE(CAST(screen_width AS TEXT),'')
        )) as count
        FROM pageviews
        WHERE site_id = ? AND timestamp >= ? AND timestamp < ?
      `).bind(site.id, thisWeekStart, nowISO).first<PageviewCount>()

      const lastWeekUvRow = await env.DB.prepare(`
        SELECT COUNT(DISTINCT (
          substr(timestamp, 1, 10) || '|' || COALESCE(country,'') || '|' ||
          COALESCE(browser,'') || '|' || COALESCE(CAST(screen_width AS TEXT),'')
        )) as count
        FROM pageviews
        WHERE site_id = ? AND timestamp >= ? AND timestamp < ?
      `).bind(site.id, lastWeekStart, thisWeekStart).first<PageviewCount>()

      const thisWeekUv = thisWeekUvRow?.count ?? 0
      const lastWeekUv = lastWeekUvRow?.count ?? 0

      // Top 5 pages
      const topPagesResult = await env.DB.prepare(`
        SELECT path, COUNT(*) as count
        FROM pageviews
        WHERE site_id = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY path
        ORDER BY count DESC
        LIMIT 5
      `).bind(site.id, thisWeekStart, nowISO).all<TopPage>()

      const topPages = topPagesResult.results ?? []

      // Top 3 referrers (exclude empty/null)
      const topRefResult = await env.DB.prepare(`
        SELECT COALESCE(referrer, '') as referrer, COUNT(*) as count
        FROM pageviews
        WHERE site_id = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 3
      `).bind(site.id, thisWeekStart, nowISO).all<TopReferrer>()

      const topReferrers = topRefResult.results ?? []
      const goalRows = await env.DB.prepare(
        'SELECT id, name, match_pattern, created_at FROM goals WHERE site_id = ? ORDER BY created_at ASC'
      ).bind(site.id).all<{ id: string; name: string; match_pattern: string; created_at: string }>()
      const siteInsights = await generateSiteInsights({
        db: env.DB,
        kv: env.KV,
        siteId: site.id,
        range: '7d',
        now,
        goals: goalRows.results ?? [],
      })

      await sendDigestEmail(
        env,
        user,
        site.name,
        site.id,
        thisWeekPv,
        lastWeekPv,
        thisWeekUv,
        lastWeekUv,
        topPages,
        topReferrers,
        siteInsights
      )
    }
  }
}

/**
 * Evaluates the last *complete* UTC day. Rules and their backtest live in
 * lib/alerts.ts.
 *
 * This used to compare "today" at 09:00 UTC — nine hours of traffic — against a
 * full-day average with a flat -40% threshold. On 2026-10-12, 23 of 25 eligible
 * sites would have alerted, and the paying customer had already turned alerts
 * off on 18 of their 19 sites.
 */
async function runTrafficAlerts(env: Env, now: Date): Promise<void> {
  const historyEnd = startOfUtcDay(now)
  const historyStart = new Date(historyEnd.getTime() - ALERT_HISTORY_DAYS * 24 * 60 * 60 * 1000)
  const historyStartISO = historyStart.toISOString()
  const historyEndISO = historyEnd.toISOString()
  const days: string[] = []
  for (let i = 0; i < ALERT_HISTORY_DAYS; i++) {
    days.push(new Date(historyStart.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  }
  const lastDay = days[days.length - 1]!

  const targetsResult = await env.DB.prepare(`
    SELECT s.id AS siteId, s.name AS siteName, u.email
    FROM sites s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.digest_opt_out = 0
      AND COALESCE(s.alerts_enabled, 1) = 1
  `).all<AlertTarget>()

  for (const target of targetsResult.results ?? []) {
    // One bounded scan per site replaces three, one of which read the site's
    // entire history every day.
    const rows = await env.DB.prepare(`
      SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS count
      FROM pageviews
      WHERE site_id = ?
        AND timestamp >= ?
        AND timestamp < ?
      GROUP BY day
    `).bind(target.siteId, historyStartISO, historyEndISO).all<{ day: string; count: number }>()
    const byDay = new Map((rows.results ?? []).map(r => [r.day, r.count]))
    const daily = days.map(d => byDay.get(d) ?? 0)

    const stopped = detectTrackingStopped(daily)
    if (stopped) {
      const lastSeen = days[days.length - 1 - stopped.quietDays] ?? 'unknown'
      await sendTrackingStoppedEmail(env, target, stopped, lastSeen)
      continue
    }

    const spike = detectSpike(daily)
    if (spike) {
      const referrerRow = await env.DB.prepare(`
        SELECT COALESCE(referrer, '') AS referrer, COUNT(*) AS count
        FROM pageviews
        WHERE site_id = ?
          AND timestamp >= ?
          AND timestamp < ?
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 1
      `).bind(target.siteId, `${lastDay}T00:00:00.000Z`, historyEndISO).first<TopReferrer>()
      await sendSpikeEmail(env, target, spike, lastDay, displayReferrer(referrerRow?.referrer))
    }
  }
}

async function nexusTrace(env: Env, name: string, fn: () => Promise<void>): Promise<void> {
  const apiKey = env.NEXUS_API_KEY
  if (!apiKey) return fn()

  const baseUrl = 'https://nexus.keylightdigital.dev'
  const startedAt = new Date().toISOString()
  let traceId = ''

  try {
    const res = await fetch(`${baseUrl}/api/v1/traces`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 'beam', name, status: 'running', started_at: startedAt }),
    })
    const data = await res.json() as { trace_id?: string }
    traceId = data.trace_id ?? ''
  } catch { /* don't block on trace failure */ }

  try {
    await fn()
    if (traceId) {
      await fetch(`${baseUrl}/api/v1/traces/${traceId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', ended_at: new Date().toISOString() }),
      }).catch(() => {})
    }
  } catch (err) {
    if (traceId) {
      await fetch(`${baseUrl}/api/v1/traces/${traceId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', ended_at: new Date().toISOString() }),
      }).catch(() => {})
    }
    throw err
  }
}

export async function handleScheduled(env: Env, cronExpression?: string): Promise<void> {
  const cron = cronExpression?.trim()
  const now = new Date()

  // Backward-compatible: when no cron string is provided (tests/manual calls), run both jobs.
  const shouldRunWeeklyDigests = !cron || cron === WEEKLY_DIGEST_CRON
  // Daily trigger only. Both triggers fire on Mondays, so also running on the
  // weekly one sent every Monday alert twice.
  const shouldRunTrafficAlerts = !cron || cron === DAILY_ALERT_CRON

  if (shouldRunTrafficAlerts) {
    await nexusTrace(env, 'traffic-alerts', () => runTrafficAlerts(env, now))
  }

  if (shouldRunWeeklyDigests) {
    await nexusTrace(env, 'weekly-digest', () => runWeeklyDigests(env, now))
  }
}
