import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import {
  buildFirstTouchAttribution,
  buildSignupAttributionColumns,
  parseFirstTouchCookie,
  serializeFirstTouchCookie,
} from '../src/lib/attribution'
import { isInternalOrTestEmail } from '../src/lib/internalTraffic'
import { firstTouchAttributionMiddleware } from '../src/middleware/attribution'

function readCookieValue(setCookieHeader: string | null, cookieName: string): string | null {
  if (!setCookieHeader) return null
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`))
  return match?.[1] ?? null
}

test('first-touch middleware captures ref, utm, referrer host, path, and timestamp', async () => {
  const app = new Hono<{ Bindings: { ENVIRONMENT?: string } }>()
  app.use('*', firstTouchAttributionMiddleware)
  app.get('/landing', (c) => c.text('ok'))

  const response = await app.request(
    'https://beam-privacy.com/landing?ref=show-hn&utm_source=hn&utm_medium=community&utm_campaign=launch-day',
    {
      headers: {
        accept: 'text/html',
        referer: 'https://news.ycombinator.com/item?id=123',
      },
    },
    { ENVIRONMENT: 'production' }
  )

  const rawCookie = readCookieValue(response.headers.get('set-cookie'), 'beam_first_touch')
  assert.ok(rawCookie, 'expected beam_first_touch cookie to be set')

  const parsed = parseFirstTouchCookie(decodeURIComponent(rawCookie ?? ''))
  assert.equal(parsed?.ref, 'show-hn')
  assert.equal(parsed?.utmSource, 'hn')
  assert.equal(parsed?.utmMedium, 'community')
  assert.equal(parsed?.utmCampaign, 'launch-day')
  assert.equal(parsed?.offerCode, null)
  assert.equal(parsed?.referrerHost, 'news.ycombinator.com')
  assert.equal(parsed?.landingPath, '/landing')
  assert.ok(parsed?.capturedAt)
})

test('first-touch middleware does not overwrite an existing attribution cookie', async () => {
  const app = new Hono<{ Bindings: { ENVIRONMENT?: string } }>()
  app.use('*', firstTouchAttributionMiddleware)
  app.get('/signup', (c) => c.text('ok'))

  const existing = serializeFirstTouchCookie({
    ref: 'producthunt',
    utmSource: 'ph',
    utmMedium: 'launch',
    utmCampaign: 'week-1',
    offerCode: 'launch-2026',
    referrerHost: 'www.producthunt.com',
    landingPath: '/pricing',
    capturedAt: '2026-04-04T00:00:00.000Z',
  })

  const response = await app.request(
    'https://beam-privacy.com/signup?ref=reddit&utm_source=reddit',
    {
      headers: {
        accept: 'text/html',
        cookie: `beam_first_touch=${encodeURIComponent(existing)}`,
      },
    },
    { ENVIRONMENT: 'production' }
  )

  assert.equal(response.headers.get('set-cookie'), null)
})

test('buildSignupAttributionColumns maps cookie payload and marks internal/test traffic', () => {
  const firstTouch = buildFirstTouchAttribution(
    new URL('https://beam-privacy.com/?ref=internal&utm_source=keylight_ops&utm_medium=email&utm_campaign=dogfood'),
    'https://beam-privacy.com/about',
    new Date('2026-04-04T10:00:00.000Z')
  )
  const cookie = serializeFirstTouchCookie(firstTouch)
  const columns = buildSignupAttributionColumns(cookie, 'tester@example.com')

  assert.equal(columns.firstTouchRef, 'internal')
  assert.equal(columns.firstTouchUtmSource, 'keylight_ops')
  assert.equal(columns.firstTouchUtmMedium, 'email')
  assert.equal(columns.firstTouchUtmCampaign, 'dogfood')
  assert.equal(columns.firstTouchOfferCode, null)
  assert.equal(columns.firstTouchReferrerHost, 'beam-privacy.com')
  assert.equal(columns.firstTouchLandingPath, '/')
  assert.equal(columns.firstTouchCapturedAt, '2026-04-04T10:00:00.000Z')
  assert.equal(columns.firstTouchIsInternal, 1)
})

test('attribution captures launch offer code and maps it to signup columns', () => {
  const firstTouch = buildFirstTouchAttribution(
    new URL('https://beam-privacy.com/product-hunt?ref=product-hunt&utm_source=producthunt&utm_medium=launch&utm_campaign=ph_launch_apr_2026&offer=launch-2026'),
    'https://www.producthunt.com/posts/beam',
    new Date('2026-04-04T15:20:00.000Z')
  )
  const cookie = serializeFirstTouchCookie(firstTouch)
  const columns = buildSignupAttributionColumns(cookie, 'maker@example.net')

  assert.equal(columns.firstTouchRef, 'product-hunt')
  assert.equal(columns.firstTouchUtmCampaign, 'ph_launch_apr_2026')
  assert.equal(columns.firstTouchOfferCode, 'launch-2026')
  assert.equal(columns.firstTouchIsInternal, 0)
})

test('internal/test email classifier handles domain and alias verification patterns', () => {
  assert.equal(isInternalOrTestEmail('steve@keylightdigital.com'), true)
  assert.equal(isInternalOrTestEmail('qa@example.com'), true)
  assert.equal(isInternalOrTestEmail('phase14b@testmail.dev'), true)
  assert.equal(isInternalOrTestEmail('ralph+phase15@fastmail.com'), true)
  assert.equal(isInternalOrTestEmail('phase12@proton.me'), true)
  assert.equal(isInternalOrTestEmail('founder@beamcustomer.io'), false)
  assert.equal(isInternalOrTestEmail('phased-array@customer.com'), false)
})

test('buildSignupAttributionColumns marks verification alias emails as excluded by default', () => {
  const columns = buildSignupAttributionColumns(undefined, 'ralph+phase15@fastmail.com')
  assert.equal(columns.firstTouchIsInternal, 1)
})
