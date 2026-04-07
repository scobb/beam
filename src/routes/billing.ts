import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { layout, escHtml } from './dashboard'
import { createApiKey, hashApiKey } from '../lib/apiKeys'
import { getPublicBaseUrl } from '../lib/publicUrl'
import { normalizeLaunchOfferCode, resolveLaunchOffer } from '../lib/launchOffers'

const STRIPE_PRICE_ID = 'price_1THbwZRhEblTFzoxXxvNnnEH'

const billing = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

function offerErrorMessage(error: string): string {
  if (error === 'invalid') return 'This launch offer code is not recognized. Please review the offer details and try again.'
  if (error === 'expired') return 'This launch offer has expired. You can still upgrade to Pro at the standard $5/month price.'
  return ''
}

// ── Billing page (/dashboard/billing) ────────────────────────────────────────

billing.get('/dashboard/billing', async (c) => {
  const user = c.get('user')
  const apiKeyFlashId = c.req.query('api_key_flash') ?? ''
  const apiKeyRevoked = c.req.query('api_key_revoked') === '1'
  const requestedOfferCode = normalizeLaunchOfferCode(c.req.query('offer'))
  const offerError = offerErrorMessage(c.req.query('offer_error') ?? '')
  let generatedApiKey: string | null = null

  // Fetch fresh plan + subscription data from DB (JWT may be stale after upgrade)
  const dbUser = await c.env.DB.prepare(
    'SELECT plan, stripe_customer_id, api_key, first_touch_offer_code, checkout_offer_status FROM users WHERE id = ?'
  ).bind(user.sub).first<{
    plan: string
    stripe_customer_id: string | null
    api_key: string | null
    first_touch_offer_code: string | null
    checkout_offer_status: string | null
  }>()

  let plan = dbUser?.plan ?? 'free'
  const stripeCustomerId = dbUser?.stripe_customer_id ?? null
  const hasApiKey = dbUser?.api_key !== null && dbUser?.api_key !== undefined
  const checkoutOfferStatus = dbUser?.checkout_offer_status ?? null
  const stripeKey = c.env.STRIPE_SECRET_KEY ?? ''

  if (apiKeyFlashId) {
    const flashKey = `billing:api-key:${user.sub}:${apiKeyFlashId}`
    const flashValue = await c.env.KV.get(flashKey)
    if (flashValue) {
      generatedApiKey = flashValue
      await c.env.KV.delete(flashKey)
    }
  }

  // Sync plan from Stripe if user has a customer ID (handles stale DB state when webhook is not configured)
  if (stripeCustomerId && stripeKey) {
    try {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`,
        { headers: { 'Authorization': `Bearer ${stripeKey}` } }
      )
      if (subRes.ok) {
        const subData = await subRes.json() as { data?: Array<{ id: string; status: string }> }
        const activeSub = subData.data?.[0]
        const stripeIsActive = activeSub?.status === 'active'
        const dbIsPro = plan === 'pro'
        if (stripeIsActive && !dbIsPro) {
          // Stripe says active but DB says free — sync up
          const now = new Date().toISOString()
          await c.env.DB.prepare(
            'UPDATE users SET plan = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?'
          ).bind('pro', activeSub!.id, now, user.sub).run()
          plan = 'pro'
        } else if (!stripeIsActive && dbIsPro) {
          // Stripe says no active sub but DB says pro — downgrade
          const now = new Date().toISOString()
          await c.env.DB.prepare(
            'UPDATE users SET plan = ?, stripe_subscription_id = NULL, updated_at = ? WHERE id = ?'
          ).bind('free', now, user.sub).run()
          plan = 'free'
        }
      }
    } catch {
      // Non-blocking — use DB plan if Stripe API fails
    }
  }

  const isPro = plan === 'pro'

  // Monthly pageview count across all user sites
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const sites = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE user_id = ?'
  ).bind(user.sub).all<{ id: string }>()

  let monthlyPageviews = 0
  const siteIds = (sites.results ?? []).map(s => s.id)
  if (siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',')
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM pageviews WHERE site_id IN (${placeholders}) AND timestamp >= ? AND timestamp < ?`
    ).bind(...siteIds, monthStart, monthEnd).first<{ count: number }>()
    monthlyPageviews = countResult?.count ?? 0
  }

  const limit = isPro ? 500000 : 50000
  const pct = Math.min(100, Math.round((monthlyPageviews / limit) * 100))
  const barColor = pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
  const storedOfferCode = normalizeLaunchOfferCode(dbUser?.first_touch_offer_code)
  const activeOffer = resolveLaunchOffer(requestedOfferCode ?? storedOfferCode).offer
  const offerHiddenInput = activeOffer
    ? `<input type="hidden" name="offer" value="${escHtml(activeOffer.code)}" />`
    : ''

  const content = `
    <div class="p-4 sm:p-8 max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Billing</h1>

      ${offerError ? `
        <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ${escHtml(offerError)}
        </div>
      ` : ''}

      ${(!isPro && activeOffer) ? `
        <div class="mb-4 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-4">
          <p class="text-sm font-semibold text-fuchsia-900">${escHtml(activeOffer.headline)}: ${escHtml(activeOffer.discountSummary)}</p>
          <p class="mt-1 text-sm text-fuchsia-800">${escHtml(activeOffer.termsSummary)}</p>
          <p class="mt-1 text-xs text-fuchsia-700">Promo code for checkout: <code class="rounded bg-fuchsia-100 px-1.5 py-0.5">${escHtml(activeOffer.promoCode)}</code></p>
          ${(checkoutOfferStatus === 'pending_manual') ? '<p class="mt-2 text-xs text-fuchsia-700">If Stripe does not apply it automatically, enter this promo code in checkout.</p>' : ''}
        </div>
      ` : ''}

      <!-- Current plan card -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <p class="text-sm text-gray-500">Current Plan</p>
            <p class="text-xl font-bold text-gray-900 mt-0.5">${isPro ? 'Pro' : 'Free'}</p>
            ${isPro
              ? '<p class="text-sm text-gray-500">$5/month · Unlimited sites · 500K pageviews/mo</p>'
              : '<p class="text-sm text-gray-500">1 site · 50,000 pageviews/mo</p>'}
          </div>
          ${isPro ? `
            <form method="POST" action="/dashboard/billing/portal">
              <button type="submit" class="text-sm text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition">
                Manage Subscription
              </button>
            </form>
          ` : `
            <form method="POST" action="/dashboard/billing/checkout">
              ${offerHiddenInput}
              <button type="submit" class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                Upgrade to Pro
              </button>
            </form>
          `}
        </div>

        <!-- Usage bar -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">Pageviews this month</span>
            <span class="font-medium text-gray-900">${monthlyPageviews.toLocaleString()} / ${limit.toLocaleString()}</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="${barColor} h-2 rounded-full" style="width: ${pct}%"></div>
          </div>
          ${!isPro && pct >= 90 ? `
            <p class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-3">
              You're at ${pct}% of your monthly limit.
              <a href="/dashboard/billing" class="font-medium underline">Upgrade to Pro</a> for 100K pageviews/month.
            </p>
          ` : ''}
        </div>
      </div>

      ${isPro ? `
        <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">API Access</h2>
              <p class="text-sm text-gray-500 mt-1">Use Beam's JSON API for scripted reporting and custom dashboards.</p>
            </div>
            <a href="/docs/api" class="text-sm text-indigo-600 hover:underline">View API docs</a>
          </div>

          ${generatedApiKey ? `
            <div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <p class="text-sm font-medium text-green-900">Your new API key (shown once):</p>
              <code class="block mt-2 overflow-x-auto rounded bg-green-100 px-3 py-2 text-xs text-green-950">${escHtml(generatedApiKey)}</code>
              <p class="mt-2 text-xs text-green-800">Store this key now. For security, Beam only shows it once.</p>
            </div>
          ` : ''}

          ${apiKeyRevoked ? `
            <p class="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              API key revoked. Generate a new key when you are ready.
            </p>
          ` : ''}

          <p class="mt-4 text-sm text-gray-600">
            Status:
            <span class="font-medium text-gray-900">${hasApiKey ? 'Active API key on file' : 'No API key generated yet'}</span>
          </p>

          <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <form method="POST" action="/dashboard/billing/api-key/generate">
              <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                ${hasApiKey ? 'Regenerate API Key' : 'Generate API Key'}
              </button>
            </form>
            ${hasApiKey ? `
              <form method="POST" action="/dashboard/billing/api-key/revoke">
                <button type="submit" class="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition">
                  Revoke API Key
                </button>
              </form>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Upgrade CTA (free users only) -->
      ${!isPro ? `
        <div class="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">Upgrade to Pro</h2>
          <p class="text-sm text-gray-500 mb-4">Unlock unlimited sites and 500K pageviews/month for just $5/month.</p>
          <ul class="text-sm text-gray-700 space-y-1.5 mb-5">
            <li>&#10003; Unlimited sites</li>
            <li>&#10003; 500,000 pageviews / month</li>
            <li>&#10003; Priority support</li>
            <li>&#10003; Cancel anytime</li>
          </ul>
          <form method="POST" action="/dashboard/billing/checkout">
            ${offerHiddenInput}
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
              Upgrade for $5/month
            </button>
            <p class="text-xs text-gray-500 mt-2">Cancel anytime — no long-term commitment.</p>
          </form>
        </div>
      ` : ''}
    </div>`

  return c.html(layout('Billing', '/dashboard/billing', content))
})

billing.post('/dashboard/billing/api-key/generate', async (c) => {
  const user = c.get('user')
  const dbUser = await c.env.DB.prepare(
    'SELECT plan FROM users WHERE id = ?'
  ).bind(user.sub).first<{ plan: string }>()

  if ((dbUser?.plan ?? 'free') !== 'pro') {
    return c.redirect('/dashboard/billing', 303)
  }

  const rawApiKey = createApiKey()
  const hashedApiKey = await hashApiKey(rawApiKey)
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    'UPDATE users SET api_key = ?, updated_at = ? WHERE id = ?'
  ).bind(hashedApiKey, now, user.sub).run()

  const flashId = crypto.randomUUID()
  await c.env.KV.put(`billing:api-key:${user.sub}:${flashId}`, rawApiKey, { expirationTtl: 300 })

  return c.redirect(`/dashboard/billing?api_key_flash=${encodeURIComponent(flashId)}`, 303)
})

billing.post('/dashboard/billing/api-key/revoke', async (c) => {
  const user = c.get('user')
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    'UPDATE users SET api_key = NULL, updated_at = ? WHERE id = ?'
  ).bind(now, user.sub).run()

  return c.redirect('/dashboard/billing?api_key_revoked=1', 303)
})

// ── Create Stripe Checkout Session (/dashboard/billing/checkout) ──────────────

billing.post('/dashboard/billing/checkout', async (c) => {
  const user = c.get('user')
  const stripeKey = c.env.STRIPE_SECRET_KEY ?? ''
  const baseUrl = getPublicBaseUrl(c.env)
  const nowIso = new Date().toISOString()
  const dbUser = await c.env.DB.prepare(
    'SELECT first_touch_offer_code FROM users WHERE id = ?'
  ).bind(user.sub).first<{ first_touch_offer_code: string | null }>()

  const body = await c.req.parseBody()
  const requestedOfferCode = normalizeLaunchOfferCode(typeof body.offer === 'string' ? body.offer : null)
  const fallbackOfferCode = normalizeLaunchOfferCode(dbUser?.first_touch_offer_code)
  const offer = resolveLaunchOffer(requestedOfferCode ?? fallbackOfferCode)

  if (offer.status === 'invalid' || offer.status === 'expired') {
    await c.env.DB.prepare(
      'UPDATE users SET checkout_offer_code = ?, checkout_offer_status = ?, checkout_offer_applied_at = ?, updated_at = ? WHERE id = ?'
    ).bind(offer.code, offer.status, nowIso, nowIso, user.sub).run()
    return c.redirect(`/dashboard/billing?offer_error=${offer.status}`, 303)
  }

  const params = new URLSearchParams({
    'mode': 'subscription',
    'line_items[0][price]': STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    'customer_email': user.email,
    'client_reference_id': user.sub,
    'success_url': `${baseUrl}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${baseUrl}/dashboard/billing`,
  })

  let checkoutOfferStatus: string | null = null
  if (offer.status === 'valid' && offer.offer) {
    params.set('metadata[launch_offer_code]', offer.offer.code)
    params.set('metadata[launch_offer_promo_code]', offer.offer.promoCode)

    const autoApplyPromotionId = (c.env.STRIPE_LAUNCH_PROMOTION_CODE_ID ?? '').trim()
    if (autoApplyPromotionId) {
      params.set('discounts[0][promotion_code]', autoApplyPromotionId)
      checkoutOfferStatus = 'applied'
    } else {
      params.set('allow_promotion_codes', 'true')
      params.set('custom_text[submit][message]', `Launch offer: enter promo code ${offer.offer.promoCode} if Stripe does not auto-apply the discount.`)
      checkoutOfferStatus = 'pending_manual'
    }
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const session = await res.json() as { url?: string; error?: { message: string } }
  if (!res.ok || !session.url) {
    return c.html(`<p class="p-8 text-red-600">Stripe error: ${escHtml(session.error?.message ?? 'Unknown error')}</p>`, 500)
  }

  if (offer.status === 'valid' && offer.offer) {
    await c.env.DB.prepare(
      'UPDATE users SET checkout_offer_code = ?, checkout_offer_status = ?, checkout_offer_applied_at = ?, updated_at = ? WHERE id = ?'
    ).bind(offer.offer.code, checkoutOfferStatus, nowIso, nowIso, user.sub).run()
  }

  return c.redirect(session.url, 303)
})

// ── Stripe Billing Portal (manage subscription) ───────────────────────────────

billing.post('/dashboard/billing/portal', async (c) => {
  const user = c.get('user')
  const stripeKey = c.env.STRIPE_SECRET_KEY ?? ''
  const baseUrl = getPublicBaseUrl(c.env)

  const dbUser = await c.env.DB.prepare(
    'SELECT stripe_customer_id FROM users WHERE id = ?'
  ).bind(user.sub).first<{ stripe_customer_id: string | null }>()

  if (!dbUser?.stripe_customer_id) {
    return c.redirect('/dashboard/billing', 303)
  }

  const params = new URLSearchParams({
    'customer': dbUser.stripe_customer_id,
    'return_url': `${baseUrl}/dashboard/billing`,
  })

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const portalSession = await res.json() as { url?: string; error?: { message: string } }
  if (!res.ok || !portalSession.url) {
    return c.redirect('/dashboard/billing', 303)
  }

  return c.redirect(portalSession.url, 303)
})

// ── Success page (/dashboard/billing/success) ────────────────────────────────

billing.get('/dashboard/billing/success', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.query('session_id')
  const stripeKey = c.env.STRIPE_SECRET_KEY ?? ''
  let syncedToPro = false

  if (sessionId && stripeKey) {
    try {
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      })
      if (res.ok) {
        const session = await res.json() as {
          payment_status?: string
          customer?: string | null
          subscription?: string | null
          client_reference_id?: string | null
        }
        if (session.payment_status === 'paid' && session.customer && session.subscription) {
          const now = new Date().toISOString()
          // Use client_reference_id if present (safer), otherwise fall back to JWT user
          const targetUserId = session.client_reference_id ?? user.sub
          await c.env.DB.prepare(
            'UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?'
          ).bind('pro', session.customer, session.subscription, now, targetUserId).run()
          syncedToPro = true
        }
      }
    } catch {
      // Graceful degradation — show generic success if Stripe call fails
    }
  }

  const content = `
    <div class="p-8 max-w-lg">
      <div class="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <div class="text-5xl mb-4">&#127881;</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">You're on Pro!</h1>
        <p class="text-gray-500 mb-6">
          ${syncedToPro
            ? 'Your subscription is active and your plan has been upgraded. Enjoy unlimited sites and 100K pageviews/month.'
            : 'Your payment was received. Your plan should update shortly — refresh the billing page if it hasn\'t changed.'}
        </p>
        <a href="/dashboard" class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
          Go to Dashboard
        </a>
      </div>
    </div>`
  return c.html(layout('Welcome to Pro!', '/dashboard/billing', content))
})

// ── Stripe webhook (/api/webhooks/stripe) ─────────────────────────────────────

billing.post('/api/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature') ?? ''
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET
  const body = await c.req.text()

  // Require webhook secret — fail closed if not configured
  if (!webhookSecret) {
    return new Response('Webhook not configured', { status: 500 })
  }
  const valid = await verifyStripeSignature(body, signature, webhookSecret)
  if (!valid) {
    return new Response('Invalid signature', { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(body) as StripeEvent
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const now = new Date().toISOString()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as CheckoutSession
    const userId = session.client_reference_id
    const customerId = session.customer
    const subscriptionId = session.subscription

    if (userId && customerId && subscriptionId) {
      await c.env.DB.prepare(
        'UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?'
      ).bind('pro', customerId, subscriptionId, now, userId).run()
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Subscription
    await c.env.DB.prepare(
      'UPDATE users SET plan = ?, stripe_subscription_id = NULL, updated_at = ? WHERE stripe_customer_id = ?'
    ).bind('free', now, sub.customer).run()
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Subscription
    const newPlan = sub.status === 'active' ? 'pro' : 'free'
    await c.env.DB.prepare(
      'UPDATE users SET plan = ?, updated_at = ? WHERE stripe_customer_id = ?'
    ).bind(newPlan, now, sub.customer).run()
  }

  return new Response(null, { status: 200 })
})

// ── Stripe HMAC-SHA256 signature verification ─────────────────────────────────

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',')
  const t = parts.find(p => p.startsWith('t='))?.slice(2)
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!t || !v1) return false

  // Reject events older than 300 seconds to prevent replay attacks
  const eventTime = parseInt(t, 10)
  if (isNaN(eventTime) || Math.abs(Math.floor(Date.now() / 1000) - eventTime) > 300) return false

  const payload = `${t}.${body}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  // Decode v1 hex to bytes for timing-safe verify
  const expectedBytes = new Uint8Array(v1.match(/.{2}/g)?.map(h => parseInt(h, 16)) ?? [])
  return crypto.subtle.verify('HMAC', key, expectedBytes, encoder.encode(payload))
}

// ── Stripe event types ────────────────────────────────────────────────────────

interface StripeEvent {
  type: string
  data: { object: unknown }
}

interface CheckoutSession {
  client_reference_id: string | null
  customer: string | null
  subscription: string | null
}

interface Subscription {
  customer: string
  status: string
}

export { billing }
