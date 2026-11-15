import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'
import { createJWT } from '../src/auth'
import { createSqliteD1 } from './helpers/sqliteD1'

/**
 * "Manage Subscription" used to redirect straight back to the billing page when
 * the portal session could not be created, so the button looked dead. Every
 * failure must now land on the billing page with a visible explanation.
 */

const JWT_SECRET = 'jwt_test'

async function setup(t: TestContext, customerId: string | null, stripeResponse?: Response) {
  const { db, d1 } = createSqliteD1()
  const now = new Date().toISOString()
  db.prepare("INSERT INTO users (id, email, password_hash, plan, stripe_customer_id, created_at, updated_at) VALUES ('u1', 'owner@example.com', 'x', 'pro', ?, ?, ?)").run(customerId, now, now)
  const kv = { get: async () => null, put: async () => undefined, list: async () => ({ keys: [] }), delete: async () => undefined }
  const env = { DB: d1, KV: kv, STRIPE_SECRET_KEY: 'sk_test', BEAM_JWT_SECRET: JWT_SECRET, PUBLIC_BASE_URL: 'https://beam-privacy.com' }
  const token = await createJWT({ sub: 'u1', email: 'owner@example.com', plan: 'pro' }, JWT_SECRET)

  const stripeCalls: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    stripeCalls.push(url)
    if ((url.includes('/billing_portal/sessions') || url.includes('/checkout/sessions')) && stripeResponse) return stripeResponse
    return new Response(JSON.stringify({ data: [{ id: 'sub_1', status: 'active' }] }), { status: 200 })
  }) as typeof fetch
  const realError = console.error
  console.error = () => undefined
  t.after(() => { globalThis.fetch = realFetch; console.error = realError })

  const request = (path: string, method = 'GET') =>
    app.request(`https://beam-privacy.com${path}`, { method, headers: { cookie: `beam_session=${token}` } }, env)
  return { request, stripeCalls }
}

test('portal redirects to Stripe when a session is created', async (t) => {
  const { request } = await setup(t, 'cus_1', new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/x' }), { status: 200 }))
  const res = await request('/dashboard/billing/portal', 'POST')
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), 'https://billing.stripe.com/p/session/x')
})

test('portal explains itself when Stripe refuses to create a session', async (t) => {
  const { request } = await setup(t, 'cus_1', new Response(JSON.stringify({ error: { message: 'No configuration provided' } }), { status: 400 }))
  const res = await request('/dashboard/billing/portal', 'POST')
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), '/dashboard/billing?portal_error=stripe')

  const page = await (await request('/dashboard/billing?portal_error=stripe')).text()
  assert.match(page, /role="alert"/)
  assert.match(page, /could not open the subscription portal/)
})

test('portal explains itself when the account has no Stripe customer', async (t) => {
  const { request, stripeCalls } = await setup(t, null)
  const res = await request('/dashboard/billing/portal', 'POST')
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), '/dashboard/billing?portal_error=no_customer')
  assert.equal(stripeCalls.some(u => u.includes('/billing_portal/')), false)

  const page = await (await request('/dashboard/billing?portal_error=no_customer')).text()
  assert.match(page, /no Stripe subscription on file/)
})

test('checkout never shows Stripe\'s own error text to the customer', async (t) => {
  const secret = "Permission denied. The provided key 'rk_live_x' does not have the required permissions on account 'acct_123'"
  const { request } = await setup(t, null, new Response(JSON.stringify({ error: { message: secret } }), { status: 403 }))
  const res = await request('/dashboard/billing/checkout', 'POST')
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), '/dashboard/billing?checkout_error=stripe')
  assert.doesNotMatch(await res.text(), /acct_123|rk_live/)

  const page = await (await request('/dashboard/billing?checkout_error=stripe')).text()
  assert.match(page, /could not start checkout/)
  assert.doesNotMatch(page, /acct_123|rk_live/)
})

test('checkout still redirects to Stripe when a session is created', async (t) => {
  const { request } = await setup(t, null, new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/x' }), { status: 200 }))
  const res = await request('/dashboard/billing/checkout', 'POST')
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), 'https://checkout.stripe.com/c/pay/x')
})
