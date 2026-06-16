import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/index'
import { getDefaultLaunchOffer, normalizeLaunchOfferCode, resolveLaunchOffer } from '../src/lib/launchOffers'

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

test('campaign launch pages render with attribution and do not leak the expired offer', async () => {
  const env = {
    PUBLIC_BASE_URL: 'https://beam-privacy.com',
    BEAM_SELF_SITE_ID: 'site_123',
  }

  // The launch-2026 promo expired 2026-05-31, so the live pages no longer surface
  // the offer param or promo block. Assert the pages still render with their
  // campaign attribution intact, and that the expired offer does not leak through.
  const phResponse = await app.request('http://localhost/product-hunt', {}, env)
  assert.equal(phResponse.status, 200)
  const phHtml = await phResponse.text()
  assert.match(phHtml, /utm_campaign=ph_launch_apr_2026/)
  assert.doesNotMatch(phHtml, /offer=launch-2026/)
  assert.doesNotMatch(phHtml, /BEAMLAUNCH25/)

  const hnResponse = await app.request('http://localhost/show-hn', {}, env)
  assert.equal(hnResponse.status, 200)
  const hnHtml = await hnResponse.text()
  assert.match(hnHtml, /utm_campaign=show_hn_apr_2026/)
  assert.doesNotMatch(hnHtml, /offer=launch-2026/)
  assert.doesNotMatch(hnHtml, /BEAMLAUNCH25/)
})

test('launch offer surfaces promo terms while valid, and nothing once expired', () => {
  // Deterministic coverage of the offer content the campaign pages render while a
  // promo is live — pinned to fixed dates so it does not depend on the clock.
  const offer = getDefaultLaunchOffer(new Date('2026-04-04T00:00:00.000Z'))
  assert.ok(offer, 'expected a valid launch offer for an in-window date')
  assert.equal(offer?.promoCode, 'BEAMLAUNCH25')
  assert.equal(offer?.discountSummary, '25% off Pro for your first 3 months')

  // After expiry, no offer is surfaced.
  assert.equal(getDefaultLaunchOffer(new Date('2026-06-01T00:00:00.000Z')), null)
})
