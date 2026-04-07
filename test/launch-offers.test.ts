import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'
import { normalizeLaunchOfferCode, resolveLaunchOffer } from '../src/lib/launchOffers'

test('launch offer helpers validate known, invalid, and expired codes', () => {
  assert.equal(normalizeLaunchOfferCode(' Launch-2026 '), 'launch-2026')
  assert.equal(normalizeLaunchOfferCode('bad code!'), null)

  const valid = resolveLaunchOffer('launch-2026', new Date('2026-04-04T00:00:00.000Z'))
  assert.equal(valid.status, 'valid')
  assert.equal(valid.offer?.promoCode, 'BEAMLAUNCH25')

  const expired = resolveLaunchOffer('launch-2026', new Date('2026-06-01T00:00:00.000Z'))
  assert.equal(expired.status, 'expired')

  const invalid = resolveLaunchOffer('launch-does-not-exist', new Date('2026-04-04T00:00:00.000Z'))
  assert.equal(invalid.status, 'invalid')
})

test('campaign launch pages carry offer param and explain discount terms', async () => {
  const env = {
    PUBLIC_BASE_URL: 'https://beam-privacy.com',
    BEAM_SELF_SITE_ID: 'site_123',
  }

  const phResponse = await app.request('http://localhost/product-hunt', {}, env)
  assert.equal(phResponse.status, 200)
  const phHtml = await phResponse.text()
  assert.match(phHtml, /offer=launch-2026/)
  assert.match(phHtml, /Promo code:\s*<code[^>]*>BEAMLAUNCH25<\/code>/)

  const hnResponse = await app.request('http://localhost/show-hn', {}, env)
  assert.equal(hnResponse.status, 200)
  const hnHtml = await hnResponse.text()
  assert.match(hnHtml, /offer=launch-2026/)
  assert.match(hnHtml, /25% off Pro for your first 3 months/)
})
