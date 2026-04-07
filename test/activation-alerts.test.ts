import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldAlertForExternalUser,
  shouldAttemptFirstActivityAlert,
  shouldAttemptFirstSiteAlert,
  type ActivationAlertUserContext,
} from '../src/lib/activationAlerts'

function makeUser(overrides: Partial<ActivationAlertUserContext> = {}): ActivationAlertUserContext {
  return {
    userId: 'user_123',
    email: 'founder@beamcustomer.io',
    firstTouchIsInternal: 0,
    firstTouchRef: 'show-hn',
    firstTouchUtmSource: 'hackernews',
    firstTouchUtmMedium: 'launch',
    firstTouchUtmCampaign: 'show_hn_apr_2026',
    ...overrides,
  }
}

test('shouldAlertForExternalUser excludes internal/test emails and internal attribution rows', () => {
  assert.equal(shouldAlertForExternalUser(makeUser()), true)
  assert.equal(shouldAlertForExternalUser(makeUser({ email: 'phase15@testmail.dev' })), false)
  assert.equal(shouldAlertForExternalUser(makeUser({ email: 'ralph+phase16@fastmail.com' })), false)
  assert.equal(shouldAlertForExternalUser(makeUser({ firstTouchIsInternal: 1 })), false)
})

test('shouldAttemptFirstSiteAlert requires external user and unsent milestone state', () => {
  assert.equal(shouldAttemptFirstSiteAlert(makeUser()), true)
  assert.equal(shouldAttemptFirstSiteAlert(makeUser({ firstSiteAlertSentAt: '2026-04-04T12:00:00.000Z' })), false)
  assert.equal(shouldAttemptFirstSiteAlert(makeUser({ email: 'steve@keylightdigital.dev' })), false)
})

test('shouldAttemptFirstActivityAlert requires matching first site and unsent milestone state', () => {
  const firstSiteId = 'site_first'

  assert.equal(
    shouldAttemptFirstActivityAlert(
      makeUser({ firstSiteId, firstActivityAlertSentAt: null }),
      firstSiteId
    ),
    true
  )
  assert.equal(
    shouldAttemptFirstActivityAlert(
      makeUser({ firstSiteId: 'site_other', firstActivityAlertSentAt: null }),
      firstSiteId
    ),
    false
  )
  assert.equal(
    shouldAttemptFirstActivityAlert(
      makeUser({ firstSiteId, firstActivityAlertSentAt: '2026-04-04T12:20:00.000Z' }),
      firstSiteId
    ),
    false
  )
  assert.equal(
    shouldAttemptFirstActivityAlert(
      makeUser({ firstSiteId, email: 'qa@example.com' }),
      firstSiteId
    ),
    false
  )
})
