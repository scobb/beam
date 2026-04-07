import type { Env } from './types'
import { ALERT_BASELINE_DAYS, averageDaily, detectAnomaly, hasMinimumDataDays } from './lib/alerts'
import { generateSiteInsights, type SiteInsights } from './lib/insights'
import { getPublicBaseUrl } from './lib/publicUrl'
import { signUnsubscribe } from './routes/digest'

const FROM_EMAIL = 'Beam <ralph@keylightdigital.dev>'
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
      to: user.email,
      subject: `Your weekly Beam digest — ${siteName}`,
      html,
      text,
    }),
  })
}

async function sendTrafficAlertEmail(
  env: Env,
  target: AlertTarget,
  direction: 'down' | 'spike',
  percent: number,
  todayPageviews: number,
  baselineDaily: number,
  topReferrer: string
): Promise<void> {
  const resendKey = env.RESEND_API_KEY
  if (!resendKey) return

  const baseUrl = getPublicBaseUrl(env)
  const dashUrl = `${baseUrl}/dashboard/sites/${target.siteId}/analytics?range=today`
  const directionLabel = direction === 'down' ? 'drop' : 'spike'
  const subject = direction === 'down'
    ? `Traffic alert: ${target.siteName} is down ${percent}%`
    : `Traffic spike: ${target.siteName} up ${percent}%`

  const text = `Traffic ${directionLabel} detected for ${target.siteName}

Today's pageviews: ${todayPageviews.toLocaleString()}
28-day baseline (daily avg): ${formatBaseline(baselineDaily)}
Change vs baseline: ${direction === 'down' ? '-' : '+'}${percent}%
Top referrer driving the change: ${topReferrer}

View dashboard: ${dashUrl}`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:${direction === 'down' ? '#dc2626' : '#059669'};padding:20px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Beam Traffic Alert</h1>
          <p style="margin:4px 0 0;color:#fee2e2;font-size:13px">${target.siteName}</p>
        </td></tr>

        <tr><td style="padding:20px 32px 8px">
          <p style="margin:0;font-size:15px;color:#111827;line-height:1.45">
            ${direction === 'down' ? 'Traffic dropped sharply compared to your normal baseline.' : 'Traffic spiked well above your normal baseline.'}
          </p>
        </td></tr>

        <tr><td style="padding:8px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6">Today's pageviews</td>
              <td style="padding:10px 0;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6">${todayPageviews.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6">28-day daily baseline</td>
              <td style="padding:10px 0;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6">${formatBaseline(baselineDaily)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6">Change vs baseline</td>
              <td style="padding:10px 0;font-size:14px;color:${direction === 'down' ? '#dc2626' : '#059669'};text-align:right;border-bottom:1px solid #f3f4f6">${direction === 'down' ? '-' : '+'}${percent}%</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#374151">Top referrer driving change</td>
              <td style="padding:10px 0;font-size:14px;color:#111827;text-align:right">${topReferrer}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 32px" align="center">
          <a href="${dashUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">View Dashboard →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: target.email,
      subject,
      html,
      text,
    }),
  })
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

async function runTrafficAlerts(env: Env, now: Date): Promise<void> {
  const todayStart = startOfUtcDay(now)
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const baselineStart = new Date(todayStart.getTime() - ALERT_BASELINE_DAYS * 24 * 60 * 60 * 1000)

  const todayStartISO = todayStart.toISOString()
  const tomorrowStartISO = tomorrowStart.toISOString()
  const baselineStartISO = baselineStart.toISOString()

  const targetsResult = await env.DB.prepare(`
    SELECT s.id AS siteId, s.name AS siteName, u.email
    FROM sites s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.digest_opt_out = 0
      AND COALESCE(s.alerts_enabled, 1) = 1
  `).all<AlertTarget>()

  const targets = targetsResult.results ?? []

  for (const target of targets) {
    const dayCountRow = await env.DB.prepare(`
      SELECT COUNT(DISTINCT substr(timestamp, 1, 10)) AS count
      FROM pageviews
      WHERE site_id = ?
        AND timestamp < ?
    `).bind(target.siteId, tomorrowStartISO).first<PageviewCount>()

    const dataDays = dayCountRow?.count ?? 0
    if (!hasMinimumDataDays(dataDays)) continue

    const todayCountRow = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?'
    ).bind(target.siteId, todayStartISO, tomorrowStartISO).first<PageviewCount>()

    const baselineCountRow = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?'
    ).bind(target.siteId, baselineStartISO, todayStartISO).first<PageviewCount>()

    const todayPageviews = todayCountRow?.count ?? 0
    const baselineTotal = baselineCountRow?.count ?? 0
    const baselineDaily = averageDaily(baselineTotal, ALERT_BASELINE_DAYS)
    const anomaly = detectAnomaly(todayPageviews, baselineDaily)

    if (!anomaly) continue

    const referrerWindowStart = anomaly.direction === 'down' ? baselineStartISO : todayStartISO
    const referrerWindowEnd = anomaly.direction === 'down' ? todayStartISO : tomorrowStartISO

    const referrerRow = await env.DB.prepare(`
      SELECT COALESCE(referrer, '') AS referrer, COUNT(*) AS count
      FROM pageviews
      WHERE site_id = ?
        AND timestamp >= ?
        AND timestamp < ?
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 1
    `).bind(target.siteId, referrerWindowStart, referrerWindowEnd).first<TopReferrer>()

    await sendTrafficAlertEmail(
      env,
      target,
      anomaly.direction,
      anomaly.percent,
      todayPageviews,
      baselineDaily,
      displayReferrer(referrerRow?.referrer)
    )
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
  const shouldRunTrafficAlerts = !cron || cron === DAILY_ALERT_CRON || cron === WEEKLY_DIGEST_CRON

  if (shouldRunTrafficAlerts) {
    await nexusTrace(env, 'traffic-alerts', () => runTrafficAlerts(env, now))
  }

  if (shouldRunWeeklyDigests) {
    await nexusTrace(env, 'weekly-digest', () => runWeeklyDigests(env, now))
  }
}
