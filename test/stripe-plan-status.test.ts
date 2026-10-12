import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'
import { createJWT } from '../src/auth'
import { createSqliteD1 } from './helpers/sqliteD1'

/**
 * `past_due` means a renewal charge failed and Stripe is still retrying. Beam
 * used to map every non-`active` status to free, so a paying customer dropped to
 * free-tier collection caps (402s, lost pageviews) while Stripe was still trying
 * to collect. The billing page's Stripe sync had the same bug via `status=active`.
 */

const SECRET = 'whsec_test'
const JWT_SECRET = 'jwt_test'

function setup(t: TestContext, plan = 'pro') {
  const { db, d1 } = createSqliteD1()
  const now = new Date().toISOString()
  db.prepare("INSERT INTO users (id, email, password_hash, plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at) VALUES ('u1', 'owner@example.com', 'x', ?, 'cus_1', 'sub_1', ?, ?)").run(plan, now, now)
  const kv = { get: async () => null, put: async () => undefined, list: async () => ({ keys: [] }), delete: async () => undefined }
  const env = { DB: d1, KV: kv, STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test', BEAM_JWT_SECRET: JWT_SECRET, PUBLIC_BASE_URL: 'https://beam-privacy.com' }
  const planOf = () => (db.prepare("SELECT plan FROM users WHERE id = 'u1'").get() as { plan: string }).plan
  return { env, planOf }
}

async function signedWebhook(env: object, event: object) {
  const body = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex')
  return app.request('https://beam-privacy.com/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${t},v1=${sig}`, 'content-type': 'application/json' },
    body,
  }, env)
}

const updated = (status: string) => ({ type: 'customer.subscription.updated', data: { object: { customer: 'cus_1', status } } })

for (const status of ['active', 'trialing', 'past_due']) {
  test(`subscription.updated with status ${status} keeps Pro`, async (t) => {
    const { env, planOf } = setup(t)
    const res = await signedWebhook(env, updated(status))
    assert.equal(res.status, 200)
    assert.equal(planOf(), 'pro')
  })
}

for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) {
  test(`subscription.updated with status ${status} ends Pro`, async (t) => {
    const { env, planOf } = setup(t)
    await signedWebhook(env, updated(status))
    assert.equal(planOf(), 'free')
  })
}

test('a recovered past_due subscription restores Pro for a user already downgraded', async (t) => {
  const { env, planOf } = setup(t, 'free')
  await signedWebhook(env, updated('active'))
  assert.equal(planOf(), 'pro')
})

test('subscription.deleted still ends Pro', async (t) => {
  const { env, planOf } = setup(t)
  await signedWebhook(env, { type: 'customer.subscription.deleted', data: { object: { customer: 'cus_1', status: 'canceled' } } })
  assert.equal(planOf(), 'free')
})

test('an unsigned webhook changes nothing', async (t) => {
  const { env, planOf } = setup(t)
  const res = await app.request('https://beam-privacy.com/api/webhooks/stripe', { method: 'POST', body: JSON.stringify(updated('canceled')) }, env)
  assert.equal(res.status, 400)
  assert.equal(planOf(), 'pro')
})

// ── Billing page sync ────────────────────────────────────────────────────────

async function visitBilling(t: TestContext, env: object, stripeSubs: Array<{ id: string; status: string }>) {
  const realFetch = globalThis.fetch
  const stripeUrls: string[] = []
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).startsWith('https://api.stripe.com/v1/subscriptions')) {
      stripeUrls.push(String(url))
      return new Response(JSON.stringify({ data: stripeSubs }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  t.after(() => { globalThis.fetch = realFetch })

  const token = await createJWT({ sub: 'u1', email: 'owner@example.com', plan: 'pro', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET)
  const res = await app.request('https://beam-privacy.com/dashboard/billing', { headers: { cookie: `beam_session=${token}` } }, env)
  return { res, stripeUrls }
}

test('the billing page does not downgrade a past_due customer', async (t) => {
  const { env, planOf } = setup(t)
  const { res, stripeUrls } = await visitBilling(t, env, [{ id: 'sub_1', status: 'past_due' }])
  assert.equal(res.status, 200)
  assert.equal(stripeUrls.length, 1, 'the sync must actually have run')
  assert.doesNotMatch(stripeUrls[0], /status=active/, 'filtering to active hides past_due subscriptions')
  assert.equal(planOf(), 'pro')
})

test('the billing page still downgrades when Stripe has no live subscription', async (t) => {
  const { env, planOf } = setup(t)
  await visitBilling(t, env, [])
  assert.equal(planOf(), 'free')
})
